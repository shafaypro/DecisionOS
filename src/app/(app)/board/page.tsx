import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { KanbanBoard } from "./kanban-board";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Board" };

export default async function BoardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [items, members, decisions] = await Promise.all([
    prisma.actionItem.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      include: {
        assignee:  { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        decision:  { select: { id: true, title: true } },
      },
    }),
    prisma.workspaceMembership.findMany({
      where: { workspaceId: session.workspaceId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.decision.findMany({
      where: { ...decisionVisibilityWhere(session), status: { notIn: ["archived"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8 px-4 pb-8 pt-16 sm:px-8 lg:pt-8">
      <PageHeader
        title="Board"
        description={<>Action items across all decisions · {items.filter(i => i.status !== "done" && i.status !== "cancelled").length} open</>}
      />

      <KanbanBoard
        initialItems={items.map((i) => ({ ...i, dueDate: i.dueDate ? i.dueDate.toISOString() : null }))}
        members={members.map((m) => m.user)}
        decisions={decisions}
        currentUserId={session.userId}
        isViewer={session.role === "viewer"}
      />
    </div>
  );
}
