import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { cn, formatDate } from "@/lib/utils";
import { InviteMemberForm } from "./invite-member-form";
import { Shield, User, Users } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [workspace, memberships] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: session.workspaceId } }),
    prisma.workspaceMembership.findMany({
      where: { workspaceId: session.workspaceId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const isAdmin = session.role === "admin";
  const admins = memberships.filter((m) => m.role === "admin").length;
  const viewers = memberships.filter((m) => m.role === "viewer").length;

  return (
    <PageContainer>
      <PageHeader
        title="Team"
        description={`${memberships.length} member${memberships.length !== 1 ? "s" : ""} in ${workspace?.name ?? ""}`}
        actions={
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Members", value: memberships.length },
              { label: "Admins", value: admins },
              { label: "Viewers", value: viewers },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xs bg-white/80 px-4 py-3 shadow-soft backdrop-blur">
                <Text>
                  {stat.label}
                </Text>
                <Text>
                  {stat.value}
                </Text>
              </div>
            ))}
          </div>
        }
      />

      {isAdmin && (
        <div className="rounded-xs transition-all duration-200 lift-card animate-enter animate-enter-delay-1 overflow-hidden">
          <div className="h-1 w-full bg-[#2563eb]" />
          <div className={cn("flex flex-col space-y-1.5 p-6", "pb-4")}>
            <Text as="h3">
              Invite Team Member
            </Text>
            <Text as="p">
              Add teammates with the right level of access without breaking the flow of the workspace.
            </Text>
          </div>
          <div className="p-6 pt-0">
            <InviteMemberForm />
          </div>
        </div>
      )}

      <div className="rounded-xs transition-all duration-200 animate-enter animate-enter-delay-2 overflow-hidden">
        <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
          <Text as="h3">
            <Users className="h-4 w-4 text-slate-700" />
            Members
          </Text>
        </div>
        <div className={cn("p-6 pt-0", "p-0")}>
          <div className="divide-y divide-slate-100">
            {memberships.map((m, index) => {
              const isCurrentUser = m.user.id === session.userId;
              const roleTone =
                m.role === "admin"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : m.role === "viewer"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200";

              return (
                <div
                  key={m.id}
                  className="group flex flex-col gap-4 px-6 py-4 transition-colors duration-200 hover:bg-slate-50/80 sm:flex-row sm:items-center"
                  style={{ animationDelay: `${80 + index * 40}ms` }}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#dbeafe] shadow-soft">
                      <Text>
                        {m.user.name.charAt(0).toUpperCase()}
                      </Text>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Text>
                          {m.user.name}
                        </Text>
                        {isCurrentUser && (
                          <Text>
                            You
                          </Text>
                        )}
                      </div>
                      <Text>{m.user.email}</Text>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <Text>Joined {formatDate(m.joinedAt)}</Text>
                    <Badge className={roleTone}>
                      <Text>
                        {m.role === "admin" ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        <Text>
                          {m.role}
                        </Text>
                      </Text>
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
