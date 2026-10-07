import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DecisionPatchSchema, type DecisionPatchInput } from "@/lib/schemas";
import { withApi } from "@/lib/api-handler";
import { visibleDecision } from "@/lib/tenant";
import { notifyDecisionWatchers } from "@/lib/notify-watchers";

export const PUT = withApi<DecisionPatchInput, { id: string }>(
  { require: "writer", schema: DecisionPatchSchema },
  async ({ session, body, params }) => {
    const { id } = params;

    const existing = visibleDecision(
      await prisma.decision.findUnique({ where: { id } }),
      session,
    );
    if (!existing) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

    // Build a partial update from only the keys the client actually sent, so an
    // inline single-field save never clobbers fields it didn't include.
    const data: Record<string, unknown> = {};
    const has = (k: keyof DecisionPatchInput) =>
      Object.prototype.hasOwnProperty.call(body, k);

    // String fields that always carry a value (trimmed).
    for (const k of ["title", "category", "impactLevel", "visibility"] as const) {
      if (has(k)) data[k] = String(body[k] ?? "").trim();
    }
    // Status respects the saveAsDraft convenience flag.
    if (body.saveAsDraft === true) {
      data.status = "draft";
    } else if (has("status")) {
      data.status = String(body.status ?? "").trim();
    }
    // Free-text fields: empty → null.
    for (const k of [
      "summary", "problemStatement", "chosenOption", "rationale",
      "alternativesConsidered", "assumptions", "risks",
    ] as const) {
      if (has(k)) data[k] = String(body[k] ?? "").trim() || null;
    }
    // Relationship ids: empty → null.
    for (const k of ["ownerUserId", "accountableUserId"] as const) {
      if (has(k)) data[k] = (body[k] as string) || null;
    }
    // Dates: empty → null.
    for (const k of ["decisionDate", "reviewDate"] as const) {
      if (has(k)) data[k] = body[k] ? new Date(body[k] as string) : null;
    }
    // Visibility is the author's call: anyone else flipping a decision to
    // private would hide it from themselves and everyone but the author.
    if (
      data.visibility !== undefined &&
      data.visibility !== existing.visibility &&
      existing.createdByUserId !== session.userId &&
      session.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Only the decision's author or an admin can change who can see it." },
        { status: 403 },
      );
    }
    // A private decision can't have a public link.
    if (data.visibility === "private" && existing.shareToken) {
      data.shareToken = null;
    }
    // Scheduling a review after the last one re-arms it: every "due" query keys
    // off `reviewedAt: null`, so without this a reviewed decision never comes
    // due again however its review date moves.
    if (
      data.reviewDate instanceof Date &&
      existing.reviewedAt &&
      data.reviewDate.getTime() > existing.reviewedAt.getTime()
    ) {
      data.reviewedAt = null;
    }
    // Consulted ids are stored as a JSON string.
    if (has("consultedIds")) {
      data.consultedIds =
        Array.isArray(body.consultedIds) && body.consultedIds.length > 0
          ? JSON.stringify(body.consultedIds)
          : null;
    }

    // No-op if nothing actually changed - avoids version/event churn on the
    // frequent inline saves.
    const existingRecord = existing as unknown as Record<string, unknown>;
    const changed = Object.keys(data).some((k) => {
      const a = data[k], b = existingRecord[k];
      if (a instanceof Date || b instanceof Date)
        return new Date(a as string).getTime() !== new Date(b as string).getTime();
      return a !== b;
    });
    if (!changed) return NextResponse.json({ success: true });

    const oldStatus = existing.status;

    // Update + before-snapshot + events commit atomically so a failure can't
    // leave an updated decision with no version history. The version count is
    // read inside the transaction so concurrent inline saves don't collide on
    // the same versionNum.
    const updated = await prisma.$transaction(async (tx) => {
      const versionCount = await tx.decisionVersion.count({ where: { decisionId: id } });
      const row = await tx.decision.update({ where: { id }, data });

      await tx.decisionVersion.create({
        data: {
          decisionId: id,
          versionNum: versionCount + 1,
          snapshotJson: JSON.stringify(existing),
          changedById: session.userId,
        },
      });

      await tx.decisionEvent.create({
        data: {
          decisionId: id,
          userId: session.userId,
          eventType: "updated",
          oldValueJson: JSON.stringify({ title: existing.title }),
          newValueJson: JSON.stringify({ title: row.title }),
        },
      });

      if (oldStatus !== row.status) {
        await tx.decisionEvent.create({
          data: {
            decisionId: id,
            userId: session.userId,
            eventType: "status_changed",
            oldValueJson: JSON.stringify({ status: oldStatus }),
            newValueJson: JSON.stringify({ status: row.status }),
          },
        });
      }

      return row;
    });

    const statusChanged = oldStatus !== updated.status;

    await notifyDecisionWatchers({
      decisionId: id,
      actorUserId: session.userId,
      actorName: session.name,
      event: statusChanged ? "status_changed" : "updated",
      summary: statusChanged
        ? `Status changed: ${oldStatus} → ${updated.status}`
        : "Decision details were updated.",
    });

    return NextResponse.json({ success: true });
  },
);
