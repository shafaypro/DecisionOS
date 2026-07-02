import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { cn,
  formatDate, ACTION_ITEM_STATUSES,
  STATUS_COLORS, CATEGORY_COLORS, STATUSES, CATEGORIES, getLabelForValue,
} from "@/lib/utils";
import {
  TrendingUp, CheckSquare, Clock, Users,
  FileText, AlertTriangle, Target, RefreshCw, Lightbulb,
} from "lucide-react";
import { computeDecisionHealth } from "@/lib/decision-health";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

function ProgressBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <Text as="span">{value}</Text>
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const wid = session.workspaceId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

  const [
    totalDecisions,
    activeDecisions,
    decisionsByStatus,
    decisionsByCategory,
    decisionsLast30,
    decisionsLast7,
    totalActionItems,
    actionItemsByStatus,
    overdueActionItems,
    completedActionItemsLast30,
    allDecisions,
    memberWorkload,
    recentActivity,
  ] = await Promise.all([
    prisma.decision.count({ where: { workspaceId: wid } }),
    prisma.decision.count({ where: { workspaceId: wid, status: { notIn: ["archived"] } } }),
    prisma.decision.groupBy({ by: ["status"],    where: { workspaceId: wid }, _count: { id: true } }),
    prisma.decision.groupBy({ by: ["category"],  where: { workspaceId: wid }, _count: { id: true } }),
    prisma.decision.count({ where: { workspaceId: wid, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.decision.count({ where: { workspaceId: wid, createdAt: { gte: sevenDaysAgo } } }),
    prisma.actionItem.count({ where: { workspaceId: wid } }),
    prisma.actionItem.groupBy({ by: ["status"], where: { workspaceId: wid }, _count: { id: true } }),
    prisma.actionItem.count({
      where: { workspaceId: wid, status: { notIn: ["done", "cancelled"] }, dueDate: { lt: now } },
    }),
    prisma.actionItem.count({
      where: { workspaceId: wid, status: "done", updatedAt: { gte: thirtyDaysAgo } },
    }),
    // All decisions for pattern analysis (lightweight select)
    prisma.decision.findMany({
      where: { workspaceId: wid },
      select: {
        id: true, category: true, status: true, outcomeStatus: true,
        ownerUserId: true, reviewDate: true, reviewedAt: true,
        updatedAt: true, createdAt: true,
        _count: { select: { reviews: true } },
      },
    }),
    // Member workload: action items assigned per person
    prisma.actionItem.groupBy({
      by: ["assigneeId"],
      where: { workspaceId: wid, status: { notIn: ["done", "cancelled"] }, assigneeId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.decisionEvent.findMany({
      where: { decision: { workspaceId: wid }, createdAt: { gte: sevenDaysAgo } },
      include: { user: { select: { name: true } }, decision: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Resolve assignee names for workload
  const assigneeIds = memberWorkload.map((m) => m.assigneeId).filter(Boolean) as string[];
  const assigneeUsers = assigneeIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];
  const nameById = Object.fromEntries(assigneeUsers.map((u) => [u.id, u.name]));

  // Pattern analysis - derived in-memory (a single workspace's dataset is small)
  const now2 = new Date();
  const categoryStats = new Map<string, { total: number; reversed: number; noRationale: number; unhealthy: number }>();
  for (const d of allDecisions) {
    const cat = d.category ?? "other";
    if (!categoryStats.has(cat)) categoryStats.set(cat, { total: 0, reversed: 0, noRationale: false as unknown as number, unhealthy: 0 });
    const s = categoryStats.get(cat)!;
    s.total++;
    if (d.status === "reversed" || d.status === "superseded") s.reversed++;
    const health = computeDecisionHealth(
      { status: d.status, ownerUserId: d.ownerUserId, reviewDate: d.reviewDate,
        reviewedAt: d.reviewedAt, updatedAt: d.updatedAt, reviewCount: d._count.reviews },
      now2,
    );
    if (health !== "healthy" && health !== "archived" && health !== "superseded") s.unhealthy++;
  }
  const categoryPatterns = Array.from(categoryStats.entries())
    .map(([cat, s]) => ({
      category: cat,
      total: s.total,
      reversalRate: s.total > 0 ? Math.round((s.reversed / s.total) * 100) : 0,
      unhealthyRate: s.total > 0 ? Math.round((s.unhealthy / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.reversalRate - a.reversalRate)
    .filter((c) => c.total >= 2);

  const completionRate = totalActionItems === 0
    ? 0
    : Math.round((actionItemsByStatus.find((s) => s.status === "done")?._count.id ?? 0) / totalActionItems * 100);

  const topStats = [
    { label: "Total decisions", value: totalDecisions, icon: FileText,    color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active decisions", value: activeDecisions, icon: Target,     color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Created (30d)",    value: decisionsLast30, icon: TrendingUp, color: "text-blue-600",    bg: "bg-blue-50" },
    { label: "Action items",     value: totalActionItems, icon: CheckSquare, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Items done (30d)", value: completedActionItemsLast30, icon: CheckSquare, color: "text-green-600", bg: "bg-green-50" },
    { label: "Overdue items",    value: overdueActionItems, icon: AlertTriangle, color: overdueActionItems > 0 ? "text-red-600" : "text-slate-500", bg: overdueActionItems > 0 ? "bg-red-50" : "bg-slate-50" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description={<>Workspace health · {decisionsLast7} decisions this week</>}
      />

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {topStats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xs transition-all duration-200">
              <div className={cn("p-6 pt-0", "p-4")}>
                <div className={`inline-flex p-2 rounded-xs ${s.bg} mb-2`}>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <Text as="p">{s.value}</Text>
                <Text as="p">{s.label}</Text>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Decisions by status */}
        <div className="rounded-xs transition-all duration-200">
          <Text as="h3">
            Decisions by Status
          </Text>
          <div className={cn("p-6 pt-0", "space-y-2")}>
            {decisionsByStatus.sort((a, b) => b._count.id - a._count.id).map((row) => (
              <div key={row.status} className="flex items-center gap-3">
                <div className="w-28 flex-shrink-0">
                  <Badge className={STATUS_COLORS[row.status] ?? "bg-slate-100 text-slate-600"}>
                    {getLabelForValue(STATUSES, row.status)}
                  </Badge>
                </div>
                <ProgressBar value={row._count.id} max={totalDecisions} color="bg-blue-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Decisions by category */}
        <div className="rounded-xs transition-all duration-200">
          <Text as="h3">
            Decisions by Category
          </Text>
          <div className={cn("p-6 pt-0", "space-y-2")}>
            {decisionsByCategory.sort((a, b) => b._count.id - a._count.id).map((row) => (
              <div key={row.category} className="flex items-center gap-3">
                <div className="w-28 flex-shrink-0">
                  <Badge className={CATEGORY_COLORS[row.category] ?? "bg-slate-100 text-slate-600"}>
                    {getLabelForValue(CATEGORIES, row.category)}
                  </Badge>
                </div>
                <ProgressBar value={row._count.id} max={totalDecisions} color="bg-violet-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Action item funnel */}
        <div className="rounded-xs transition-all duration-200">
          <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
            <div className="flex items-center justify-between">
              <Text as="h3" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-blue-500" />
                Action Item Pipeline
              </Text>
              <Text>{completionRate}% done</Text>
            </div>
          </div>
          <div className={cn("p-6 pt-0", "space-y-2")}>
            {ACTION_ITEM_STATUSES.map((col) => {
              const count = actionItemsByStatus.find((s) => s.status === col.value)?._count.id ?? 0;
              return (
                <div key={col.value} className="flex items-center gap-3">
                  <Text as="span">{col.label}</Text>
                  <ProgressBar value={count} max={Math.max(totalActionItems, 1)} color="bg-emerald-500" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Team workload */}
        <div className="rounded-xs transition-all duration-200">
          <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
            <Text as="h3" className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Team Workload (open items)
            </Text>
          </div>
          <div className="p-6 pt-0">
            {memberWorkload.length === 0 ? (
              <Text as="p">No assigned items yet</Text>
            ) : (
              <div className="space-y-2">
                {memberWorkload.slice(0, 8).map((row) => {
                  const name = nameById[row.assigneeId ?? ""] ?? "Unknown";
                  return (
                    <div key={row.assigneeId} className="flex items-center gap-3">
                      <Text as="span">{name}</Text>
                      <ProgressBar
                        value={row._count.id}
                        max={memberWorkload[0]._count.id}
                        color={row._count.id >= 5 ? "bg-red-400" : "bg-blue-500"}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decision patterns */}
      {categoryPatterns.length > 0 && (
        <div className="rounded-xs transition-all duration-200">
          <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
            <Text as="h3" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Decision patterns by category
            </Text>
          </div>
          <div className="p-6 pt-0">
            <Text as="p">
              Which categories get reversed or stay unhealthy most often. Shows categories with 2+ decisions.
            </Text>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left pb-2">
                      <Text>Category</Text>
                    </th>
                    <th className="text-right pb-2">
                      <Text>Decisions</Text>
                    </th>
                    <th className="text-right pb-2">
                      <span className="flex items-center justify-end gap-1">
                        <RefreshCw className="h-3 w-3" />
                        <Text>
                          Reversal rate
                        </Text>
                      </span>
                    </th>
                    <th className="text-right pb-2">
                      <Text>Unhealthy rate</Text>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryPatterns.map((c) => (
                    <tr key={c.category}>
                      <td className="py-2 capitalize">
                        <Text>{c.category}</Text>
                      </td>
                      <td className="py-2 text-right">
                        <Text>{c.total}</Text>
                      </td>
                      <td className="py-2 text-right">
                        <Text>
                          {c.reversalRate}%
                        </Text>
                      </td>
                      <td className="py-2 text-right">
                        <Text>
                          {c.unhealthyRate}%
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recent activity feed */}
      <div className="rounded-xs transition-all duration-200">
        <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
          <Text as="h3" className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Activity (last 7 days)
          </Text>
        </div>
        <div className={cn("p-6 pt-0", "p-0")}>
          {recentActivity.length === 0 ? (
            <Text as="p">No activity in the last 7 days</Text>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivity.map((event) => (
                <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <Text as="div">
                    {event.user.name.charAt(0).toUpperCase()}
                  </Text>
                  <div className="flex-1 min-w-0">
                    <Text as="p">
                      <Text as="span">{event.user.name}</Text>{" "}
                      <Text as="span">{event.eventType.replace(/_/g, " ")}</Text>
                    </Text>
                    <Link href={`/decisions/${event.decision.id}`} className="hover:underline block">
                      <Text>
                        {event.decision.title}
                      </Text>
                    </Link>
                  </div>
                  <Text as="span">{formatDate(event.createdAt)}</Text>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
