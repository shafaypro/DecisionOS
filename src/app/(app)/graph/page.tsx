/**
 * Decision graph - the whole workspace as an interactive node canvas.
 * Decisions are nodes, typed relations (supersedes / depends on / relates to /
 * conflicts with) are edges. Surfaces the structure that the flat list hides:
 * decision chains, dependency clusters, and contested areas.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Network, Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Row } from "@/components/ui/row";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { DecisionGraphCanvas } from "@/components/graph/decision-graph-canvas";

interface PageProps {
  searchParams: Promise<{ all?: string }>;
}

export default async function GraphPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const showAll = params.all === "1";
  const workspaceId = session.workspaceId;

  const [decisions, relations] = await Promise.all([
    prisma.decision.findMany({
      where: { workspaceId },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        owner: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.decisionRelation.findMany({
      where: { fromDecision: { workspaceId } },
      select: { fromDecisionId: true, toDecisionId: true, relationType: true },
    }),
  ]);

  const connectedIds = new Set<string>();
  for (const r of relations) {
    connectedIds.add(r.fromDecisionId);
    connectedIds.add(r.toDecisionId);
  }

  if (decisions.length === 0) {
    return (
      <PageContainer>
        <PageHeader
          title="Decision graph"
          description="See how your decisions connect: chains, dependencies, and conflicts."
        />
        <EmptyState
          icon={<Network className="h-8 w-8 text-blue-400" />}
          title="No decisions to map yet"
          description="Log a few decisions and link them with relations to see the graph come alive."
          action={
            <Button asChild>
              <Link href="/decisions/new">
                <Plus className="h-4 w-4" />
                New decision
              </Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Decision graph"
        description={
          <>
            {decisions.length} decision{decisions.length === 1 ? "" : "s"} ·{" "}
            {relations.length} relation{relations.length === 1 ? "" : "s"} ·{" "}
            {connectedIds.size} connected
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xs border border-slate-200 bg-white/80 p-0.5">
              <Button asChild variant={!showAll ? "default" : "ghost"}>
                <Link href="/graph">Connected only</Link>
              </Button>
              <Button asChild variant={showAll ? "default" : "ghost"}>
                <Link href="/graph?all=1">All decisions</Link>
              </Button>
            </div>
          </div>
        }
      />

      {relations.length === 0 && (
        <div className="rounded-xs transition-all duration-200 px-2 py-1.5">
          <Row
            wrap
            leading={<Network className="h-4 w-4 text-blue-400" />}
            title={
              <>
                No relations yet. Open a decision and use <Text as="span">Add Relation</Text> to
                link it to others (supersedes, depends on, relates to, conflicts with). The graph builds itself
                from those links.
              </>
            }
          />
        </div>
      )}

      <DecisionGraphCanvas
        decisions={decisions.map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          category: d.category,
          ownerName: d.owner?.name ?? null,
        }))}
        relations={relations}
        connectedOnly={!showAll}
      />

      <Text as="p">
        Scroll to zoom · drag the background to pan · drag nodes to rearrange · click a node to open the decision.
        Node size reflects how many relations a decision has.
      </Text>
    </PageContainer>
  );
}
