import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAIConfigured } from "@/lib/anthropic";
import { PageHeader } from "@/components/layout/page-header";
import { AskPanel } from "@/components/decisions/ask-panel";

export const metadata = {
  title: "Ask DecisionOS",
  description: "Ask questions about your team's decisions and get grounded, cited answers.",
};

export default async function AskPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [aiEnabled, decisionCount] = await Promise.all([
    isAIConfigured(session.workspaceId),
    prisma.decision.count({ where: { workspaceId: session.workspaceId } }),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <PageHeader
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-xs bg-blue-100">
            <Sparkles className="h-5 w-5 text-blue-600" />
          </div>
        }
        title="Ask DecisionOS"
        description="Ask in plain English. Answers are grounded in (and cite) your own decision records."
      />
      <AskPanel aiEnabled={aiEnabled} hasDecisions={decisionCount > 0} />
    </div>
  );
}
