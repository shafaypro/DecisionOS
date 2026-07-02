import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withApi } from "@/lib/api-handler";
import { parseBody, TeamInviteSchema } from "@/lib/schemas";
import { teamInviteLimiter, mutationKey } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { auditApiEvent } from "@/lib/audit-log";

export const POST = withApi(
  { require: "admin" },
  async ({ session, req }) => {
    // Rate-limit before any DB work - protects the expensive user-creation path
    // and blunts invite spam / enumeration regardless of payload validity.
    const limit = await teamInviteLimiter.check(mutationKey(session));
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many invitations sent. Please try again in a minute." },
        { status: 429, headers: limit.headers },
      );
    }

    const parsed = parseBody(TeamInviteSchema, await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: parsed.status });
    const { email: normalizedEmail, role } = parsed.data;

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      const tempPassword = Math.random().toString(36).slice(-10);
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      user = await prisma.user.create({
        data: {
          name: normalizedEmail.split("@")[0],
          email: normalizedEmail,
          passwordHash,
        },
      });
    }

    const existing = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: session.workspaceId, userId: user.id } },
    });

    if (existing) return NextResponse.json({ error: "This person is already a member of the workspace" }, { status: 400 });

    await prisma.workspaceMembership.create({
      data: { workspaceId: session.workspaceId, userId: user.id, role: role || "member" },
    });

    track({ event: "invite.sent", workspaceId: session.workspaceId, userId: session.userId, source: "api" });
    await auditApiEvent({
      action: "member.invited",
      session,
      req,
      targetType: "user",
      targetId: user.id,
      metadata: { targetEmail: normalizedEmail, role: role || "member" },
    });

    return NextResponse.json({ success: `${normalizedEmail} has been added to the workspace` });
  },
);
