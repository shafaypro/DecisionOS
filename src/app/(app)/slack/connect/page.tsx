import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { CheckCircle, MessageSquare as SlackIcon } from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ slack_user?: string; team?: string }>;
}

/**
 * /slack/connect - user comes here from an ephemeral Slack message to link
 * their Slack identity to their DecisionOS account.
 */
export default async function SlackConnectPage({ searchParams }: PageProps) {
  const session = await getSession();
  const { slack_user, team } = await searchParams;

  if (!session) {
    const next = `/slack/connect?slack_user=${slack_user ?? ""}&team=${team ?? ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!slack_user || !team) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="rounded-xs transition-all duration-200 p-6">
          <Text as="h1">
            Missing Slack info
          </Text>
          <Text as="p">
            This link is incomplete. Re-run{" "}
            <Text as="code">
              /decisionos log
            </Text>{" "}
            in Slack to get a fresh link.
          </Text>
        </div>
      </div>
    );
  }

  // Confirm the Slack workspace is linked to THIS DecisionOS workspace
  const slackLink = await prisma.slackWorkspaceLink.findUnique({
    where: { slackWorkspaceId: team },
  });

  if (!slackLink || slackLink.decisionWorkspaceId !== session.workspaceId) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="rounded-xs transition-all duration-200 p-6">
          <Text as="h1">
            Wrong workspace
          </Text>
          <Text as="p">
            This Slack workspace isn&apos;t connected to your current DecisionOS workspace. Switch workspaces or ask an
            admin to install the DecisionOS Slack app.
          </Text>
        </div>
      </div>
    );
  }

  // Already linked?
  const existing = await prisma.slackUserLink.findUnique({
    where: { decisionUserId: session.userId },
  });
  if (existing && existing.slackUserId === slack_user && existing.slackWorkspaceId === team) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="rounded-xs transition-all duration-200 p-6 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <Text as="h1">
            You&apos;re already connected
          </Text>
          <Text as="p">
            Head back to Slack and run{" "}
            <Text as="code">
              /decisionos log
            </Text>{" "}
            to capture a decision.
          </Text>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/decisions">
                Go to Decisions
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="rounded-xs transition-all duration-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xs bg-blue-50 flex items-center justify-center">
            <SlackIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <Text as="h1">
              Connect your Slack account
            </Text>
            <Text as="p">
              Linking{" "}
              <Text as="code">
                {slack_user}
              </Text>{" "}
              in{" "}
              <Text as="code">
                {slackLink.slackTeamName ?? team}
              </Text>
            </Text>
          </div>
        </div>
        <Text as="p">
          Decisions you capture from Slack will be logged as{" "}
          <Text as="strong">{session.name}</Text>. You can disconnect anytime from
          Settings.
        </Text>
        <form action="/api/slack/connect-user" method="POST" className="flex gap-2">
          <input type="hidden" name="slackUserId" value={slack_user} />
          <input type="hidden" name="slackWorkspaceId" value={team} />
          <Button type="submit">Connect my Slack account</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/decisions">
              Cancel
            </Link>
          </Button>
        </form>
      </div>
    </div>
  );
}
