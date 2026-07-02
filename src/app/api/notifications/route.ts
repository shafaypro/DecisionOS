import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";

export const GET = withApi(
  { require: "auth" },
  async ({ session }) => {
    const notifications = await prisma.inAppNotification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;
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
