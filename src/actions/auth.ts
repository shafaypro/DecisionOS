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
  passwordResetLimiter,
  passwordSetLimiter,
  clientKeyFromHeaders,
} from "@/lib/rate-limit";
import { sendResetLink, setPasswordFromLink } from "@/lib/password-links";
import { logger } from "@/lib/logger";
import { slugify } from "@/lib/utils";
import { recordAudit } from "@/lib/audit-log";
import { auditContextFromHeaders } from "@/lib/audit";

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

export type AuthState = {
  error?: string;
  success?: boolean;
  /** Echoed back so a server-side error doesn't wipe the form. */
  values?: Record<string, string>;
  message?: string;
};

export async function signup(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const workspaceName = formData.get("workspaceName") as string;

  // Never echo the password back.
  const values = { name: name ?? "", email: email ?? "", workspaceName: workspaceName ?? "" };

  if (!name || !email || !password || !workspaceName) {
    return { error: "All fields are required.", values };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", values };
  }

  // Throttle signups per source IP to blunt automated account/enumeration spam.
  const signupHeaders = await headers();
  const signupIp = clientKeyFromHeaders(signupHeaders);
  if (!(await signupLimiter.check(signupIp)).ok) {
    return { error: TOO_MANY, values };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "An account with this email already exists. Sign in, or use “Forgot password” if you were invited.",
      values,
    };
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

const RESET_SENT =
  "If an account exists for that address, a reset link is on its way. It expires in 1 hour.";

export async function requestPasswordReset(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  const h = await headers();
  const ip = clientKeyFromHeaders(h);
  const [perIp, perEmail] = await Promise.all([
    passwordResetLimiter.check(ip),
    passwordResetLimiter.check(`email:${email}`),
  ]);
  if (!perIp.ok || !perEmail.ok) return { error: TOO_MANY, values: { email } };

  // Same answer whether or not the account exists, so this can't be used to
  // discover who has an account.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  if (user) {
    const { url, emailed } = await sendResetLink(user);
    if (!emailed && process.env.NODE_ENV !== "production") {
      // Local development has no SMTP; surface the link in the server log.
      logger.info("password reset link (email not configured)", { email: user.email, url });
    }
    const ctx = auditContextFromHeaders(h);
    await recordAudit({
      action: "auth.password_reset_requested",
      actor: { userId: user.id, email: user.email },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  return { success: true, message: RESET_SENT };
}

export async function setPassword(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const name = formData.get("name");
  const values = typeof name === "string" ? { name } : undefined;

  if (password !== confirm) return { error: "The two passwords don't match.", values };

  const h = await headers();
  if (!(await passwordSetLimiter.check(clientKeyFromHeaders(h))).ok) return { error: TOO_MANY, values };

  const result = await setPasswordFromLink(token, password, typeof name === "string" ? name : undefined);
  if (!result.ok) return { error: result.error, values };

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    include: { memberships: { include: { workspace: true } } },
  });
  const ctx = auditContextFromHeaders(h);
  await recordAudit({
    action: "auth.password_set",
    actor: { userId: result.userId, email: user?.email, workspaceId: user?.memberships[0]?.workspaceId },
    metadata: { purpose: result.purpose },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  // Holding a valid link proves control of the inbox, so sign them straight
  // in - unless their workspace enforces SSO, where the password isn't the way in.
  const membership = user?.memberships[0];
  if (!user || !membership) redirect("/login?password=set");
  if (membership.role !== "admin") {
    const sso = await prisma.workspaceSsoConfig.findUnique({ where: { workspaceId: membership.workspaceId } });
    if (sso?.enforced) redirect("/login?password=set");
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
  redirect("/decisions");
}
