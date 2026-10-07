/** Template listing shared by the new-decision page and `GET /api/templates`. */
import "server-only";
import { prisma } from "./prisma";
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from "./builtin-templates";

export interface TemplateSummary extends Omit<BuiltinTemplate, "description"> {
  description: string | null;
  isBuiltIn: boolean;
}

/** Built-in templates plus the workspace's own, built-ins first. */
export async function listTemplates(workspaceId: string): Promise<TemplateSummary[]> {
  const rows = await prisma.decisionTemplate.findMany({
    where: { OR: [{ workspaceId: null }, { workspaceId }] },
    select: { id: true, name: true, category: true, description: true, defaultValues: true, isBuiltIn: true },
  });
  const present = new Set(rows.map((r) => r.id));
  const missing = BUILTIN_TEMPLATES.filter((t) => !present.has(t.id)).map((t) => ({ ...t, isBuiltIn: true }));
  return [...missing, ...rows].sort(
    (a, b) =>
      Number(b.isBuiltIn) - Number(a.isBuiltIn) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name),
  );
}
