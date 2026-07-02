import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DecisionForm } from "../_forms/decision-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

interface PageProps {
  searchParams: Promise<{ supersedes?: string }>;
}

export default async function NewDecisionPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;

  const [memberships, supersedes] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { workspaceId: session.workspaceId },
      include: { user: { select: { id: true, name: true } } },
    }),
    sp.supersedes
      ? prisma.decision.findUnique({
          where: { id: sp.supersedes },
          select: { id: true, title: true, workspaceId: true },
        })
      : Promise.resolve(null),
  ]);

  const members = memberships.map((m) => m.user);
  const today = new Date().toISOString().split("T")[0];

  // Only honor supersedes if it's in the current workspace
  const supersedesValid = supersedes && supersedes.workspaceId === session.workspaceId ? supersedes : null;

  return (
    <PageContainer>
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/decisions">
            <ArrowLeft className="h-4 w-4" />
            Back to Decisions
          </Link>
        </Button>
        <PageHeader
          title={supersedesValid ? "Log a replacement decision" : "Log a Decision"}
          description="Capture what was decided, why, and who owns it, before the reasoning disappears"
        />
      </div>

      <DecisionForm
        members={members}
        defaultValues={{ decisionDate: today }}
        supersedesId={supersedesValid?.id}
        supersedesTitle={supersedesValid?.title}
      />
    </PageContainer>
  );
}
