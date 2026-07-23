import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Activity,
  ArrowRight,
  Download,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { Text } from "@/components/ui/text";
import {
  computeDecisionHealth,
  HEALTH_META,
  type DecisionHealth,
} from "@/lib/decision-health";
import { summarizeWorkspace } from "@/lib/workspace-summary";
import { DecisionsSearchBar } from "./decisions-search-bar";
import { DecisionsFilters } from "./decisions-filters";
import { OnboardingChecklist, type ChecklistItem } from "./onboarding-checklist";
import { DecisionsTable } from "./decisions-table";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    owner?: string;
    q?: string;
    review?: string;
    quality?: string;
    health?: string;
    group?: string;
  }>;
}

const VALID_HEALTH: DecisionHealth[] = [
  "healthy",
  "review-due-soon",
  "review-overdue",
  "stale",
  "orphaned",
  "superseded-unreviewed",
  "superseded",
  "archived",
];

function QuickFilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-8 items-center gap-1.5 rounded-xs border px-3 transition-all ${
        active
          ? ""
          : "bg-white/80"
      }`}
      style={active ? {
        background: "var(--gradient-brand)",
        borderColor: "rgba(99,102,241,0.3)",
        boxShadow: "var(--shadow-brand)",
      } : {
        borderColor: "rgba(99,102,241,0.12)",
      }}
    >
      <Text>
        {label}
      </Text>
      {active && <ArrowRight className="h-3 w-3 text-white" />}
    </Link>
  );
}

export default async function DecisionsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const workspaceId = session.workspaceId;
  const isViewer = session.role === "viewer";
  const now = new Date();
  const reviewFilter = params.review === "due";
  const qualityFilter = params.quality;
  const healthFilter =
    params.health && (VALID_HEALTH as string[]).includes(params.health)
      ? (params.health as DecisionHealth)
      : undefined;

  const members = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true } } },
  });

  const where: Record<string, unknown> = { workspaceId };
  if (params.status) {
    where.status = params.status;
  } else if (reviewFilter) {
    where.status = { notIn: ["archived", "superseded"] };
  }
  if (params.owner) where.ownerUserId = params.owner;
  if (reviewFilter) {
    where.reviewDate = { lte: now };
    where.reviewedAt = null;
  }
  if (qualityFilter === "missing-rationale") where.rationale = null;
  if (params.q) {
    where.OR = [
      { title: { contains: params.q } },
      { rationale: { contains: params.q } },
      { problemStatement: { contains: params.q } },
      { chosenOption: { contains: params.q } },
    ];
  }

  const [decisionsRaw, aggRows, slackLink] = await Promise.all([
    prisma.decision.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.decision.findMany({
      where: { workspaceId },
      select: {
        id: true,
        title: true,
        status: true,
        ownerUserId: true,
        reviewDate: true,
        reviewedAt: true,
        updatedAt: true,
        rationale: true,
        problemStatement: true,
        chosenOption: true,
        owner: { select: { name: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.slackWorkspaceLink.findUnique({ where: { decisionWorkspaceId: workspaceId } }),
  ]);

  const summary = summarizeWorkspace(
    aggRows.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      ownerUserId: d.ownerUserId,
      reviewDate: d.reviewDate,
      reviewedAt: d.reviewedAt,
      updatedAt: d.updatedAt,
      rationale: d.rationale,
      problemStatement: d.problemStatement,
      chosenOption: d.chosenOption,
      reviewCount: d._count.reviews,
      owner: d.owner,
    })),
    now,
  );

  const totalCount = summary.total;
  const overdueReviews = summary.memory.overdueReviews;
  const { withRationale, withReviewDate } = summary.memory;
  const memberCount = members.length;

  // Health is derived, so the DB query can't filter on it. Apply post-fetch.
  // Acceptable because a single workspace's decision set is small.
  const decisions = healthFilter
    ? decisionsRaw.filter(
        (d) =>
          computeDecisionHealth(
            {
              status: d.status,
              ownerUserId: d.ownerUserId,
              reviewDate: d.reviewDate,
              reviewedAt: d.reviewedAt,
              updatedAt: d.updatedAt,
              reviewCount: d._count.reviews,
            },
            now,
          ) === healthFilter,
      )
    : decisionsRaw;

  const hasFilters =
    params.status || params.owner || params.q || params.review || params.quality || healthFilter;
  const isFirstVisit = totalCount === 0;

  const quickFilters = [
    {
      href: `/decisions?owner=${session.userId}`,
      label: "Only mine",
      active: params.owner === session.userId,
    },
    {
      href: "/decisions?review=due",
      label: `Needs review (${overdueReviews})`,
      active: reviewFilter,
    },
    {
      href: "/decisions?quality=missing-rationale",
      label: "Missing rationale",
      active: qualityFilter === "missing-rationale",
    },
  ];

  const checklist: ChecklistItem[] = [
    {
      id: "first_decision",
      label: "Log your first decision",
      done: totalCount >= 1,
      href: "/decisions/new",
      cta: "Start",
    },
    {
      id: "rationale",
      label: "Write rationale for at least one decision",
      done: withRationale >= 1,
      href: totalCount > 0 ? `/decisions/${aggRows[0]?.id}` : "/decisions/new",
      cta: "Fill in",
    },
    {
      id: "review_date",
      label: "Set a review date on a decision",
      done: withReviewDate >= 1,
      href: totalCount > 0 ? `/decisions/${aggRows[0]?.id}` : "/decisions/new",
      cta: "Set",
    },
    {
      id: "invite",
      label: "Invite a teammate",
      done: memberCount >= 2,
      href: "/team",
      cta: "Invite",
    },
    {
      id: "slack",
      label: "Connect Slack capture",
      done: Boolean(slackLink?.isActive),
      href: "/settings/integrations",
      cta: "Connect",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Decisions"
        actions={
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/decisions/export" download className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            </Button>
            {!isViewer && (
              <Button asChild>
                <Link href="/decisions/new">
                  <Plus className="h-4 w-4" />
                  New Decision
                </Link>
              </Button>
            )}
          </div>
        }
      >
        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
          <Text as="p">
            {totalCount === 0
              ? "No decisions logged yet"
              : `${totalCount} decision${totalCount !== 1 ? "s" : ""}${
                  hasFilters && decisions.length !== totalCount ? ` · ${decisions.length} shown` : ""
                }`}
          </Text>
          {isViewer && (
            <Text>
              Read-only
            </Text>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <DecisionsSearchBar defaultValue={params.q} />
        </div>

        <DecisionsFilters
          members={members}
          currentStatus={params.status}
          currentOwner={params.owner}
          hasFilters={!!hasFilters}
        />
      </div>

      {totalCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Text as="span">Focus</Text>
          {quickFilters.map((filter) => (
            <QuickFilterLink key={filter.href} {...filter} />
          ))}
        </div>
      )}

      {healthFilter && (
        <div className="flex items-start gap-3 rounded-xs bg-slate-50 px-4 py-2.5">
          <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
          <div className="flex-1 min-w-0">
            <Text>
              Filtered by health: {HEALTH_META[healthFilter].label}
            </Text>
            <Text as="p">
              {HEALTH_META[healthFilter].hint} · {decisions.length} of {totalCount} decision
              {totalCount !== 1 ? "s" : ""}
            </Text>
          </div>
          <Link href="/decisions" className="hover:text-text-brand">
            <Text>Clear</Text>
          </Link>
        </div>
      )}

      {!isFirstVisit && !hasFilters && (
        <OnboardingChecklist workspaceId={workspaceId} items={checklist} />
      )}

      {isFirstVisit && !hasFilters ? (
        <EmptyState
          size="lg"
          icon={<FileText className="h-8 w-8 text-blue-400" />}
          title="Start your decision log"
          description="What is the most important technical or product decision your team made in the last 30 days?"
          hint="Log it now. It takes under 3 minutes and future teammates get the context immediately."
          action={
            !isViewer && (
              <Button size="lg" asChild>
                <Link href="/decisions/new">
                  <Plus className="h-4 w-4" />
                  Log your first decision
                </Link>
              </Button>
            )
          }
        />
      ) : decisions.length === 0 ? (
        <EmptyState
          tile={false}
          icon={<Search className="h-10 w-10 text-slate-300" />}
          title="No decisions match this view"
          description="Change the focus, clear filters, or capture the decision you expected to find."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/decisions">
                Clear filters
              </Link>
            </Button>
          }
        />
      ) : (
        <DecisionsTable decisions={decisions} isViewer={isViewer} />
      )}
    </PageContainer>
  );
}
