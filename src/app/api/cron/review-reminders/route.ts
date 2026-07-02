/**
 * Nightly cron: send review reminder emails.
 *
 * Triggered by Vercel Cron (vercel.json), GitHub Actions, or any scheduler
 * that can make an authenticated HTTP GET request.
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 *
 * For each decision where:
 *   - reviewDate <= today
 *   - reviewedAt IS NULL
 *   - status NOT IN [archived, superseded]
 * → send one email to the decision owner (or creator) with two magic links:
 *   [Still valid →]  /api/decisions/review-action?token=...&action=valid
 *   [Assumptions changed →]  ...action=changed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signReviewToken } from "@/lib/review-token";
import { sendMail, getBaseUrl } from "@/lib/email";
import { decrypt } from "@/lib/crypto";
import { slackOpenConversation, slackPostMessage } from "@/lib/slack/client";
import { isAuthorizedCron } from "@/lib/env";

function verifyCronSecret(req: NextRequest): boolean {
  return isAuthorizedCron(req.headers.get("authorization"));
}

function buildReminderEmail(params: {
  userName: string;
  decisions: Array<{ id: string; title: string; reviewDate: Date | null; rationale: string | null }>;
  magicLinks: Array<{ decisionId: string; validUrl: string; changedUrl: string; appUrl: string }>;
  baseUrl: string;
}): { html: string; text: string } {
  const { userName, decisions, magicLinks } = params;

  const decisionBlocks = decisions.map((d, i) => {
    const link = magicLinks[i];
    const reviewDate = d.reviewDate ? new Date(d.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown";
    const rationaleSnippet = d.rationale ? d.rationale.slice(0, 200) + (d.rationale.length > 200 ? "…" : "") : "";

    return `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
          <p style="margin:0 0 4px; font-size:15px; font-weight:600; color:#1e293b;">${d.title}</p>
          <p style="margin:0 0 8px; font-size:12px; color:#ef4444; font-weight:500;">Review was due ${reviewDate}</p>
          ${rationaleSnippet ? `<p style="margin:0 0 12px; font-size:13px; color:#64748b; line-height:1.5;">${rationaleSnippet}</p>` : ""}
          <table>
            <tr>
              <td style="padding-right:8px;">
                <a href="${link.validUrl}" style="display:inline-block; padding:7px 14px; background:#10b981; color:white; border-radius:6px; font-size:13px; font-weight:600; text-decoration:none;">
                  ✓ Still valid
                </a>
              </td>
              <td style="padding-right:8px;">
                <a href="${link.changedUrl}" style="display:inline-block; padding:7px 14px; background:#f59e0b; color:white; border-radius:6px; font-size:13px; font-weight:600; text-decoration:none;">
                  ⚠ Assumptions changed
                </a>
              </td>
              <td>
                <a href="${link.appUrl}" style="display:inline-block; padding:7px 14px; background:transparent; color:#6366f1; border:1px solid #6366f1; border-radius:6px; font-size:13px; font-weight:600; text-decoration:none;">
                  Open in app →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
        <tr><td align="center" style="padding:32px 16px;">
          <table width="580" cellpadding="0" cellspacing="0" style="background:white; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:#1e293b; padding:20px 28px;">
                <p style="margin:0; font-size:13px; font-weight:700; color:#818cf8; letter-spacing:.08em; text-transform:uppercase;">DecisionOS</p>
                <p style="margin:4px 0 0; font-size:18px; font-weight:700; color:white;">Review Reminder</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:24px 28px 8px;">
                <p style="margin:0 0 20px; font-size:15px; color:#334155;">
                  Hi ${userName}, you have <strong>${decisions.length} decision${decisions.length !== 1 ? "s" : ""}</strong> overdue for review.
                  Click a button below - no login required.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${decisionBlocks}
                </table>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:16px 28px 24px;">
                <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.6;">
                  You're receiving this because you own decisions in DecisionOS.
                  To stop these reminders, remove the review date from the decision in the app.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`;

  const text = [
    `Hi ${userName},`,
    ``,
    `You have ${decisions.length} decision${decisions.length !== 1 ? "s" : ""} overdue for review:`,
    ``,
    ...decisions.map((d, i) => {
      const link = magicLinks[i];
      return [
        `• ${d.title}`,
        `  Still valid: ${link.validUrl}`,
        `  Assumptions changed: ${link.changedUrl}`,
        `  Open in app: ${link.appUrl}`,
      ].join("\n");
    }),
    ``,
    `The DecisionOS team`,
  ].join("\n");

  return { html, text };
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const baseUrl = getBaseUrl();

  // Find all overdue decisions with their owner's email
  const overdueDecisions = await prisma.decision.findMany({
    where: {
      reviewDate: { lte: now },
      reviewedAt: null,
      status: { notIn: ["archived", "superseded"] },
    },
    select: {
      id: true,
      title: true,
      rationale: true,
      reviewDate: true,
      workspaceId: true,
      ownerUserId: true,
      createdByUserId: true,
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (overdueDecisions.length === 0) {
    return NextResponse.json({ ok: true, message: "No overdue decisions.", sent: 0 });
  }

  // Group decisions by the responsible user (owner first, fallback to creator)
  const byUser = new Map<string, {
    user: { id: string; name: string; email: string };
    decisions: typeof overdueDecisions;
  }>();

  for (const d of overdueDecisions) {
    const user = (d.owner ?? d.createdBy)!;
    const existing = byUser.get(user.id);
    if (existing) {
      existing.decisions.push(d);
    } else {
      byUser.set(user.id, { user, decisions: [d] });
    }
  }

  let sent = 0;
  let failed = 0;
  const log: string[] = [];

  for (const { user, decisions } of byUser.values()) {
    // Build signed magic links for each decision
    const magicLinks = await Promise.all(
      decisions.map(async (d) => {
        const validToken = await signReviewToken({ decisionId: d.id, userId: user.id, action: "valid" });
        const changedToken = await signReviewToken({ decisionId: d.id, userId: user.id, action: "changed" });
        return {
          decisionId: d.id,
          validUrl: `${baseUrl}/api/decisions/review-action?token=${validToken}`,
          changedUrl: `${baseUrl}/api/decisions/review-action?token=${changedToken}`,
          appUrl: `${baseUrl}/decisions/${d.id}`,
        };
      })
    );

    const { html, text } = buildReminderEmail({
      userName: user.name,
      decisions,
      magicLinks,
      baseUrl,
    });

    const ok = await sendMail({
      to: user.email,
      subject: `[DecisionOS] ${decisions.length} decision${decisions.length !== 1 ? "s" : ""} overdue for review`,
      html,
      text,
    });

    // Log to NotificationLog per decision
    for (const d of decisions) {
      await prisma.notificationLog.create({
        data: {
          workspaceId: d.workspaceId,
          decisionId: d.id,
          type: "review_overdue",
          channel: "email",
          status: ok ? "sent" : "failed",
          error: ok ? null : "SMTP not configured or send failed",
        },
      });
    }

    if (ok) {
      sent++;
      log.push(`✓ ${user.email} (${decisions.length} decisions)`);
    } else {
      failed++;
      log.push(`✗ ${user.email} (no SMTP or send error)`);
    }

    // Also send Slack DM if the user has linked their Slack account
    const slackUserLink = await prisma.slackUserLink.findUnique({
      where: { decisionUserId: user.id },
    });
    if (slackUserLink) {
      const slackWsLink = await prisma.slackWorkspaceLink.findFirst({
        where: { slackWorkspaceId: slackUserLink.slackWorkspaceId, isActive: true },
      });
      if (slackWsLink) {
        try {
          const botToken = decrypt(slackWsLink.slackBotToken);
          const dmResult = await slackOpenConversation(botToken, slackUserLink.slackUserId);
          if (dmResult.ok && dmResult.channelId) {
            const decisionList = decisions
              .slice(0, 5)
              .map((d) => `• *${d.title}*`)
              .join("\n");
            await slackPostMessage(botToken, {
              channel: dmResult.channelId,
              text: `You have ${decisions.length} decision${decisions.length !== 1 ? "s" : ""} overdue for review in DecisionOS.`,
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `:bell: *${decisions.length} decision${decisions.length !== 1 ? "s" : ""} overdue for review*\n${decisionList}`,
                  },
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: { type: "plain_text", text: "Go to Reviews", emoji: true },
                      url: `${baseUrl}/reviews`,
                      style: "primary",
                    },
                  ],
                },
              ],
            });
            log.push(`  ↳ Slack DM sent to ${slackUserLink.slackUserId}`);
          }
        } catch {
          log.push(`  ↳ Slack DM failed (decryption or API error)`);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    overdue: overdueDecisions.length,
    usersNotified: byUser.size,
    sent,
    failed,
    log,
  });
}

// Schedulers vary in the verb they use - Vercel Cron and the GCP host crontab
// issue GET, while the EC2/ECS/Kubernetes configs POST. Accept both so a trigger
// never silently 405s regardless of how the endpoint is wired up.
export const POST = GET;
