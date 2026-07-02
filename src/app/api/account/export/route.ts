import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { withApi } from "@/lib/api-handler";
import { exportLimiter, mutationKey } from "@/lib/rate-limit";
import { auditApiEvent } from "@/lib/audit-log";

/**
 * GET /api/account/export
 * GDPR right of access / data portability: download a machine-readable (JSON)
 * copy of all personal data tied to the signed-in user. Complements the
 * workspace-decisions CSV export (/api/decisions/export); this one is scoped to
 * the individual and their own contributions. The password hash is never included.
 */
export const GET = withApi<undefined>({ require: "auth" }, async ({ session, req }) => {
  const limit = await exportLimiter.check(mutationKey(session));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please wait a moment." },
      { status: 429, headers: limit.headers },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: { include: { workspace: { select: { id: true, name: true, slug: true } } } },
      createdDecisions: true,
      ownedDecisions: true,
      notes: true,
      noteReplies: true,
      reviews: true,
      links: true,
      decisionVersions: true,
      events: true,
      decisionRelations: true,
      reactions: true,
      watchedDecisions: true,
      assignedActionItems: true,
      createdActionItems: true,
      notifications: true,
      slackLink: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Never expose the password hash.
  const { passwordHash: _passwordHash, ...profile } = user;
  void _passwordHash;

  const bundle = {
    exportedAt: new Date().toISOString(),
    note: "Personal data export for the signed-in DecisionOS account (GDPR right of access).",
    account: profile,
  };

  await auditApiEvent({
    action: "account.data_exported",
    session,
    req,
    targetType: "user",
    targetId: session.userId,
  });

  const filename = `decisionos-account-export-${format(new Date(), "yyyy-MM-dd")}.json`;
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
