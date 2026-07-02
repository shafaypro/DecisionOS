import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, User, GitCommit } from "lucide-react";
import { formatDate, formatRelativeDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Text } from "@/components/ui/text";
import { EmptyState } from "@/components/ui/empty-state";

interface PageProps {
  params: Promise<{ id: string }>;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  status: "Status",
  category: "Category",
  summary: "Summary",
  impactLevel: "Impact level",
  ownerUserId: "Owner",
  problemStatement: "Problem statement",
  chosenOption: "Solution",
  rationale: "Rationale",
  alternativesConsidered: "Alternatives",
  assumptions: "Assumptions",
  risks: "Risks",
  reviewDate: "Review date",
  decisionDate: "Decision date",
  visibility: "Visibility",
};

function FieldDiff({
  label,
  before,
  after,
}: {
  label: string;
  before: string | null;
  after: string | null;
}) {
  if (before === after) return null;
  const empty = <Text as="span">empty</Text>;
  return (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-3">
      <Text as="span">{label}</Text>
      <Text as="div">{before ? before : empty}</Text>
      <Text as="div">{after ? after : empty}</Text>
    </div>
  );
}

export default async function DecisionHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const decision = await prisma.decision.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      versions: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { versionNum: "desc" },
      },
    },
  });

  if (!decision || decision.workspaceId !== session.workspaceId) notFound();

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href={`/decisions/${id}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to decision
        </Link>
      </Button>

      <div>
        <PageHeader
          title="Version history"
          description={
            <>
              <Text>{decision.title}</Text>
              {" · "}
              {decision.versions.length === 0
                ? "No edits recorded yet."
                : `${decision.versions.length} edit${decision.versions.length === 1 ? "" : "s"}`}
            </>
          }
        />
      </div>

      {decision.versions.length === 0 ? (
        <EmptyState
          icon={<GitCommit className="h-8 w-8 text-blue-400" />}
          title="No edits recorded"
          description="Every change made after this decision was first created will appear here."
        />
      ) : (
        <div className="relative">
          {/* Timeline spine */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

          <div className="space-y-4">
            {decision.versions.map((v, idx) => {
              let snap: Record<string, unknown> = {};
              let nextSnap: Record<string, unknown> = {};
              try { snap = JSON.parse(v.snapshotJson); } catch { /* empty */ }
              // The "next" version (lower index in desc-sorted array) is what
              // came *after* this one - it holds the field values after this edit.
              // Version 0 (current) diffs are shown via the current decision fields.
              const nextVersion = decision.versions[idx - 1];
              if (nextVersion) {
                try { nextSnap = JSON.parse(nextVersion.snapshotJson); } catch { /* empty */ }
              }

              const changedFields = Object.keys(FIELD_LABELS).filter(
                (f) => snap[f] !== undefined || nextSnap[f] !== undefined
              );

              return (
                <div key={v.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <Text as="div">v{v.versionNum}</Text>

                  <div className="rounded-xs transition-all duration-200 flex-1 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <Text>
                          {v.changedBy.name}
                        </Text>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <Text>{formatRelativeDate(v.createdAt)}</Text>
                        <Text>·</Text>
                        <Text>{formatDate(v.createdAt)}</Text>
                      </div>
                    </div>

                    {changedFields.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[120px_1fr_1fr] gap-3 mb-1">
                          <div />
                          <Text>Before</Text>
                          <Text>After</Text>
                        </div>
                        {changedFields.map((field) => (
                          <FieldDiff
                            key={field}
                            label={FIELD_LABELS[field]}
                            before={snap[field] != null ? String(snap[field]) : null}
                            after={nextSnap[field] != null ? String(nextSnap[field]) : null}
                          />
                        ))}
                      </div>
                    ) : (
                      <Text as="p">Snapshot saved (no field-level diff available)</Text>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Created marker */}
            <div className="relative flex gap-4">
              <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50">
                <GitCommit className="h-4 w-4 text-blue-400" />
              </div>
              <Text as="p">Decision created</Text>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
