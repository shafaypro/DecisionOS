import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Verb phrases for the audited platform (provider) actions.
const PLATFORM_VERB: Record<string, string> = {
  "platform.workspace_entered": "entered",
  "platform.workspace_suspended": "changed the status of",
  "platform.workspace_renamed": "renamed",
  "platform.workspace_created": "created",
};

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = { event: { startsWith: "platform." } };

  const [events, total] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.analyticsEvent.count({ where }),
  ]);

  const userIds = [...new Set(events.map((e) => e.userId).filter(Boolean))] as string[];
  const wsIds = [...new Set(events.map((e) => e.workspaceId).filter(Boolean))] as string[];
  const [users, workspaces] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    prisma.workspace.findMany({ where: { id: { in: wsIds } }, select: { id: true, name: true } }),
  ]);
  const userName = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const wsName = Object.fromEntries(workspaces.map((w) => [w.id, w.name]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => (p > 1 ? `/admin/audit?page=${p}` : "/admin/audit");

  return (
    <div className="flex flex-col gap-6">
      <Text as={Link} href="/admin" size="sm" color="muted" className="flex w-fit items-center gap-1.5 hover:text-text-secondary">
        <ArrowLeft className="h-3.5 w-3.5" />
        All companies
      </Text>

      <div>
        <Text as="h1" size="xl" weight="semibold" color="primary" tracking="tight">Platform audit log</Text>
        <Text as="p" size="sm" color="subtle">Every cross-tenant staff action, most recent first.</Text>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
        {events.length === 0 ? (
          <div className="p-8 text-center">
            <Text as="p" color="muted">No platform actions recorded yet.</Text>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Text as="p" color="secondary">
                  <Text as="span" weight="semibold" color="primary">{userName[e.userId ?? ""] ?? "A staff member"}</Text>{" "}
                  {PLATFORM_VERB[e.event] ?? e.event.replace("platform.", "").replace(/_/g, " ")}{" "}
                  <Text as="span" weight="medium" color="primary">{wsName[e.workspaceId ?? ""] ?? "a company"}</Text>
                </Text>
                <Text as="span" size="xs" color="subtle" className="shrink-0">{formatRelativeDate(e.createdAt)}</Text>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Text as="span" size="sm" color="muted">Page {page} of {totalPages} · {total} actions</Text>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild><Link href={pageHref(page - 1)}>Previous</Link></Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Previous</Button>
            )}
            {page < totalPages ? (
              <Button variant="outline" size="sm" asChild><Link href={pageHref(page + 1)}>Next</Link></Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Next</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
