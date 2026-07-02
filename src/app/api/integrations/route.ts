import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { encrypt, decrypt } from "@/lib/crypto";
import { INTEGRATION_TYPES } from "@/lib/notify";
import { AnthropicConfigSchema } from "@/lib/schemas";
import { auditApiEvent } from "@/lib/audit-log";

/** Redaction mask shown in the UI in place of stored secrets. */
const SECRET_MASK = "••••••••";

/** Shape stored (and returned) for each integration type */
export type IntegrationConfig =
  | { type: "slack"; webhookUrl: string }
  | { type: "teams"; webhookUrl: string }
  | { type: "discord"; webhookUrl: string }
  | { type: "webhook"; webhookUrl: string }
  | { type: "email"; host: string; port: number; user: string; pass: string; from: string; to: string };

function safeDecrypt(configJson: string): Record<string, unknown> {
  try {
    return JSON.parse(decrypt(configJson));
  } catch {
    return {};
  }
}

export const GET = withApi(
  { require: "auth" },
  async ({ session }) => {
    const rows = await prisma.workspaceIntegration.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { integrationType: "asc" },
    });

    const integrations = rows.map((row) => {
      const config = safeDecrypt(row.configJson);
      // Always redact secrets - admins see masked values on load, re-enter to change
      if ("pass" in config) config.pass = SECRET_MASK;
      if ("apiKey" in config) config.apiKey = SECRET_MASK;
      return { id: row.id, type: row.integrationType, isActive: row.isActive, config };
    });

    return NextResponse.json({ integrations });
  },
);

export const PUT = withApi(
  { require: "admin" },
  async ({ session, req }) => {
    const { type, isActive, config } = await req.json().catch(() => ({}));
    if (!type || typeof config !== "object")
      return NextResponse.json({ error: "type and config are required." }, { status: 400 });

    if (!(INTEGRATION_TYPES as readonly string[]).includes(type))
      return NextResponse.json({ error: `Invalid integration type. Must be one of: ${INTEGRATION_TYPES.join(", ")}` }, { status: 400 });

    let finalConfig: Record<string, unknown> = config;

    if (type === "anthropic") {
      const parsed = AnthropicConfigSchema.safeParse(config);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 },
        );
      }
      finalConfig = { ...parsed.data };

      // Keep the previously stored key when the field is blank or still masked, so
      // editing the model/endpoint doesn't wipe the saved key.
      const incomingKey = (parsed.data.apiKey ?? "").trim();
      if (!incomingKey || incomingKey === SECRET_MASK) {
        const existing = await prisma.workspaceIntegration.findUnique({
          where: { workspaceId_integrationType: { workspaceId: session.workspaceId, integrationType: type } },
        });
        const existingKey = existing ? (safeDecrypt(existing.configJson).apiKey as string | undefined) : undefined;
        finalConfig.apiKey = existingKey ?? "";
      }
    }

    const configJson = encrypt(JSON.stringify(finalConfig));

    const integration = await prisma.workspaceIntegration.upsert({
      where: { workspaceId_integrationType: { workspaceId: session.workspaceId, integrationType: type } },
      create: { workspaceId: session.workspaceId, integrationType: type, configJson, isActive: isActive ?? true },
      update: { configJson, isActive: isActive ?? true },
    });

    // The encrypted config is never audited - only the type and active flag.
    await auditApiEvent({
      action: "integration.updated",
      session,
      req,
      targetType: "integration",
      targetId: integration.id,
      metadata: { type, isActive: isActive ?? true },
    });

    return NextResponse.json({ success: true, id: integration.id });
  },
);

export const DELETE = withApi(
  { require: "admin" },
  async ({ session, req }) => {
    const { type } = await req.json().catch(() => ({}));
    if (!type) return NextResponse.json({ error: "type is required." }, { status: 400 });

    await prisma.workspaceIntegration.deleteMany({
      where: { workspaceId: session.workspaceId, integrationType: type },
    });

    await auditApiEvent({
      action: "integration.removed",
      session,
      req,
      targetType: "integration",
      metadata: { type },
    });

    return NextResponse.json({ success: true });
  },
);
