import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { encrypt } from "@/lib/crypto";
import { track } from "@/lib/analytics";
import { auditApiEvent } from "@/lib/audit-log";

/**
 * POST /api/settings/sso - save / update OIDC config (form-encoded; redirects back)
 * DELETE /api/settings/sso - remove SSO config
 *
 * Admin only.
 */
export const POST = withApi(
  { require: "admin" },
  async ({ session, req }) => {
    const workspace = await prisma.workspace.findUnique({ where: { id: session.workspaceId } });
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const form = await req.formData();
    const issuerUrl = String(form.get("issuerUrl") ?? "").trim();
    const clientId = String(form.get("clientId") ?? "").trim();
    const clientSecret = String(form.get("clientSecret") ?? "");
    const allowedEmailDomain = String(form.get("allowedEmailDomain") ?? "").trim() || null;
    const enforced = form.get("enforced") === "on";

    if (!issuerUrl || !clientId) {
      return NextResponse.json({ error: "issuerUrl and clientId are required" }, { status: 400 });
    }

    // Allow partial updates: if clientSecret is empty and a config exists, keep the old one.
    const existing = await prisma.workspaceSsoConfig.findUnique({ where: { workspaceId: workspace.id } });
    const encryptedSecret = clientSecret
      ? encrypt(clientSecret)
      : existing?.clientSecretEnc;
    if (!encryptedSecret) {
      return NextResponse.json({ error: "clientSecret is required on first setup" }, { status: 400 });
    }

    await prisma.workspaceSsoConfig.upsert({
      where: { workspaceId: workspace.id },
      update: {
        issuerUrl,
        clientId,
        clientSecretEnc: encryptedSecret,
        allowedEmailDomain,
        enforced,
      },
      create: {
        workspaceId: workspace.id,
        provider: "oidc",
        issuerUrl,
        clientId,
        clientSecretEnc: encryptedSecret,
        allowedEmailDomain,
        enforced,
      },
    });

    track({ event: "workspace.created", workspaceId: workspace.id, userId: session.userId, props: { sso: true } });
    // Note the config, never the secret - issuer/domain/enforced only.
    await auditApiEvent({
      action: "sso.updated",
      session,
      req,
      targetType: "sso",
      targetId: workspace.id,
      metadata: { issuerUrl, clientId, allowedEmailDomain, enforced },
    });

    return NextResponse.redirect(new URL("/settings/sso?saved=1", req.url), 303);
  },
);

export const DELETE = withApi(
  { require: "admin" },
  async ({ session, req }) => {
    await prisma.workspaceSsoConfig.deleteMany({ where: { workspaceId: session.workspaceId } });
    await auditApiEvent({
      action: "sso.removed",
      session,
      req,
      targetType: "sso",
      targetId: session.workspaceId,
    });
    return NextResponse.json({ success: true });
  },
);
