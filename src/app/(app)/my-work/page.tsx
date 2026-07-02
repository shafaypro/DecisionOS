import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { cn, formatDate, formatRelativeDate, getLabelForValue, ACTION_ITEM_STATUSES, STATUS_COLORS, STATUSES } from "@/lib/utils";
import {
  CheckSquare, Calendar, AlertTriangle, FileText,
  Clock, Circle, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400", medium: "bg-amber-400", high: "bg-orange-500", critical: "bg-red-500",
};

export default async function MyWorkPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [myItems, overdueItems, myDecisions, upcomingReviews] = await Promise.all([
    // My open action items
    prisma.actionItem.findMany({
      where: {
        workspaceId: session.workspaceId,
        assigneeId: session.userId,
        status: { notIn: ["done", "cancelled"] },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      include: { decision: { select: { id: true, title: true } } },
    }),
    // Overdue items assigned to me
    prisma.actionItem.findMany({
      where: {
        workspaceId: session.workspaceId,
        assigneeId: session.userId,
        status: { notIn: ["done", "cancelled"] },
        dueDate: { lt: now },
      },
      include: { decision: { select: { id: true, title: true } } },
    }),
    // Decisions I own
    prisma.decision.findMany({
      where: {
        workspaceId: session.workspaceId,
        ownerUserId: session.userId,
        status: { notIn: ["archived"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    // My reviews due in next 7 days
    prisma.decision.findMany({
      where: {
        workspaceId: session.workspaceId,
        ownerUserId: session.userId,
        reviewDate: { gte: now, lte: nextWeek },
        reviewedAt: null,
      },
      orderBy: { reviewDate: "asc" },
    }),
  ]);


  return (
    <PageContainer>
      <PageHeader
        title="My Work"
        description={
          <>
            {myItems.length} open item{myItems.length !== 1 ? "s" : ""}
            {overdueItems.length > 0 && ` · `}
            {overdueItems.length > 0 && (
              <Text as="span">{overdueItems.length} overdue</Text>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: action items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overdue alert */}
          {overdueItems.length > 0 && (
            <div className="rounded-xs transition-all duration-200 border-red-200 bg-red-50">
              <div className={cn("p-6 pt-0", "p-4")}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <Text>
                    {overdueItems.length} overdue action item{overdueItems.length !== 1 ? "s" : ""}
                  </Text>
                </div>
                <div className="space-y-2">
                  {overdueItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-2">
                      <div className={`inline-block h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[item.priority] ?? "bg-slate-400"}`} />
                      <div className="flex-1 min-w-0">
                        <Text>{item.title}</Text>
                        {item.decision && (
                          <Text>↳ {item.decision.title}</Text>
                        )}
                      </div>
                      <Text as="span">
                        Due {formatDate(item.dueDate)}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* All open items */}
          <div className="rounded-xs transition-all duration-200">
            <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
              <div className="flex items-center justify-between">
                <Text as="h3" className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-blue-500" />
                  My Action Items
                </Text>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/board" className="flex items-center gap-1">
                    Open Board
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className={cn("p-6 pt-0", "p-0")}>
              {myItems.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckSquare className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <Text as="p">No open items assigned to you</Text>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myItems.map((item) => {
                    return (
                      <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                        <div className={`inline-block h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[item.priority] ?? "bg-slate-400"}`} />
                        <div className="flex-1 min-w-0">
                          <Text>{item.title}</Text>
                          {item.decision && (
                            <Link href={`/decisions/${item.decision.id}`}>
                              <Text as="span">
                                ↳ {item.decision.title}
                              </Text>
                            </Link>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Text as="span">
                            {getLabelForValue(ACTION_ITEM_STATUSES, item.status)}
                          </Text>
                          {item.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <Text>
                                {formatDate(item.dueDate)}
                              </Text>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: my decisions + upcoming reviews */}
        <div className="space-y-6">
          {/* Upcoming reviews */}
          {upcomingReviews.length > 0 && (
            <div className="rounded-xs transition-all duration-200 border-amber-200 bg-amber-50">
              <div className={cn("flex flex-col space-y-1.5 p-6", "pb-2")}>
                <Text as="h3" className="flex items-center gap-2 text-text-warning">
                  <Clock className="h-4 w-4" />
                  Reviews due this week
                </Text>
              </div>
              <div className={cn("p-6 pt-0", "p-0 pb-3")}>
                {upcomingReviews.map((d) => (
                  <Link
                    key={d.id}
                    href={`/decisions/${d.id}`}
                    className="flex items-start gap-2 px-4 py-2 hover:bg-amber-100 transition-colors"
                  >
                    <Circle className="h-3 w-3 text-amber-500 mt-1 flex-shrink-0" />
                    <div className="min-w-0">
                      <Text>{d.title}</Text>
                      <Text>{formatDate(d.reviewDate)}</Text>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* My decisions */}
          <div className="rounded-xs transition-all duration-200">
            <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
              <Text as="h3" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Decisions I Own
              </Text>
            </div>
            <div className={cn("p-6 pt-0", "p-0")}>
              {myDecisions.length === 0 ? (
                <Text as="p">
                  None assigned to you
                </Text>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myDecisions.map((d) => (
                    <Link
                      key={d.id}
                      href={`/decisions/${d.id}`}
                      className="flex items-start gap-2 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <Text>{d.title}</Text>
                        <Text as="span">{formatRelativeDate(d.updatedAt)}</Text>
                      </div>
                      <Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
                        {getLabelForValue(STATUSES, d.status)}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
