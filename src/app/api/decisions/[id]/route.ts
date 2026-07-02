import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DecisionPatchSchema, type DecisionPatchInput } from "@/lib/schemas";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace } from "@/lib/tenant";
import { notifyDecisionWatchers } from "@/lib/notify-watchers";

export const PUT = withApi<DecisionPatchInput, { id: string }>(
  { require: "writer", schema: DecisionPatchSchema },
  async ({ session, body, params }) => {
    const { id } = params;

    const existing = sameWorkspace(
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

    // Count existing versions for numbering
    const versionCount = await prisma.decisionVersion.count({ where: { decisionId: id } });

    const updated = await prisma.decision.update({ where: { id }, data });

    // Save a full snapshot of the before-state for versioning
    await prisma.decisionVersion.create({
      data: {
        decisionId: id,
        versionNum: versionCount + 1,
        snapshotJson: JSON.stringify(existing),
        changedById: session.userId,
      },
    });

    await prisma.decisionEvent.create({
      data: {
        decisionId: id,
        userId: session.userId,
        eventType: "updated",
        oldValueJson: JSON.stringify({ title: existing.title }),
        newValueJson: JSON.stringify({ title: updated.title }),
      },
    });

    const statusChanged = oldStatus !== updated.status;
    if (statusChanged) {
      await prisma.decisionEvent.create({
        data: {
          decisionId: id,
          userId: session.userId,
          eventType: "status_changed",
          oldValueJson: JSON.stringify({ status: oldStatus }),
          newValueJson: JSON.stringify({ status: updated.status }),
        },
      });
    }

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
