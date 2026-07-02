import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge, Dot } from "@/components/ui/badge";
import { computeDecisionHealth, HEALTH_META } from "@/lib/decision-health";
import { NoteForm } from "./note-form";
import { LinkForm } from "./link-form";
import { ReviewForm } from "./review-form";
import { DeleteNoteButton } from "./delete-note-button";
import { DeleteLinkButton } from "./delete-link-button";
import { RelationForm } from "./relation-form";
import { Row } from "./row";
import { DecisionActions } from "./decision-actions";
import { WatchButton } from "./watch-button";
import { ReactionsBar } from "./reactions-bar";
import { EditableText, EditableField, EditableStatus, EditableSelect, EditableDate } from "./editable";
import {
  User, Calendar, Clock,
  ExternalLink, Activity, Network,
} from "lucide-react";
import {
  cn, formatDate, formatRelativeDate, LINK_TYPES, getLabelForValue,
  STATUS_COLORS, OUTCOME_COLORS, STATUSES, OUTCOME_STATUSES, blastRadiusTone,
} from "@/lib/utils";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Text } from "@/components/ui/text";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

interface PageProps {
  params: Promise<{ id: string }>;
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <Text as="h3">{title}</Text>
      {children}
    </div>
  );
}

/** A labelled decision field: inline-editable for editors, read-only for viewers. */
function Field({
  decisionId, field, label, value, isViewer,
}: {
  decisionId: string;
  field: string;
  label: string;
  value: string | null;
  isViewer: boolean;
}) {
  if (isViewer && !value) return null;
  if (isViewer) {
    return (
      <Section title={label}>
        <Text as="div" className="whitespace-pre-wrap leading-relaxed">{value}</Text>
      </Section>
    );
  }
  return (
    <EditableField
      decisionId={decisionId}
      field={field}
      label={label}
      value={value}
      placeholder={`Add ${label.toLowerCase()}…`}
    />
  );
}

const EVENT_LABELS: Record<string, string> = {
  created: "created this decision",
  updated: "updated this decision",
  status_changed: "changed the status",
  owner_changed: "changed the owner",
  review_scheduled: "scheduled a review",
  reviewed: "submitted a review",
  note_added: "added a note",
  link_added: "added a link",
};

export default async function DecisionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const isViewer = session.role === "viewer";

  const [decision, workspaceDecisions, memberships] = await Promise.all([
    prisma.decision.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        notes: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        links: {
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        reviews: {
          include: { reviewedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        events: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        relationsFrom: {
          include: { toDecision: { select: { id: true, title: true, status: true } } },
        },
        relationsTo: {
          include: { fromDecision: { select: { id: true, title: true, status: true } } },
        },
        reactions: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.decision.findMany({
      where: { workspaceId: session.workspaceId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.workspaceMembership.findMany({
      where: { workspaceId: session.workspaceId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  if (!decision || decision.workspaceId !== session.workspaceId) {
    notFound();
  }

  const watcher = await prisma.decisionWatcher.findUnique({
    where: { decisionId_userId: { decisionId: id, userId: session.userId } },
    select: { id: true },
  });
  const isWatching = !!watcher;

  const isReviewDue =
    decision.reviewDate &&
    new Date(decision.reviewDate) <= new Date() &&
    !decision.reviewedAt;

  // Blast radius = inbound depends_on relations (other decisions depend on this).
  const blastRadius = decision.relationsTo.filter(
    (r) => r.relationType === "depends_on"
  ).length;

  const health = computeDecisionHealth({
    status: decision.status,
    ownerUserId: decision.ownerUserId,
    reviewDate: decision.reviewDate,
    reviewedAt: decision.reviewedAt,
    updatedAt: decision.updatedAt,
    reviewCount: decision.reviews.length,
  });
  const healthMeta = HEALTH_META[health];

  return (
    <PageContainer>
      {/* Breadcrumbs + action bar on one row */}
      <div className="flex items-center justify-between gap-4">
        <Breadcrumbs />
        <div className="flex items-center gap-2">
          <WatchButton decisionId={id} initialWatching={isWatching} />
          {!isViewer && (
            <DecisionActions
              decisionId={id}
              title={decision.title}
              rationale={decision.rationale}
              capturedBy={decision.createdBy.name}
              capturedOn={formatDate(decision.createdAt)}
              status={decision.status}
              workspaceDecisions={workspaceDecisions.map((d) => ({ id: d.id, title: d.title }))}
            />
          )}
        </div>
      </div>

      {/* Review due banner */}
      {isReviewDue && (
        <div className="flex items-center gap-2 rounded-xs bg-amber-50 border border-amber-200 px-4 py-3">
          <Clock className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <Text>
            This decision is due for review (since {formatDate(decision.reviewDate)})
          </Text>
          <Link href="/reviews" className="ml-auto hover:underline">
            <Text>Go to Reviews →</Text>
          </Link>
        </div>
      )}

      {/* Viewer banner */}
      {isViewer && (
        <div className="flex items-center gap-2 rounded-xs bg-slate-50 px-4 py-3">
          <Text>
            You have viewer access. This decision is read-only.
          </Text>
        </div>
      )}

      {/* Header - aligned to the 2-7-3 grid: title at col 3, actions in sidebar region */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-b border-slate-200 pt-1 pb-5">
        <div className="min-w-0 lg:col-start-3 lg:col-span-7">
          {isViewer ? (
            <Text as="h1" size="xl" weight="bold" color="primary">{decision.title}</Text>
          ) : (
            <EditableText
              decisionId={id}
              field="title"
              value={decision.title}
              placeholder="Untitled decision"
              variant="title"
            />
          )}

          {/* Emoji reactions */}
          <div className="mt-4">
            <ReactionsBar
              decisionId={id}
              currentUserId={session.userId}
              readOnly={isViewer}
              initialReactions={decision.reactions.map((r) => ({
                emoji: r.emoji,
                user: { id: r.user.id, name: r.user.name },
              }))}
            />
          </div>
        </div>
      </div>

      {/* Twelve-column layout: main content (8) + right column (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main content - label(2)+value(7); sidebar takes the last 3 */}
        <div className="lg:col-span-9 space-y-6 pt-2">

          <Field decisionId={id} isViewer={isViewer} field="problemStatement" label="Problem" value={decision.problemStatement} />
          <Field decisionId={id} isViewer={isViewer} field="chosenOption" label="Solution" value={decision.chosenOption} />
          <Field decisionId={id} isViewer={isViewer} field="rationale" label="Why" value={decision.rationale} />
          <Field decisionId={id} isViewer={isViewer} field="alternativesConsidered" label="Alternatives" value={decision.alternativesConsidered} />
          <Field decisionId={id} isViewer={isViewer} field="assumptions" label="Assumptions" value={decision.assumptions} />
          <Field decisionId={id} isViewer={isViewer} field="risks" label="Risks" value={decision.risks} />

          {/* Separator below the fields - spans the full 9-col content area */}
          <hr className="border-slate-200" />

          {/* Reviews - label (2 cols) + content (7 cols), like fields */}
          <Row label="Reviews">
              {!isViewer && <ReviewForm decisionId={id} />}
              {decision.reviews.length > 0 && (
                <div className="space-y-3">
                {decision.reviews.map((review) => (
                  <div key={review.id} className="flex gap-3">
                    <Avatar>
                      <AvatarFallback>{review.reviewedBy.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 py-0.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Text weight="medium">{review.reviewedBy.name}</Text>
                        <Badge className={OUTCOME_COLORS[review.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
                          {getLabelForValue(OUTCOME_STATUSES, review.outcomeStatus ?? "unknown")}
                        </Badge>
                        <Text color="subtle">{formatRelativeDate(review.createdAt)}</Text>
                      </div>
                      {review.summary && <Text as="p">{review.summary}</Text>}
                      {review.lessonsLearned && (
                        <Text as="p" size="xs" color="muted" className="mt-1">
                          <Text as="span" size="xs" weight="semibold" color="muted">Lessons learned:</Text> {review.lessonsLearned}
                        </Text>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              )}
          </Row>

          {/* Relations - label + add trigger */}
          {!isViewer && (
            <Row label="Relations">
              <RelationForm decisionId={id} workspaceDecisions={workspaceDecisions} />
            </Row>
          )}

          {/* Notes - label (2 cols) + content (7 cols), like fields */}
          <Row label="Notes">
              {!isViewer && <NoteForm decisionId={id} />}
              {decision.notes.length > 0 && (
                <div className="space-y-3">
                {decision.notes.map((note) => (
                  <div key={note.id} className="flex gap-3 group">
                    <Avatar>
                      <AvatarFallback>{note.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Text weight="medium">{note.user.name}</Text>
                        <Text className="text-text-subtle">{formatRelativeDate(note.createdAt)}</Text>
                        {!isViewer && (
                          <DeleteNoteButton
                            noteId={note.id}
                            isOwner={note.user.id === session.userId || session.role === "admin"}
                          />
                        )}
                      </div>
                      <Text as="p">{note.content}</Text>
                    </div>
                  </div>
                ))}
                </div>
              )}
          </Row>
        </div>

        {/* Right column (4/12) */}
        <div className="lg:col-start-10 lg:col-span-3 space-y-6 pt-5 text-text-subtle">
          {/* Meta + badges */}
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              {isViewer ? (
                <Badge className={STATUS_COLORS[decision.status] ?? "bg-slate-100 text-slate-600"}>
                  {getLabelForValue(STATUSES, decision.status)}
                </Badge>
              ) : (
                <EditableStatus decisionId={id} value={decision.status} />
              )}
              <Badge className={healthMeta.tone} title={healthMeta.hint} icon={<Dot className={healthMeta.dot} />}>
                {healthMeta.label}
              </Badge>
              {blastRadius > 0 && (
                <Badge
                  href={`/decisions/${id}#relations`}
                  title={blastRadius === 1 ? "1 decision depends on this" : `${blastRadius} decisions depend on this`}
                  className={blastRadiusTone(blastRadius)}
                  icon={<Network className="h-3 w-3" />}
                >
                  Blast radius: {blastRadius}
                </Badge>
              )}
            </div>
            <div className="pt-4">
              {isViewer ? (
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-text-subtle" />
                  <Text color="secondary">{decision.owner?.name ?? decision.createdBy.name}</Text>
                </span>
              ) : (
                <EditableSelect
                  decisionId={id}
                  field="ownerUserId"
                  value={decision.ownerUserId}
                  placeholder="No owner"
                  icon={<User className="h-3.5 w-3.5 text-text-subtle" />}
                  options={memberships.map((m) => ({ value: m.user.id, label: m.user.name }))}
                />
              )}
            </div>
            {isViewer ? (
              decision.decisionDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-text-subtle" />
                  <Text color="secondary">{formatDate(decision.decisionDate)}</Text>
                </span>
              )
            ) : (
              <EditableDate
                decisionId={id}
                field="decisionDate"
                value={decision.decisionDate ? new Date(decision.decisionDate).toISOString() : null}
                icon={<Calendar className="h-3.5 w-3.5 text-text-subtle" />}
              />
            )}

            {isViewer ? (
              decision.reviewDate && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-text-subtle" />
                  <Text color="secondary">Review: {formatDate(decision.reviewDate)}</Text>
                </span>
              )
            ) : (
              <EditableDate
                decisionId={id}
                field="reviewDate"
                value={decision.reviewDate ? new Date(decision.reviewDate).toISOString() : null}
                icon={<Clock className="h-3.5 w-3.5 text-text-subtle" />}
                prefix="Review:"
              />
            )}
          </div>

          {/* Decision relations (inline list) */}
          {(decision.relationsFrom.length > 0 || decision.relationsTo.length > 0) && (
            <div id="relations">
              <Section title="Related decisions">
              <div className="space-y-1.5">
                {decision.relationsFrom.map((r) => (
                  <div key={r.id}>
                    <Text>{r.relationType.replace("_", " ")}: </Text>
                    <Link href={`/decisions/${r.toDecision.id}`} className="hover:underline inline">
                      <Text>{r.toDecision.title}</Text>
                    </Link>
                  </div>
                ))}
                {decision.relationsTo.map((r) => (
                  <div key={r.id}>
                    <Text>Referenced by: </Text>
                    <Link href={`/decisions/${r.fromDecision.id}`} className="hover:underline inline">
                      <Text>{r.fromDecision.title}</Text>
                    </Link>
                  </div>
                ))}
              </div>
              </Section>
            </div>
          )}

          {/* Links */}
          <Section title="Links" className="pb-6">
            <div className="space-y-3">
              {decision.links.length > 0 && (
                <div className="space-y-1">
                  {decision.links.map((link) => (
                    <div key={link.id} className="flex items-center gap-1 group">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-1.5 rounded-xs hover:bg-slate-50 flex-1 min-w-0 text-inherit"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <Text as="p">{link.label}</Text>
                          <Text as="p">{getLabelForValue(LINK_TYPES, link.linkType)}</Text>
                        </div>
                      </a>
                      {!isViewer && (
                        <DeleteLinkButton
                          linkId={link.id}
                          isOwner={link.createdBy.id === session.userId || session.role === "admin"}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isViewer && <LinkForm decisionId={id} />}
            </div>
          </Section>

          {/* Activity log */}
          <Section title="Activity" className="pb-6">
            <div>
              {decision.events.length === 0 ? (
                <EmptyState icon={<Activity className="h-7 w-7 text-blue-400" />} title="No activity yet" tile={false} />
              ) : (
                <div className="space-y-3">
                  {decision.events.map((event) => {
                    let detail = "";
                    if (event.eventType === "status_changed" && event.newValueJson) {
                      try {
                        const val = JSON.parse(event.newValueJson);
                        detail = `→ ${val.status}`;
                      } catch { /* empty */ }
                    }
                    return (
                      <div key={event.id} className="flex gap-2">
                        <Avatar>
                          <AvatarFallback>{event.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <Text>{event.user.name} </Text>
                          <Text>
                            {EVENT_LABELS[event.eventType] ?? event.eventType}
                          </Text>
                          {detail && <Text> {detail}</Text>}
                          <Text as="p">{formatRelativeDate(event.createdAt)}</Text>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          <Text as="p" size="xs" color="subtle">
            Last updated {formatRelativeDate(decision.updatedAt)}
          </Text>
        </div>
      </div>
    </PageContainer>
  );
}
