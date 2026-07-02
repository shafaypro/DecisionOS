import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { CommandPalette } from "@/components/search/command-palette";
import { ToastProvider } from "@/components/ui/toast";
import { ShortcutsOverlay } from "@/components/ui/shortcuts-overlay";
import { isPlatformAdmin } from "@/lib/auth-guards";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const actingAsPlatform = isPlatformAdmin(session.platformRole);
  const impersonating =
    actingAsPlatform && session.platformHomeWorkspaceId !== undefined &&
    session.platformHomeWorkspaceId !== session.workspaceId;

  const now = new Date();
  const [workspace, reviewsDue] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: session.workspaceId } }),
    prisma.decision.count({
      where: {
        workspaceId: session.workspaceId,
        reviewDate: { lte: now },
        reviewedAt: null,
        status: { notIn: ["archived", "superseded"] },
        OR: [{ ownerUserId: session.userId }, { createdByUserId: session.userId }],
      },
    }),
  ]);

  if (!workspace) redirect("/login");

  // A suspended company is locked out for its own members, but a platform admin
  // who has entered it (to investigate / reactivate) keeps access.
  if (workspace.status === "suspended" && !actingAsPlatform) redirect("/suspended");

  return (
    <ToastProvider>
      {impersonating && <ImpersonationBanner workspaceName={workspace.name} />}
      <AppShell
        workspaceName={workspace.name}
        userName={session.name}
        userEmail={session.email}
        reviewsDue={reviewsDue}
        isPlatformAdmin={actingAsPlatform}
      >
        {children}
      </AppShell>
      <CommandPalette />
      <ShortcutsOverlay />
    </ToastProvider>
  );
}
