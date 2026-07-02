"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/env";
import {
  loginLimiter,
  loginIpLimiter,
  signupLimiter,
  clientKeyFromHeaders,
} from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import { recordAudit } from "@/lib/audit-log";
import { auditContextFromHeaders } from "@/lib/audit";

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

export type AuthState = {
  error?: string;
  success?: boolean;
};

export async function signup(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const workspaceName = formData.get("workspaceName") as string;

  if (!name || !email || !password || !workspaceName) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Throttle signups per source IP to blunt automated account/enumeration spam.
  const signupHeaders = await headers();
  const signupIp = clientKeyFromHeaders(signupHeaders);
  if (!(await signupLimiter.check(signupIp)).ok) {
    return { error: TOO_MANY };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const slug = slugify(workspaceName);

  let workspaceSlug = slug;
  let counter = 0;
  while (await prisma.workspace.findUnique({ where: { slug: workspaceSlug } })) {
    counter++;
    workspaceSlug = `${slug}-${counter}`;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      memberships: {
        create: {
          role: "admin",
          workspace: {
            create: { name: workspaceName, slug: workspaceSlug },
          },
        },
      },
    },
    include: { memberships: { include: { workspace: true } } },
  });

  const membership = user.memberships[0];

  await createSession({
    userId: user.id,
    workspaceId: membership.workspaceId,
    role: membership.role,
    email: user.email,
    name: user.name,
    platformRole: isPlatformAdminEmail(user.email) ? "superadmin" : undefined,
    platformHomeWorkspaceId: membership.workspaceId,
  });

  const signupCtx = auditContextFromHeaders(signupHeaders);
  await recordAudit({
    action: "auth.signup",
    actor: { userId: user.id, email: user.email, workspaceId: membership.workspaceId },
    targetType: "workspace",
    targetId: membership.workspaceId,
    ip: signupCtx.ip,
    userAgent: signupCtx.userAgent,
  });

  redirect("/decisions");
}

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Brute-force / credential-stuffing protection: cap attempts per (ip+email)
  // and per ip before touching the database. Generic message either way.
  const loginHeaders = await headers();
  const ip = clientKeyFromHeaders(loginHeaders);
  const auditCtx = auditContextFromHeaders(loginHeaders);
  const [perId, perIp] = await Promise.all([
    loginLimiter.check(`${ip}:${email.toLowerCase()}`),
    loginIpLimiter.check(ip),
  ]);
  if (!perId.ok || !perIp.ok) {
    return { error: TOO_MANY };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { workspace: true } } },
  });

  if (!user) {
    await recordAudit({
      action: "auth.login_failed",
      actor: { email },
      outcome: "failure",
      metadata: { reason: "unknown_email" },
      ip: auditCtx.ip,
      userAgent: auditCtx.userAgent,
    });
    return { error: "Invalid email or password." };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await recordAudit({
      action: "auth.login_failed",
      actor: { userId: user.id, email: user.email },
      outcome: "failure",
      metadata: { reason: "bad_password" },
      ip: auditCtx.ip,
      userAgent: auditCtx.userAgent,
    });
    return { error: "Invalid email or password." };
  }

  const membership = user.memberships[0];
  if (!membership) {
    return { error: "No workspace found for this account." };
  }

  // If the workspace enforces SSO, password login is disabled. Users must
  // sign in via /auth/sso/<slug>/start. Admins remain exempt so they can
  // still reach settings if SSO is misconfigured.
  if (membership.role !== "admin") {
    const sso = await prisma.workspaceSsoConfig.findUnique({
      where: { workspaceId: membership.workspaceId },
    });
    if (sso?.enforced) {
      return {
        error: `Your workspace requires single sign-on. Visit /auth/sso/${membership.workspace.slug}/start to sign in.`,
      };
    }
  }

  await createSession({
    userId: user.id,
    workspaceId: membership.workspaceId,
    role: membership.role,
    email: user.email,
    name: user.name,
    platformRole: isPlatformAdminEmail(user.email) ? "superadmin" : undefined,
    platformHomeWorkspaceId: membership.workspaceId,
  });

  await recordAudit({
    action: "auth.login",
    actor: { userId: user.id, email: user.email, workspaceId: membership.workspaceId },
    ip: auditCtx.ip,
    userAgent: auditCtx.userAgent,
  });

  redirect("/decisions");
}

export async function logout() {
  const session = await getSession();
  if (session) {
    await recordAudit({
      action: "auth.logout",
      actor: { userId: session.userId, email: session.email, workspaceId: session.workspaceId },
    });
  }
  await deleteSession();
  redirect("/login");
}
