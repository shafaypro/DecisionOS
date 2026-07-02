import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * First-party analytics. Writes to the AnalyticsEvent table - no third-party
 * tracker, no cookies. Fire-and-forget: failures are logged but never thrown
 * to avoid breaking a request because analytics is down.
 */

export type EventName =
  // Activation / capture
  | "decision.created"
  | "decision.updated"
  | "decision.superseded"
  | "decision.archived"
  | "decision.reviewed"
  | "decision.shared"
  // Integrations
  | "slack.installed"
  | "slack.user_linked"
  | "slack.capture_started"
  | "slack.capture_completed"
  // Growth
  | "signup.completed"
  | "workspace.created"
  | "invite.sent"
  | "member.removed"
  // Retention
  | "review_reminder.sent"
  | "weekly_digest.sent"
  | "search.performed"
  // Platform (provider control plane) - cross-tenant staff actions, audited
  | "platform.workspace_entered"
  | "platform.workspace_suspended"
  | "platform.workspace_renamed";

export type EventSource = "web" | "slack_slash" | "slack_emoji" | "api" | "cron";

export interface TrackArgs {
  event: EventName;
  workspaceId?: string | null;
  userId?: string | null;
  source?: EventSource;
  props?: Record<string, unknown>;
}

export async function track({ event, workspaceId, userId, source = "web", props }: TrackArgs): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        event,
        source,
        workspaceId: workspaceId ?? null,
        userId: userId ?? null,
        propsJson: props ? JSON.stringify(props) : null,
      },
    });
  } catch (e) {
    logger.error("analytics write failed", { event, err: e });
  }
}
