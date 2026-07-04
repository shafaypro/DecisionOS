import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverOidc, exchangeCodeForTokens } from "@/lib/sso";
import { decrypt } from "@/lib/crypto";
import { getSessionKey, isPlatformAdminEmail } from "@/lib/env";
import { createSession } from "@/lib/session";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit-log";
import { auditContextFromHeaders } from "@/lib/audit";
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";

interface StatePayload extends JWTPayload {
  workspaceId: string;
  nonce: string;
  type: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oidcError = url.searchParams.get("error");

  if (oidcError) {
    return NextResponse.redirect(new URL(`/login?sso_error=${encodeURIComponent(oidcError)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const secret = getSessionKey();

  let payload: StatePayload;
  try {
    const { payload: p } = await jwtVerify(state, secret, { algorithms: ["HS256"] });
    payload = p as StatePayload;
    if (payload.type !== "sso_state") throw new Error("bad type");
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: { ssoConfig: true },
  });
  if (!workspace || !workspace.ssoConfig || workspace.id !== payload.workspaceId) {
    return NextResponse.json({ error: "Workspace or SSO not found" }, { status: 404 });
  }

  const cfg = workspace.ssoConfig;
  let clientSecret: string;
  try {
    clientSecret = decrypt(cfg.clientSecretEnc);
  } catch {
    return NextResponse.json({ error: "SSO config is corrupted; reconfigure in Settings." }, { status: 500 });
  }

  const discovery = await discoverOidc(cfg.issuerUrl);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${base}/api/auth/sso/${slug}/callback`;

  const tokens = await exchangeCodeForTokens({
    tokenEndpoint: discovery.token_endpoint,
    code,
    clientId: cfg.clientId,
    clientSecret,
    redirectUri,
  });
  if (!tokens.id_token) {
    return NextResponse.json({ error: tokens.error ?? "Token exchange failed" }, { status: 400 });
  }

  // Verify ID token signature against issuer's JWKS
  const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));
  let idPayload: JWTPayload;
  try {
    const { payload: p } = await jwtVerify(tokens.id_token, JWKS, {
      issuer: discovery.issuer,
      audience: cfg.clientId,
    });
    idPayload = p;
  } catch {
    return NextResponse.json({ error: "ID token verification failed" }, { status: 401 });
  }

  if (payload.nonce && idPayload.nonce && idPayload.nonce !== payload.nonce) {
    return NextResponse.json({ error: "Nonce mismatch" }, { status: 401 });
  }

  const email = String(idPayload.email ?? "").trim().toLowerCase();
  const name =
    String(idPayload.name ?? "") ||
    String(idPayload.preferred_username ?? "") ||
    email.split("@")[0];
  if (!email) {
    return NextResponse.json({ error: "IdP did not return an email" }, { status: 400 });
  }

  // Account-takeover guard: if the IdP explicitly reports the email as
  // unverified, refuse to log in. Otherwise an IdP that lets users set an
  // arbitrary, unverified `email` could be used to match an existing account
  // (e.g. an admin) and be issued that user's session. Absent claims are
  // tolerated (many IdPs omit it), but a `false` is a hard stop.
  if (idPayload.email_verified === false) {
    return NextResponse.redirect(new URL(`/login?sso_error=email_unverified`, req.url));
  }

  if (cfg.allowedEmailDomain) {
    const domain = email.split("@")[1];
    if (domain !== cfg.allowedEmailDomain) {
      return NextResponse.redirect(new URL(`/login?sso_error=domain_not_allowed`, req.url));
    }
  }

  // Find or provision the user + membership
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const tempPassword = await bcrypt.hash(Math.random().toString(36).slice(-16), 12);
    user = await prisma.user.create({
      data: { email, name, passwordHash: tempPassword },
    });
  }

  let membership = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
  });
  if (!membership) {
    // Auto-join is allowed because the email domain (or open config) was accepted above.
    membership = await prisma.workspaceMembership.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "member" },
    });
  }

  await createSession({
    userId: user.id,
    workspaceId: workspace.id,
    role: membership.role,
    email: user.email,
    name: user.name,
    platformRole: isPlatformAdminEmail(user.email) ? "superadmin" : undefined,
    platformHomeWorkspaceId: workspace.id,
  });

  track({
    event: "signup.completed",
    workspaceId: workspace.id,
    userId: user.id,
    source: "api",
    props: { via: "sso_oidc" },
  });

  const ssoCtx = auditContextFromHeaders(req.headers);
  await recordAudit({
    action: "auth.sso_login",
    actor: { userId: user.id, email: user.email, workspaceId: workspace.id },
    metadata: { issuer: discovery.issuer },
    ip: ssoCtx.ip,
    userAgent: ssoCtx.userAgent,
  });

  return NextResponse.redirect(new URL("/decisions", req.url));
}
