/**
 * Magic-link handler for one-click review responses from email.
 *
 * GET /api/decisions/review-action?token=<signed-jwt>
 *
 * - Verifies the signed token
 * - Creates a DecisionReview record
 * - Marks reviewedAt on the decision
 * - Redirects to the decision detail (or a confirmation page)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyReviewToken } from "@/lib/review-token";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/decisions?review=invalid", req.url));
  }

  const payload = await verifyReviewToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/decisions?review=expired", req.url));
  }

  const { decisionId, userId, action } = payload;

  const decision = await prisma.decision.findUnique({ where: { id: decisionId } });
  if (!decision) {
    return NextResponse.redirect(new URL("/decisions?review=notfound", req.url));
  }

  // Idempotent - don't double-create if already reviewed
  const existingReview = await prisma.decisionReview.findFirst({
    where: { decisionId, reviewedByUserId: userId },
    orderBy: { createdAt: "desc" },
  });

  if (!existingReview || new Date(existingReview.createdAt) < new Date(decision.reviewDate ?? 0)) {
    const outcomeStatus = action === "valid" ? "successful" : "assumptions_changed";
    const summary = action === "valid"
      ? "Still valid, confirmed via email."
      : "Assumptions have changed, requires follow-up.";

    await prisma.decisionReview.create({
      data: {
        decisionId,
        reviewedByUserId: userId,
        outcomeStatus,
        summary,
      },
    });

    await prisma.decision.update({
      where: { id: decisionId },
      data: { reviewedAt: new Date(), outcomeStatus },
    });

    await prisma.decisionEvent.create({
      data: {
        decisionId,
        userId,
        eventType: "reviewed",
        newValueJson: JSON.stringify({ outcomeStatus, via: "email_magic_link" }),
      },
    });
  }

  // Redirect to decision detail with a success flash
  const redirectUrl = new URL(`/decisions/${decisionId}`, req.url);
  redirectUrl.searchParams.set("reviewed", action);
  return NextResponse.redirect(redirectUrl);
}
