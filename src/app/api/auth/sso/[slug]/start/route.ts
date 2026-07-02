import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverOidc } from "@/lib/sso";
import { SignJWT } from "jose";
import { randomBytes } from "crypto";
import { getSessionKey } from "@/lib/env";
import { clientKey, ssoStartLimiter } from "@/lib/rate-limit";

/**
 * GET /api/auth/sso/[slug]/start
 * Kicks off OIDC authorization code flow for the given workspace slug.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const rl = await ssoStartLimiter.check(`${slug}:${clientKey(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rl.headers },
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: { ssoConfig: true },
  });
  if (!workspace || !workspace.ssoConfig) {
    return NextResponse.json({ error: "SSO not configured for this workspace" }, { status: 404 });
  }

  const cfg = workspace.ssoConfig;
  const discovery = await discoverOidc(cfg.issuerUrl);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const redirectUri = `${base}/api/auth/sso/${slug}/callback`;

  const nonce = randomBytes(16).toString("hex");
  const secret = getSessionKey();
  const state = await new SignJWT({ workspaceId: workspace.id, nonce, type: "sso_state" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);

  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);

  return NextResponse.redirect(url.toString());
}
