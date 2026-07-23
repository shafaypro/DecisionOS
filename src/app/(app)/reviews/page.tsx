import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { cn,
  formatDate,
  STATUS_COLORS, OUTCOME_COLORS, STATUSES, OUTCOME_STATUSES, getLabelForValue,
} from "@/lib/utils";
import { Clock, CheckCircle2, ClipboardCheck, AlertTriangle } from "lucide-react";
import { InlineReviewButtons } from "@/components/reviews/inline-review-buttons";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

export default async function ReviewsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspaceId = session.workspaceId;
  const isViewer = session.role === "viewer";
  const now = new Date();

  const [overdue, upcoming, recentlyReviewed, allReviews] = await Promise.all([
    // Overdue: reviewDate past, not yet reviewed, not archived/superseded
    prisma.decision.findMany({
      where: {
        workspaceId,
        reviewDate: { lte: now },
        reviewedAt: null,
        status: { notIn: ["archived", "superseded"] },
      },
      orderBy: { reviewDate: "asc" },
      include: { owner: { select: { name: true } } },
    }),
    // Upcoming (next 60 days)
    prisma.decision.findMany({
      where: {
        workspaceId,
        reviewDate: {
          gt: now,
          lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        },
        reviewedAt: null,
        status: { notIn: ["archived", "superseded"] },
      },
      orderBy: { reviewDate: "asc" },
      include: { owner: { select: { name: true } } },
    }),
    // Recently reviewed (last 30 days)
    prisma.decision.findMany({
      where: {
        workspaceId,
        reviewedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      include: { owner: { select: { name: true } } },
    }),
    // All review records
    prisma.decisionReview.findMany({
      where: { decision: { workspaceId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        reviewedBy: { select: { name: true } },
        decision: { select: { id: true, title: true } },
      },
    }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Reviews"
        description="Track which decisions need revisiting. Were they the right call?"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xs transition-all duration-200">
          <div className={cn("p-6 pt-0", "p-5")}>
            <div className="p-2 rounded-xs bg-red-50 w-fit mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <Text as="p">{overdue.length}</Text>
            <Text as="p">Overdue</Text>
          </div>
        </div>
        <div className="rounded-xs transition-all duration-200">
          <div className={cn("p-6 pt-0", "p-5")}>
            <div className="p-2 rounded-xs bg-amber-50 w-fit mb-2">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <Text as="p">{upcoming.length}</Text>
            <Text as="p">Upcoming (60 days)</Text>
          </div>
        </div>
        <div className="rounded-xs transition-all duration-200">
          <div className={cn("p-6 pt-0", "p-5")}>
            <div className="p-2 rounded-xs bg-green-50 w-fit mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <Text as="p">{recentlyReviewed.length}</Text>
            <Text as="p">Reviewed (30 days)</Text>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Overdue */}
        <div>
          <Text as="h2" className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Overdue Reviews
          </Text>
          {overdue.length === 0 ? (
            <div className="rounded-xs transition-all duration-200">
              <div className={cn("p-6 pt-0", "p-8 text-center")}>
                <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
                <Text as="p">All caught up, no overdue reviews</Text>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {overdue.map((d) => (
                <div key={d.id} className="rounded-xs transition-all duration-200 border-red-200">
                  <div className={cn("p-6 pt-0", "p-4")}>
                    <Link href={`/decisions/${d.id}`} className="block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <Text as="p">
                            {d.title}
                          </Text>
                          <Text as="p">
                            Overdue since {formatDate(d.reviewDate)}
                          </Text>
                          <Text as="p">
                            Owner: {d.owner?.name ?? "-"}
                          </Text>
                        </div>
                        <Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
                          {getLabelForValue(STATUSES, d.status)}
                        </Badge>
                      </div>
                    </Link>
                    {!isViewer && <InlineReviewButtons decisionId={d.id} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div>
          <Text as="h2" className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Upcoming Reviews
          </Text>
          {upcoming.length === 0 ? (
            <div className="rounded-xs transition-all duration-200">
              <Text as="p">No reviews scheduled in the next 60 days</Text>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((d) => (
                <Link key={d.id} href={`/decisions/${d.id}`}>
                  <div className="rounded-xs transition-all duration-200 transition-shadow cursor-pointer">
                    <div className={cn("p-6 pt-0", "p-4")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <Text as="p">{d.title}</Text>
                          <Text as="p">
                            Due {formatDate(d.reviewDate)}
                          </Text>
                          <Text as="p">
                            Owner: {d.owner?.name ?? "-"}
                          </Text>
                        </div>
                        <Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
                          {getLabelForValue(STATUSES, d.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent review history */}
      {allReviews.length > 0 && (
        <div>
          <Text as="h2" className="mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-blue-500" />
            Recent Review Activity
          </Text>
          <div className="rounded-xs transition-all duration-200">
            <div className="divide-y divide-slate-100">
              {allReviews.map((review) => (
                <div key={review.id} className="flex items-center gap-4 px-5 py-3">
                  <Badge className={OUTCOME_COLORS[review.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
                    {getLabelForValue(OUTCOME_STATUSES, review.outcomeStatus ?? "unknown")}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <Link href={`/decisions/${review.decision.id}`}>
                      <Text as="span">
                        {review.decision.title}
                      </Text>
                    </Link>
                    {review.summary && (
                      <Text as="p">{review.summary}</Text>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Text as="p">{review.reviewedBy.name}</Text>
                    <Text as="p">{formatDate(review.createdAt)}</Text>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
