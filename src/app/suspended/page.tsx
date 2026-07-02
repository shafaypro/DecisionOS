import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logout } from "@/actions/auth";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/**
 * Shown to members of a workspace the platform has suspended. Lives outside the
 * (app) route group so the layout's suspension redirect can't loop. If the
 * workspace is active again, bounce back into the app.
 */
export default async function SuspendedPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { name: true, status: true },
  });
  if (!workspace || workspace.status !== "suspended") redirect("/decisions");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-md border border-slate-200 bg-white p-8 text-center shadow-soft">
        <Text as="h1" size="xl" weight="semibold" color="primary" tracking="tight">
          Workspace suspended
        </Text>
        <Text size="sm" color="muted">
          Access to <strong>{workspace.name}</strong> has been paused by the DecisionOS team.
          Please contact your administrator or DecisionOS support to restore access.
        </Text>
        <form action={logout}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
