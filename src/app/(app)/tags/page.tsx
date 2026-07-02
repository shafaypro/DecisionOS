import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Tag } from "lucide-react";
import { Text } from "@/components/ui/text";
import { CreateTagForm } from "./create-tag-form";
import { DeleteTagButton } from "./delete-tag-button";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

export default async function TagsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tags = await prisma.tag.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { name: "asc" },
    include: { _count: { select: { decisions: true } } },
  });

  const isAdmin = session.role === "admin";

  return (
    <PageContainer>
      <PageHeader title="Tags" description="Organize decisions with tags across your workspace." />

      {isAdmin && (
        <div className="rounded-xs transition-all duration-200">
          <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
            <Text as="h3">
              Create Tag
            </Text>
          </div>
          <div className="p-6 pt-0">
            <CreateTagForm />
          </div>
        </div>
      )}

      <div className="rounded-xs transition-all duration-200">
        <div className={cn("flex flex-col space-y-1.5 p-6", "pb-3")}>
          <Text as="h3">
            <Tag className="h-4 w-4" />
            Workspace Tags ({tags.length})
          </Text>
        </div>
        <div className="p-6 pt-0">
          {tags.length === 0 ? (
            <Text as="p">
              No tags yet. {isAdmin ? "Create one above." : "Ask an admin to create tags."}
            </Text>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 rounded-xs border border-slate-100 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color ?? "#6366f1" }}
                    />
                    <Text style={{
                        backgroundColor: `${tag.color ?? "#6366f1"}18`,
                        borderColor: `${tag.color ?? "#6366f1"}40`,
                        color: tag.color ?? "#6366f1",
                      }}>
                      {tag.name}
                    </Text>
                    <Text>
                      {tag._count.decisions} decision{tag._count.decisions !== 1 ? "s" : ""}
                    </Text>
                  </div>
                  {isAdmin && <DeleteTagButton tagId={tag.id} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
