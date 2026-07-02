import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/utils";
import { ActivityFilters } from "./activity-filters";
import { ACTIVITY_EVENT_TYPES, activityEventVerb, type ActivityEventType } from "@/lib/activity-events";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; user?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const type = ACTIVITY_EVENT_TYPES.includes(sp.type as ActivityEventType) ? sp.type : undefined;
  const user = sp.user || undefined;

  const where = {
    decision: { workspaceId: session.workspaceId },
    ...(type ? { eventType: type } : {}),
    ...(user ? { userId: user } : {}),
  };

  const [events, total, members] = await Promise.all([
    prisma.decisionEvent.findMany({
      where,
      include: {
        user: { select: { name: true } },
        decision: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.decisionEvent.count({ where }),
    prisma.workspaceMembership.findMany({
      where: { workspaceId: session.workspaceId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const memberList = members.map((m) => ({ id: m.user.id, name: m.user.name }));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number) {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (user) q.set("user", user);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/activity?${s}` : "/activity";
  }

  return (
    <PageContainer>
      <PageHeader title="Activity" description="An audit trail of changes across your workspace's decisions." />

      <ActivityFilters members={memberList} />

      <div className="mt-4 overflow-hidden rounded-xs border border-slate-200 bg-white shadow-soft">
        {events.length === 0 ? (
          <div className="p-8 text-center">
            <Text as="p" color="muted">No activity matches these filters yet.</Text>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Text as="p" color="secondary">
                  <Text as="span" weight="semibold" color="primary">{e.user.name}</Text>{" "}
                  {activityEventVerb(e.eventType)}{" "}
                  <Text as={Link} href={`/decisions/${e.decision.id}`} color="brand">
                    {e.decision.title}
                  </Text>
                </Text>
                <Text as="span" size="xs" color="subtle" className="shrink-0">
                  {formatRelativeDate(e.createdAt)}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Text as="span" size="sm" color="muted">Page {page} of {totalPages} · {total} events</Text>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page - 1)}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Previous</Button>
            )}
            {page < totalPages ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page + 1)}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Next</Button>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
