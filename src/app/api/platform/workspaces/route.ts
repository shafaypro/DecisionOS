import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlatformApi } from "@/lib/platform-api-handler";

/**
 * Platform console - list every company (workspace) with headline counts.
 *
 * This is a platform-only path: it intentionally queries across all workspaces
 * and is NOT scoped by `session.workspaceId`. Reachable only through
 * `withPlatformApi`, which 403s anyone without `platformRole`.
 */
export const GET = withPlatformApi({}, async () => {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      _count: { select: { memberships: true, decisions: true } },
    },
  });

  return NextResponse.json({ workspaces });
});
