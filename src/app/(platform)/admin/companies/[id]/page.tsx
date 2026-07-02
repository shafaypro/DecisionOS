import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Text } from "@/components/ui/text";
import { Badge, Dot } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CompanyActions } from "./company-actions";
import { MembersPanel } from "./members-panel";

export const dynamic = "force-dynamic";

export default async function PlatformCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { decisions: true } },
    },
  });

  if (!workspace) notFound();

  const suspended = workspace.status === "suspended";

  const facts = [
    { label: "Members", value: workspace.memberships.length },
    { label: "Decisions", value: workspace._count.decisions },
    { label: "Created", value: formatDate(workspace.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Text as={Link} href="/admin" size="sm" color="muted" className="flex w-fit items-center gap-1.5 hover:text-text-secondary">
        <ArrowLeft className="h-3.5 w-3.5" />
        All companies
      </Text>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#dbeafe] shadow-soft">
            <Text size="lg" weight="bold" color="brand">
              {workspace.name.charAt(0).toUpperCase()}
            </Text>
          </div>
          <div>
            <Text as="h1" size="xl" weight="semibold" color="primary" tracking="tight">
              {workspace.name}
            </Text>
            <Text as="p" size="sm" color="subtle" mono>
              {workspace.slug}
            </Text>
          </div>
          <Badge
            icon={<Dot className={suspended ? "bg-red-500" : "bg-emerald-500"} />}
            className={suspended ? "ml-1 text-red-600" : "ml-1 text-emerald-700"}
          >
            {suspended ? "suspended" : "active"}
          </Badge>
        </div>
        <CompanyActions workspaceId={workspace.id} name={workspace.name} slug={workspace.slug} suspended={suspended} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={`rounded-md border border-slate-200 bg-white px-5 py-4 shadow-soft transition-all duration-200 lift-card animate-enter animate-enter-delay-${(i % 4) + 1}`}
          >
            <Text as="p" size="2xs" color="muted" uppercase tracking="wide">
              {f.label}
            </Text>
            <Text as="p" size="lg" weight="bold" color="primary">
              {f.value}
            </Text>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center gap-2 border-b border-slate-100 p-5">
          <Users className="h-4 w-4 text-slate-700" />
          <Text size="base" weight="semibold" color="primary">
            Members
          </Text>
        </div>
        <MembersPanel
          workspaceId={workspace.id}
          members={workspace.memberships.map((m) => ({
            membershipId: m.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            joinedAt: m.joinedAt,
          }))}
        />
      </div>
    </div>
  );
}
