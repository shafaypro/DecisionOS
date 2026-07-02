import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import {
  formatDate,
  STATUS_COLORS, OUTCOME_COLORS, STATUSES, OUTCOME_STATUSES, getLabelForValue,
} from "@/lib/utils";
import { GitBranch, User, Calendar, Clock, Lock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { publicShareLimiter } from "@/lib/rate-limit";

interface PageProps {
  params: Promise<{ id: string }>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <Text as="h3">
        {title}
      </Text>
      <Text as="div">
        {children}
      </Text>
    </div>
  );
}

export default async function ShareDecisionPage({ params }: PageProps) {
  const { id } = await params;

  // Rate-limit unauthenticated share views per IP to deter scrapers.
  const h = await headers();
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipKey = xff || h.get("x-real-ip")?.trim() || "unknown";
  const rl = await publicShareLimiter.check(ipKey);
  if (!rl.ok) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-10 w-10 text-text-subtle mx-auto mb-3" />
          <Text as="h2">
            Too many requests
          </Text>
          <Text as="p">
            Please slow down and try again in a minute.
          </Text>
        </div>
      </div>
    );
  }

  const decision = await prisma.decision.findUnique({
    where: { id },
    include: {
      workspace: { select: { name: true } },
      createdBy: { select: { name: true } },
      owner: { select: { name: true } },
      reviews: {
        include: { reviewedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!decision) notFound();

  if (decision.visibility !== "workspace") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-10 w-10 text-text-subtle mx-auto mb-3" />
          <Text as="h2">
            This decision is private
          </Text>
          <Text as="p">
            Only workspace members can view it.
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xs bg-blue-600">
              <GitBranch className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <Text>
                DecisionOS
              </Text>
              <Text>
                {decision.workspace.name}
              </Text>
            </div>
          </div>
          <Text as="span">
            Read-only shared view
          </Text>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Title & status */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className={STATUS_COLORS[decision.status] ?? "bg-slate-100 text-slate-600"}>
              {getLabelForValue(STATUSES, decision.status)}
            </Badge>
            {decision.outcomeStatus && (
              <Badge className={OUTCOME_COLORS[decision.outcomeStatus] ?? "bg-slate-100 text-slate-600"}>
                {getLabelForValue(OUTCOME_STATUSES, decision.outcomeStatus)}
              </Badge>
            )}
          </div>
          <Text as="h1">
            {decision.title}
          </Text>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-xs">
          <div>
            <Text as="p">
              Owner
            </Text>
            <p className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-text-subtle" />
              <Text>
                {decision.owner?.name ?? decision.createdBy.name}
              </Text>
            </p>
          </div>
          <div>
            <Text as="p">
              Created by
            </Text>
            <p className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-text-subtle" />
              <Text>
                {decision.createdBy.name}
              </Text>
            </p>
          </div>
          {decision.decisionDate && (
            <div>
              <Text as="p">
                Decision date
              </Text>
              <p className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-text-subtle" />
                <Text>
                  {formatDate(decision.decisionDate)}
                </Text>
              </p>
            </div>
          )}
          {decision.reviewDate && (
            <div>
              <Text as="p">
                Review date
              </Text>
              <p className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-text-subtle" />
                <Text>
                  {formatDate(decision.reviewDate)}
                </Text>
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Decision content */}
        <div className="space-y-6">
          {decision.rationale && (
            <div>
              <Text as="h3">
                Why / Rationale
              </Text>
              <Text as="div">
                {decision.rationale}
              </Text>
            </div>
          )}
          {decision.problemStatement && (
            <Section title="Problem Statement">{decision.problemStatement}</Section>
          )}
          {decision.chosenOption && (
            <Section title="Solution">{decision.chosenOption}</Section>
          )}
          {decision.alternativesConsidered && (
            <Section title="Alternatives">{decision.alternativesConsidered}</Section>
          )}
          {decision.assumptions && (
            <Section title="Assumptions">{decision.assumptions}</Section>
          )}
          {decision.risks && (
            <Section title="Risks">{decision.risks}</Section>
          )}
        </div>

        {/* Latest reviews */}
        {decision.reviews.length > 0 && (
          <div>
            <Text as="h3">
              Reviews
            </Text>
            <div className="space-y-3">
              {decision.reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-xs p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Text>
                      {review.reviewedBy.name}
                    </Text>
                    <div className="flex items-center gap-2">
                      <Badge className={OUTCOME_COLORS[review.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
                        {getLabelForValue(OUTCOME_STATUSES, review.outcomeStatus ?? "unknown")}
                      </Badge>
                      <Text>
                        {formatDate(review.createdAt)}
                      </Text>
                    </div>
                  </div>
                  {review.summary && (
                    <Text as="p">
                      {review.summary}
                    </Text>
                  )}
                  {review.lessonsLearned && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <Text as="p">
                        Lessons learned
                      </Text>
                      <Text as="p">
                        {review.lessonsLearned}
                      </Text>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />
        {/* CTA footer */}
        <div className="rounded-xs bg-blue-50 border border-blue-100 p-6 text-center">
          <Text as="p">
            Build your team&apos;s decision log
          </Text>
          <Text as="p">
            DecisionOS captures why decisions were made, so your team never loses institutional memory.
          </Text>
          <Text as="a" href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/signup`}>
            Start for free →
          </Text>
        </div>
        <Text as="p">
          Shared via{" "}
          <Text as="span">
            DecisionOS
          </Text>{" "}
          · Read-only · {formatDate(new Date())}
        </Text>
      </div>
    </div>
  );
}
