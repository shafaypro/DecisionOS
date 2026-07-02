/**
 * Weekly digest cron: one email per user summarising their workspace.
 *
 * Triggered by Vercel Cron or equivalent (recommend: every Monday 09:00 UTC).
 * Authentication: Authorization: Bearer <CRON_SECRET>
 *
 * Per user who is a workspace member:
 * - Count overdue reviews they own
 * - List up to 3 recent team decisions (last 7 days)
 * - List their upcoming reviews (next 14 days)
 * - Only send if there is something worth reporting
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail, getBaseUrl } from "@/lib/email";
import { computeDecisionHealth } from "@/lib/decision-health";
import { isAuthorizedCron } from "@/lib/env";

function verifyCronSecret(req: NextRequest): boolean {
  return isAuthorizedCron(req.headers.get("authorization"));
}

function buildDigestEmail(params: {
  userName: string;
  workspaceName: string;
  baseUrl: string;
  overdueCount: number;
  recentDecisions: Array<{ id: string; title: string; status: string; updatedAt: Date }>;
  upcomingReviews: Array<{ id: string; title: string; reviewDate: Date | null }>;
  /**
   * Workspace-level signals: same for every recipient in this workspace.
   * Surfaced because "decision replaced but no retro" is the single most
   * expensive failure mode this product is built to prevent.
   */
  needsRetro: Array<{ id: string; title: string }>;
  staleCount: number;
  decisionDebt: number;
}): { html: string; text: string } {
  const {
    userName,
    workspaceName,
    baseUrl,
    overdueCount,
    recentDecisions,
    upcomingReviews,
    needsRetro,
    staleCount,
    decisionDebt,
  } = params;

  const hasContent =
    overdueCount > 0 ||
    recentDecisions.length > 0 ||
    upcomingReviews.length > 0 ||
    needsRetro.length > 0 ||
    staleCount > 0;
  if (!hasContent) return { html: "", text: "" };

  const debtBannerBlock = decisionDebt > 0
    ? `<tr><td style="padding:12px 0; border-bottom:1px solid #e2e8f0;">
        <div style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 14px;">
          <span style="font-size:13px;font-weight:700;color:#dc2626;">Decision debt: ${decisionDebt}</span>
          <span style="font-size:12px;color:#64748b;margin-left:8px;">${decisionDebt} decision${decisionDebt !== 1 ? "s" : ""} need${decisionDebt === 1 ? "s" : ""} attention this week</span>
        </div>
      </td></tr>`
    : "";

  const overdueBlock = overdueCount > 0
    ? `<tr><td style="padding:16px 0; border-bottom:1px solid #e2e8f0;">
        <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:#ef4444;">⚠ ${overdueCount} overdue review${overdueCount !== 1 ? "s" : ""}</p>
        <a href="${baseUrl}/reviews" style="font-size:13px; color:#6366f1; text-decoration:none; font-weight:600;">Go to Reviews →</a>
      </td></tr>`
    : "";

  const recentBlock = recentDecisions.length > 0
    ? `<tr><td style="padding:16px 0; border-bottom:1px solid #e2e8f0;">
        <p style="margin:0 0 10px; font-size:13px; font-weight:700; color:#334155;">📋 Recent team decisions</p>
        ${recentDecisions.map((d) => `
          <p style="margin:0 0 6px;">
            <a href="${baseUrl}/decisions/${d.id}" style="font-size:13px; color:#1e293b; font-weight:600; text-decoration:none;">${d.title}</a>
            <span style="margin-left:6px; font-size:11px; color:#94a3b8; text-transform:capitalize;">${d.status}</span>
          </p>`).join("")}
      </td></tr>`
    : "";

  const needsRetroBlock = needsRetro.length > 0
    ? `<tr><td style="padding:16px 0; border-bottom:1px solid #e2e8f0;">
        <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:#be123c;">🪦 ${needsRetro.length} decision${needsRetro.length !== 1 ? "s" : ""} replaced without a retro</p>
        <p style="margin:0 0 8px; font-size:12px; color:#64748b;">A 5-minute retro on each saves your future selves from re-litigating it.</p>
        ${needsRetro.map((d) => `
          <p style="margin:0 0 4px;">
            <a href="${baseUrl}/decisions/${d.id}" style="font-size:13px; color:#1e293b; font-weight:600; text-decoration:none;">${d.title}</a>
          </p>`).join("")}
      </td></tr>`
    : "";

  const staleBlock = staleCount > 0
    ? `<tr><td style="padding:16px 0; border-bottom:1px solid #e2e8f0;">
        <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:#b45309;">🕸 ${staleCount} stale decision${staleCount !== 1 ? "s" : ""}</p>
        <a href="${baseUrl}/decisions?health=stale" style="font-size:13px; color:#6366f1; text-decoration:none; font-weight:600;">Review stale decisions →</a>
      </td></tr>`
    : "";

  const upcomingBlock = upcomingReviews.length > 0
    ? `<tr><td style="padding:16px 0;">
        <p style="margin:0 0 10px; font-size:13px; font-weight:700; color:#334155;">📅 Upcoming reviews (14 days)</p>
        ${upcomingReviews.map((d) => `
          <p style="margin:0 0 6px;">
            <a href="${baseUrl}/decisions/${d.id}" style="font-size:13px; color:#1e293b; font-weight:600; text-decoration:none;">${d.title}</a>
            ${d.reviewDate ? `<span style="margin-left:6px; font-size:11px; color:#94a3b8;">${new Date(d.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>` : ""}
          </p>`).join("")}
      </td></tr>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
        <tr><td align="center" style="padding:32px 16px;">
          <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#1e293b;padding:20px 28px;border-radius:12px 12px 0 0;">
                <p style="margin:0;font-size:12px;font-weight:700;color:#818cf8;letter-spacing:.08em;text-transform:uppercase;">DecisionOS</p>
                <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:white;">Weekly Digest: ${workspaceName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 4px;">
                <p style="margin:0;font-size:15px;color:#334155;">Hi ${userName}, here's what's happening in your decision log.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${debtBannerBlock}
                  ${overdueBlock}
                  ${needsRetroBlock}
                  ${staleBlock}
                  ${recentBlock}
                  ${upcomingBlock}
                </table>
                <div style="margin-top:20px;">
                  <a href="${baseUrl}/decisions" style="display:inline-block;padding:10px 20px;background:#6366f1;color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
                    Open DecisionOS →
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px;border-top:1px solid #f1f5f9;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                  Weekly digest from DecisionOS · <a href="${baseUrl}/settings" style="color:#94a3b8;">Manage settings</a>
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`;

  const textLines = [
    `Hi ${userName}, your weekly DecisionOS digest for ${workspaceName}`,
    ``,
    ...(decisionDebt > 0 ? [`Decision debt: ${decisionDebt}, ${decisionDebt} decision${decisionDebt !== 1 ? "s" : ""} need attention`, ``] : []),
    ...(overdueCount > 0 ? [`⚠ ${overdueCount} overdue review${overdueCount !== 1 ? "s" : ""}: ${baseUrl}/reviews`, ``] : []),
    ...(needsRetro.length > 0 ? [
      `🪦 Replaced without a retro:`,
      ...needsRetro.map((d) => `  • ${d.title}: ${baseUrl}/decisions/${d.id}`),
      ``,
    ] : []),
    ...(staleCount > 0 ? [`🕸 ${staleCount} stale decision${staleCount !== 1 ? "s" : ""}: ${baseUrl}/decisions?health=stale`, ``] : []),
    ...(recentDecisions.length > 0 ? [
      `Recent decisions:`,
      ...recentDecisions.map((d) => `  • ${d.title}: ${baseUrl}/decisions/${d.id}`),
      ``,
    ] : []),
    ...(upcomingReviews.length > 0 ? [
      `Upcoming reviews:`,
      ...upcomingReviews.map((d) => `  • ${d.title}${d.reviewDate ? ` (${new Date(d.reviewDate).toLocaleDateString()})` : ""}`),
      ``,
    ] : []),
    `Open DecisionOS: ${baseUrl}/decisions`,
  ];

  return { html, text: textLines.join("\n") };
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const baseUrl = getBaseUrl();

  // Get all workspace members with their workspaces
  const memberships = await prisma.workspaceMembership.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      workspace: { select: { id: true, name: true } },
    },
  });

  let sent = 0;
  let skipped = 0;

  // Cache per-workspace signals - they're identical for every member, so we
  // avoid re-scanning the same rows N times in a workspace with N members.
  const workspaceSignalsCache = new Map<
    string,
    { needsRetro: Array<{ id: string; title: string }>; staleCount: number }
  >();

  async function getWorkspaceSignals(workspaceId: string) {
    const cached = workspaceSignalsCache.get(workspaceId);
    if (cached) return cached;

    const rows = await prisma.decision.findMany({
      where: { workspaceId },
      select: {
        id: true,
        title: true,
        status: true,
        ownerUserId: true,
        reviewDate: true,
        reviewedAt: true,
        updatedAt: true,
        _count: { select: { reviews: true } },
      },
    });

    const tagged = rows.map((d) => ({
      id: d.id,
      title: d.title,
      health: computeDecisionHealth(
        {
          status: d.status,
          ownerUserId: d.ownerUserId,
          reviewDate: d.reviewDate,
          reviewedAt: d.reviewedAt,
          updatedAt: d.updatedAt,
          reviewCount: d._count.reviews,
        },
        now,
      ),
    }));

    const signals = {
      needsRetro: tagged
        .filter((t) => t.health === "superseded-unreviewed")
        .slice(0, 5)
        .map(({ id, title }) => ({ id, title })),
      staleCount: tagged.filter((t) => t.health === "stale").length,
    };
    workspaceSignalsCache.set(workspaceId, signals);
    return signals;
  }

  for (const membership of memberships) {
    const { user, workspace } = membership;

    const [overdueCount, recentDecisions, upcomingReviews, workspaceSignals] = await Promise.all([
      // Overdue decisions the user owns or created
      prisma.decision.count({
        where: {
          workspaceId: workspace.id,
          reviewDate: { lte: now },
          reviewedAt: null,
          status: { notIn: ["archived", "superseded"] },
          OR: [
            { ownerUserId: user.id },
            { createdByUserId: user.id },
          ],
        },
      }),
      // Recent team decisions (last 7 days)
      prisma.decision.findMany({
        where: {
          workspaceId: workspace.id,
          updatedAt: { gte: sevenDaysAgo },
          status: { notIn: ["archived"] },
        },
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      // User's upcoming reviews (next 14 days)
      prisma.decision.findMany({
        where: {
          workspaceId: workspace.id,
          reviewDate: { gte: now, lte: fourteenDaysOut },
          reviewedAt: null,
          status: { notIn: ["archived", "superseded"] },
          OR: [
            { ownerUserId: user.id },
            { createdByUserId: user.id },
          ],
        },
        select: { id: true, title: true, reviewDate: true },
        orderBy: { reviewDate: "asc" },
        take: 5,
      }),
      getWorkspaceSignals(workspace.id),
    ]);

    // Skip if nothing to report
    if (
      overdueCount === 0 &&
      recentDecisions.length === 0 &&
      upcomingReviews.length === 0 &&
      workspaceSignals.needsRetro.length === 0 &&
      workspaceSignals.staleCount === 0
    ) {
      skipped++;
      continue;
    }

    const decisionDebt = overdueCount + workspaceSignals.needsRetro.length + workspaceSignals.staleCount;
    const { html, text } = buildDigestEmail({
      userName: user.name,
      workspaceName: workspace.name,
      baseUrl,
      overdueCount,
      recentDecisions,
      upcomingReviews,
      needsRetro: workspaceSignals.needsRetro,
      staleCount: workspaceSignals.staleCount,
      decisionDebt,
    });

    const ok = await sendMail({
      to: user.email,
      subject: `[DecisionOS] Weekly digest: ${workspace.name}`,
      html,
      text,
    });

    if (ok) sent++;
    else skipped++;
  }

  return NextResponse.json({
    ok: true,
    total: memberships.length,
    sent,
    skipped,
  });
}

// Accept POST as well as GET - see the note in review-reminders. Schedulers
// disagree on the verb; both must work.
export const POST = GET;
