import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/email";

/**
 * Notify everyone watching a decision that it changed.
 *
 * Recipients are the explicit DecisionWatcher rows (the creator/owner are seeded
 * as watchers when a decision is created, and can unwatch). Each recipient gets
 * an in-app notification; an email is also sent best-effort (sendMail no-ops when
 * SMTP isn't configured). The actor who made the change is never notified.
 *
 * Call AFTER the change has been committed. Never throws - failures are logged.
 */

export type DecisionChangeEvent =
  | "updated"
  | "status_changed"
  | "reviewed"
  | "note_added"
  | "note_replied"
  | "archived"
  | "superseded";

const EVENT_VERB: Record<DecisionChangeEvent, string> = {
  updated: "updated",
  status_changed: "changed the status of",
  reviewed: "reviewed",
  note_added: "commented on",
  note_replied: "replied to a note on",
  archived: "archived",
  superseded: "superseded",
};

interface NotifyOpts {
  decisionId: string;
  /** Who made the change - excluded from notifications. */
  actorUserId: string;
  actorName?: string;
  event: DecisionChangeEvent;
  /** Short human description of what changed, e.g. "Status: proposed → decided". */
  summary: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export async function notifyDecisionWatchers(opts: NotifyOpts): Promise<void> {
  try {
    const decision = await prisma.decision.findUnique({
      where: { id: opts.decisionId },
      select: { id: true, title: true, workspaceId: true },
    });
    if (!decision) return;

    const watchers = await prisma.decisionWatcher.findMany({
      where: { decisionId: opts.decisionId },
      select: { userId: true },
    });
    const recipientIds = new Set(watchers.map((w) => w.userId));
    recipientIds.delete(opts.actorUserId);
    if (recipientIds.size === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: [...recipientIds] } },
      select: { id: true, email: true },
    });

    const actor = opts.actorName?.trim() || "Someone";
    const verb = EVENT_VERB[opts.event];
    const title = `${actor} ${verb} "${decision.title}"`;
    const linkUrl = `/decisions/${decision.id}`;

    // In-app notifications - one row per recipient.
    await prisma.inAppNotification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        workspaceId: decision.workspaceId,
        type: "decision_changed",
        title,
        body: opts.summary,
        linkUrl,
      })),
    });

    // Email - best-effort, parallel, never blocks on a single failure.
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
    const href = base ? `${base}${linkUrl}` : linkUrl;
    const recipientsWithEmail = users.filter((u) => u.email);
    if (recipientsWithEmail.length > 0) {
      await Promise.allSettled(
        recipientsWithEmail.map((u) =>
          sendMail({
            to: u.email,
            subject: `[DecisionOS] ${title}`,
            html:
              `<p>${escapeHtml(actor)} ${verb} a decision you're watching:</p>` +
              `<p style="font-size:16px"><strong>${escapeHtml(decision.title)}</strong></p>` +
              `<p>${escapeHtml(opts.summary)}</p>` +
              `<p><a href="${href}">View the decision &rarr;</a></p>`,
            text: `${actor} ${verb} a decision you're watching: ${decision.title}\n\n${opts.summary}\n\n${href}`,
          })
        )
      );
    }
  } catch (err) {
    logger.error("notifyDecisionWatchers failed", {
      decisionId: opts.decisionId,
      event: opts.event,
      err,
    });
  }
}
