import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ShieldAlert, Compass, ClipboardList } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { computeDecisionHealth, HEALTH_META } from "@/lib/decision-health";
import { markdownToPlainText } from "@/lib/markdown";
import { Badge, Dot } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { IMPACT_COLORS, cn, formatDate, getLabelForValue, IMPACT_LEVELS } from "@/lib/utils";

/**
 * The risk register.
 *
 * Risks and assumptions are captured per decision and then never looked at
 * again, because nothing in the product reads them *across* decisions. This page
 * is that view: every recorded risk and assumption in one list, weighted by
 * impact and annotated with the decision's health - so the entries most likely
 * to have quietly gone stale sort to the top.
 *
 * Ordering is deliberate: impact first (a critical risk matters more than a
 * low-impact one), then decision health (an unreviewed or stale decision's
 * assumptions are the ones nobody has re-checked), then recency.
 */

const IMPACT_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
/** Health states that mean "nobody has re-checked this lately". */
const UNCHECKED_HEALTH = new Set(["superseded-unreviewed", "review-overdue", "stale", "orphaned"]);

interface PageProps {
  searchParams: Promise<{ kind?: string; impact?: string }>;
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center rounded-xs border px-3 transition-colors",
        active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
      )}
    >
      <Text as="span" size="xs" color={active ? "secondary" : "muted"}>
        {label}
      </Text>
    </Link>
  );
}

export default async function RisksPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const kind = params.kind === "assumption" || params.kind === "risk" ? params.kind : "all";
  const impact = params.impact && IMPACT_RANK[params.impact] !== undefined ? params.impact : undefined;

  const decisions = await prisma.decision.findMany({
    where: {
      ...decisionVisibilityWhere(session),
      // Retired decisions carry historical risks that are no longer live.
      status: { notIn: ["archived", "superseded"] },
      OR: [{ risks: { not: null } }, { assumptions: { not: null } }],
    },
    select: {
      id: true,
      title: true,
      status: true,
      impactLevel: true,
      risks: true,
      assumptions: true,
      ownerUserId: true,
      reviewDate: true,
      reviewedAt: true,
      updatedAt: true,
      owner: { select: { name: true } },
      _count: { select: { reviews: true } },
    },
  });

  const now = new Date();

  type Entry = {
    id: string;
    kind: "risk" | "assumption";
    text: string;
    decisionId: string;
    decisionTitle: string;
    impactLevel: string;
    owner: string | null;
    reviewDate: Date | null;
    updatedAt: Date;
    health: ReturnType<typeof computeDecisionHealth>;
  };

  const entries: Entry[] = [];
  for (const d of decisions) {
    const health = computeDecisionHealth(
      {
        status: d.status,
        ownerUserId: d.ownerUserId,
        reviewDate: d.reviewDate,
        reviewedAt: d.reviewedAt,
        updatedAt: d.updatedAt,
        reviewCount: d._count.reviews,
      },
      now,
    );
    const base = {
      decisionId: d.id,
      decisionTitle: d.title,
      impactLevel: d.impactLevel ?? "medium",
      owner: d.owner?.name ?? null,
      reviewDate: d.reviewDate,
      updatedAt: d.updatedAt,
      health,
    };
    // Fields are prose; strip Markdown so the register reads as flat text.
    const risk = markdownToPlainText(d.risks);
    if (risk) entries.push({ id: `${d.id}:risk`, kind: "risk", text: risk, ...base });
    const assumption = markdownToPlainText(d.assumptions);
    if (assumption) {
      entries.push({ id: `${d.id}:assumption`, kind: "assumption", text: assumption, ...base });
    }
  }

  const filtered = entries.filter(
    (e) => (kind === "all" || e.kind === kind) && (!impact || e.impactLevel === impact),
  );

  filtered.sort((a, b) => {
    const impactDelta = (IMPACT_RANK[a.impactLevel] ?? 2) - (IMPACT_RANK[b.impactLevel] ?? 2);
    if (impactDelta !== 0) return impactDelta;
    const uncheckedDelta =
      Number(UNCHECKED_HEALTH.has(b.health)) - Number(UNCHECKED_HEALTH.has(a.health));
    if (uncheckedDelta !== 0) return uncheckedDelta;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const unchecked = filtered.filter((e) => UNCHECKED_HEALTH.has(e.health)).length;
  const highImpact = filtered.filter((e) => e.impactLevel === "high" || e.impactLevel === "critical").length;
  const query = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { kind: kind === "all" ? undefined : kind, impact, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const q = sp.toString();
    return q ? `/risks?${q}` : "/risks";
  };

  return (
    <PageContainer>
      <PageHeader
        title="Risk register"
        icon={<ShieldAlert className="h-5 w-5 text-amber-500" />}
        description={
          <>
            {filtered.length} recorded {filtered.length === 1 ? "entry" : "entries"} across active
            decisions · {highImpact} high-impact · {unchecked} on decisions nobody has re-checked
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <FilterPill href={query({ kind: undefined })} label="All" active={kind === "all"} />
        <FilterPill href={query({ kind: "risk" })} label="Risks" active={kind === "risk"} />
        <FilterPill href={query({ kind: "assumption" })} label="Assumptions" active={kind === "assumption"} />
        <span className="w-2" />
        {IMPACT_LEVELS.map((level) => (
          <FilterPill
            key={level.value}
            href={query({ impact: impact === level.value ? undefined : level.value })}
            label={`${level.label} impact`}
            active={impact === level.value}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8 text-blue-400" />}
          title="Nothing in the register yet"
          description="Risks and assumptions recorded on active decisions show up here."
          hint="Fill in the Risks and Assumptions fields on a decision to build the register."
        />
      ) : (
        <div className="divide-y divide-slate-100 rounded-xs border border-slate-200 bg-white">
          {filtered.map((entry) => {
            const healthMeta = HEALTH_META[entry.health];
            return (
              <div key={entry.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex w-32 shrink-0 flex-col gap-1.5">
                  <Badge
                    className={
                      entry.kind === "risk"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-violet-50 text-violet-700 border-violet-200"
                    }
                    icon={
                      entry.kind === "risk" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Compass className="h-3 w-3" />
                      )
                    }
                  >
                    {entry.kind === "risk" ? "Risk" : "Assumption"}
                  </Badge>
                  <Badge className={IMPACT_COLORS[entry.impactLevel] ?? IMPACT_COLORS.medium}>
                    {getLabelForValue(IMPACT_LEVELS, entry.impactLevel)}
                  </Badge>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <Text as="p" size="sm" color="primary">
                    {entry.text}
                  </Text>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={`/decisions/${entry.decisionId}`} className="hover:underline">
                      <Text as="span" size="xs" color="secondary">
                        {entry.decisionTitle}
                      </Text>
                    </Link>
                    {entry.owner && (
                      <Text as="span" size="2xs" color="muted">
                        {entry.owner}
                      </Text>
                    )}
                    {entry.reviewDate && (
                      <Text as="span" size="2xs" color="muted">
                        Review {formatDate(entry.reviewDate)}
                      </Text>
                    )}
                  </div>
                </div>

                <Badge className={cn("shrink-0", healthMeta.tone)} title={healthMeta.hint} icon={<Dot className={healthMeta.dot} />}>
                  {healthMeta.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
