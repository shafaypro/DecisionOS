import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";

export const GET = withApi(
  { require: "auth" },
  async ({ session }) => {
    // The list is capped at 30 for the panel, but the badge must reflect the
    // TRUE unread total - counting only the fetched page under-reports anyone
    // with more than 30 unread. Count separately.
    const [notifications, unreadCount] = await Promise.all([
      prisma.inAppNotification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.inAppNotification.count({
        where: { userId: session.userId, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  },
);

export const PATCH = withApi(
  { require: "auth" },
  async ({ session, req }) => {
    const { ids, all } = await req.json().catch(() => ({}));

    if (all) {
      await prisma.inAppNotification.updateMany({
        where: { userId: session.userId, isRead: false },
        data: { isRead: true },
      });
    } else if (Array.isArray(ids) && ids.length > 0) {
      await prisma.inAppNotification.updateMany({
        where: { userId: session.userId, id: { in: ids } },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  },
);
