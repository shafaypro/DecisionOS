import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TemplateManager } from "./template-manager";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

export default async function TemplatesSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/settings");

  const templates = await prisma.decisionTemplate.findMany({
    where: { OR: [{ workspaceId: null }, { workspaceId: session.workspaceId }] },
    orderBy: [{ isBuiltIn: "desc" }, { category: "asc" }, { name: "asc" }],
  });

  return (
    <PageContainer>
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
        <PageHeader
          title="Decision Templates"
          description="Create and manage templates that pre-fill decision fields for common use cases."
        />
      </div>

      <TemplateManager initialTemplates={templates} />
    </PageContainer>
  );
}
