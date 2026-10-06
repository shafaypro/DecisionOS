import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { withApi } from "@/lib/api-handler";
import { parseBody, TeamInviteSchema } from "@/lib/schemas";
import { teamInviteLimiter, mutationKey } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { auditApiEvent } from "@/lib/audit-log";
import { sendInviteLink } from "@/lib/password-links";

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
    const isNewAccount = !user;

    if (!user) {
      // Nobody knows this password - it only exists so the row is valid. The
      // invitee chooses their own through the emailed set-password link.
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
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

    // A brand-new account can't sign in until it has a password, so it gets a
    // set-password link. An existing account already has one and just signs in.
    // (Links are never minted for existing accounts: that would let one
    // workspace's admin take over an account other workspaces rely on.)
    if (!isNewAccount) {
      return NextResponse.json({
        success: `${normalizedEmail} already has a DecisionOS account and can sign in now.`,
      });
    }

    const [workspace, inviter] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: session.workspaceId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
    ]);
    const invite = await sendInviteLink({
      user,
      workspaceName: workspace?.name ?? "your team",
      inviterName: inviter?.name ?? session.name,
    });

    return NextResponse.json(
      invite.emailed
        ? { success: `Invitation emailed to ${normalizedEmail}.` }
        : {
            success: `${normalizedEmail} has been added. Email isn't configured, so send them this link to set their password (valid for 7 days):`,
            inviteUrl: invite.url,
          },
    );
  },
);
