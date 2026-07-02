import Link from "next/link";
import { Building2, Users, Ban, ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { WorkspaceTable } from "@/components/platform/workspace-table";

export const dynamic = "force-dynamic";

/**
 * Platform console home - aggregate overview + every company (workspace) on the
 * instance. These queries are intentionally cross-tenant (no `workspaceWhere`);
 * the route group is staff-only, gated by the proxy and the layout.
 */
export default async function PlatformHomePage() {
  const [workspaces, userCount] = await Promise.all([
    prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        _count: { select: { memberships: true, decisions: true } },
      },
    }),
    prisma.user.count(),
  ]);

  const rows = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    status: w.status,
    members: w._count.memberships,
    decisions: w._count.decisions,
  }));

  const suspended = workspaces.filter((w) => w.status === "suspended").length;

  const stats = [
    { label: "Companies", value: workspaces.length, icon: Building2, tone: "text-blue-500" },
    { label: "Users", value: userCount, icon: Users, tone: "text-emerald-500" },
    { label: "Suspended", value: suspended, icon: Ban, tone: "text-rose-500" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Text as="h1" size="xl" weight="semibold" color="primary" tracking="tight">
            Overview
          </Text>
          <Text size="sm" color="muted">
            {rows.length} {rows.length === 1 ? "company" : "companies"} on this instance. Enter one to
            manage it as an admin, or suspend it here.
          </Text>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/admin/audit" className="flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5" />
            Audit log
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`flex items-center gap-4 rounded-md border border-slate-200 bg-white px-5 py-4 shadow-soft transition-all duration-200 lift-card animate-enter animate-enter-delay-${i + 1}`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 shadow-soft">
                <Icon className={`h-5 w-5 ${stat.tone}`} />
              </div>
              <div>
                <Text as="p" size="2xs" color="muted" uppercase tracking="wide">
                  {stat.label}
                </Text>
                <Text as="p" size="xl" weight="bold" color="primary">
                  {stat.value}
                </Text>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <Text as="h2" size="base" weight="semibold" color="primary">
          Companies
        </Text>
        <WorkspaceTable workspaces={rows} />
      </div>
    </div>
  );
}
