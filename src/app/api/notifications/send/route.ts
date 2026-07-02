import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdmin, VIEWER_ERROR, isViewer } from "@/lib/auth-guards";
import { decrypt } from "@/lib/crypto";
import { isWebhookChannel, sendWebhookMessage } from "@/lib/notify";

interface WebhookConfig { webhookUrl: string }
interface EmailConfig { host: string; port: number; user: string; pass: string; from: string; to: string }

function parseConfig(configJson: string): Record<string, unknown> {
  try { return JSON.parse(decrypt(configJson)); } catch { return {}; }
}

async function sendEmail(cfg: EmailConfig, subject: string, body: string): Promise<void> {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transporter.sendMail({ from: cfg.from, to: cfg.to, subject, text: body });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isViewer(session.role)) return NextResponse.json(VIEWER_ERROR, { status: 403 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "Only admins can trigger notifications." }, { status: 403 });

  // Find overdue decisions: reviewDate past, not yet reviewed, not archived/superseded
  const now = new Date();
  const overdueDecisions = await prisma.decision.findMany({
    where: {
      workspaceId: session.workspaceId,
      reviewDate: { lt: now },
      reviewedAt: null,
      status: { notIn: ["archived", "superseded"] },
    },
    select: { id: true, title: true, reviewDate: true, status: true },
    orderBy: { reviewDate: "asc" },
    take: 50,
  });

  if (overdueDecisions.length === 0)
    return NextResponse.json({ success: true, message: "No overdue decisions found.", sent: 0 });

  // Get active integrations for this workspace
  const integrations = await prisma.workspaceIntegration.findMany({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (integrations.length === 0)
    return NextResponse.json({ success: true, message: "No active integrations configured.", sent: 0 });

  const summaryLines = overdueDecisions.map(
    (d) =>
      `• [${d.status}] ${d.title} (review was due ${d.reviewDate ? new Date(d.reviewDate).toLocaleDateString() : "unknown"})`
  );
  const messageText =
    `⚠️ *DecisionOS Review Reminder*\n\n` +
    `The following ${overdueDecisions.length} decision(s) are overdue for review:\n\n` +
    summaryLines.join("\n");

  const results: { type: string; status: "sent" | "error"; error?: string }[] = [];

  for (const integration of integrations) {
    const config = parseConfig(integration.configJson);
    let status: "sent" | "error" = "sent";
    let errorMsg: string | undefined;

    try {
      if (isWebhookChannel(integration.integrationType)) {
        const { webhookUrl } = config as unknown as WebhookConfig;
        if (!webhookUrl) throw new Error("Missing webhook URL");
        await sendWebhookMessage(integration.integrationType, webhookUrl, messageText);
      } else if (integration.integrationType === "email") {
        const emailCfg = config as unknown as EmailConfig;
        await sendEmail(
          emailCfg,
          `DecisionOS: ${overdueDecisions.length} decision(s) overdue for review`,
          messageText.replace(/\*/g, "").replace(/⚠️/g, "[!]")
        );
      }
    } catch (err: unknown) {
      status = "error";
      errorMsg = err instanceof Error ? err.message : "Unknown error";
    }

    // Log the notification
    await prisma.notificationLog.create({
      data: {
        workspaceId: session.workspaceId,
        type: "overdue_review",
        channel: integration.integrationType,
        status,
        error: errorMsg ?? null,
      },
    });

    results.push({ type: integration.integrationType, status, error: errorMsg });
  }

  const sent = results.filter((r) => r.status === "sent").length;
  return NextResponse.json({ success: true, overdueCount: overdueDecisions.length, results, sent });
}
