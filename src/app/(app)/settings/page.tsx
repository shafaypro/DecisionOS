import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { GitBranch, Settings2, Plug, Lock, ShieldCheck } from "lucide-react";
import { UpdateWorkspaceForm } from "./update-workspace-form";
import { AccountData } from "./account-data";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    include: {
      _count: {
        select: { memberships: true, decisions: true },
      },
    },
  });

  if (!workspace) redirect("/login");

  const isAdmin = session.role === "admin";

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Workspace configuration" />

      {/* Workspace info */}
      <div className="rounded-xs transition-all duration-200">
        <div className="flex flex-col space-y-1.5 p-6">
          <Text as="h3" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Workspace
          </Text>
          <Text as="p">Basic information about your workspace</Text>
        </div>
        <div className={cn("p-6 pt-0", "space-y-4")}>
          {isAdmin ? (
            <UpdateWorkspaceForm
              currentName={workspace.name}
              currentSlug={workspace.slug}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text>Name</Text>
                <Text>{workspace.name}</Text>
              </div>
              <div>
                <Text>Slug</Text>
                <Text>{workspace.slug}</Text>
              </div>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Text>{workspace._count.memberships}</Text>
              <Text>Members</Text>
            </div>
            <div>
              <Text>{workspace._count.decisions}</Text>
              <Text>Decisions</Text>
            </div>
            <div>
              <Text>{formatDate(workspace.createdAt)}</Text>
              <Text>Created</Text>
            </div>
          </div>
        </div>
      </div>

      {/* Admin-only settings */}
      {isAdmin && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xs transition-all duration-200 transition-colors">
            <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
              <Text as="h3" className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-blue-500" />
                Integrations
              </Text>
              <Text as="p">
                Slack capture and review reminders for the core decision workflow.
              </Text>
            </div>
            <div className={cn("p-6 pt-0", "pt-0")}>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/integrations">
                  Manage Integrations
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-xs transition-all duration-200 transition-colors">
            <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
              <Text as="h3" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-500" />
                Single Sign-On
              </Text>
              <Text as="p">
                Connect an OIDC identity provider (Okta, Google Workspace, Azure AD, …).
              </Text>
            </div>
            <div className={cn("p-6 pt-0", "pt-0")}>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/sso">
                  Configure SSO
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-xs transition-all duration-200 transition-colors">
            <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
              <Text as="h3" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                Audit log
              </Text>
              <Text as="p">
                Tamper-evident record of sign-ins, membership, and configuration changes.
              </Text>
            </div>
            <div className={cn("p-6 pt-0", "pt-0")}>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/audit">
                  View audit log
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Account info */}
      <div className="rounded-xs transition-all duration-200">
        <div className="flex flex-col space-y-1.5 p-6">
          <Text as="h3" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Your Account
          </Text>
        </div>
        <div className="p-6 pt-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Text>Name</Text>
              <Text>{session.name}</Text>
            </div>
            <div>
              <Text>Email</Text>
              <Text>{session.email}</Text>
            </div>
            <div>
              <Text>Role</Text>
              <Text>{session.role}</Text>
            </div>
          </div>

          <Separator />

          <AccountData isAdmin={isAdmin} workspaceName={workspace.name} />
        </div>
      </div>
    </PageContainer>
  );
}
