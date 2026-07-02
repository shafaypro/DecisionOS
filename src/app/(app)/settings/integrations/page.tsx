import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ArrowLeft } from "lucide-react";
import { IntegrationsForm } from "./integrations-form";
import { decrypt } from "@/lib/crypto";
import { CheckCircle2, MessageSquare as SlackIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

interface SearchParams {
  searchParams: Promise<{ slack?: string; slack_error?: string }>;
}

export default async function IntegrationsSettingsPage({ searchParams }: SearchParams) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/settings");
  const sp = await searchParams;

  const [rows, slackLink] = await Promise.all([
    prisma.workspaceIntegration.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { integrationType: "asc" },
    }),
    prisma.slackWorkspaceLink.findUnique({
      where: { decisionWorkspaceId: session.workspaceId },
    }),
  ]);
  const slackConfigured = Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);

  const integrations = rows.map((row) => {
    let config: Record<string, unknown> = {};
    try { config = JSON.parse(decrypt(row.configJson)); } catch { /* empty */ }

    // Always redact secrets before sending to the client
    if ("pass" in config) config.pass = "••••••••";
    if ("apiKey" in config) config.apiKey = "••••••••";
    // webhookUrl is shown to admins - no redaction

    return { id: row.id, type: row.integrationType, isActive: row.isActive, config };
  });

  return (
    <PageContainer>
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
        <PageHeader
          title="Integrations"
          description="Connect Slack capture and review reminder delivery. All credentials are encrypted with AES-256-GCM before storage."
        />
      </div>

      {sp.slack === "installed" && (
        <div className="rounded-xs bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-text-success" />
          <Text>
            Slack app installed. Team members can now run{" "}
            <Text as="code">
              /decisionos log
            </Text>{" "}
            in Slack.
          </Text>
        </div>
      )}
      {sp.slack_error && (
        <Text as="div">Slack install failed: {sp.slack_error}</Text>
      )}

      {/* Slack capture bot */}
      <div className="rounded-xs transition-all duration-200 p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xs bg-blue-50 flex items-center justify-center flex-shrink-0">
            <SlackIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Text as="h3">Slack capture bot</Text>
              {slackLink?.isActive ? (
                <Text as="span">
                  Connected{slackLink.slackTeamName ? ` · ${slackLink.slackTeamName}` : ""}
                </Text>
              ) : (
                <Text as="span">Not installed</Text>
              )}
            </div>
            <Text as="p">
              Capture decisions from Slack in under 15 seconds. Run{" "}
              <Text as="code">
                /decisionos log
              </Text>{" "}
              in any channel, or add a 🔒 reaction to a message.
            </Text>
            {!slackConfigured ? (
              <Text as="p">
                Set{" "}
                <Text as="code">
                  SLACK_CLIENT_ID
                </Text>
                ,{" "}
                <Text as="code">
                  SLACK_CLIENT_SECRET
                </Text>
                , and{" "}
                <Text as="code">
                  SLACK_SIGNING_SECRET
                </Text>{" "}
                in your environment to enable Slack install. See{" "}
                <Text as="code">
                  .env.example
                </Text>
                .
              </Text>
            ) : (
              <div className="mt-3">
                <Button asChild size="sm">
                  <Text as="a" href="/api/slack/install">
                    {slackLink?.isActive ? "Reinstall Slack app" : "Install to Slack"}
                  </Text>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <IntegrationsForm initialIntegrations={integrations} />
    </PageContainer>
  );
}
