/**
 * Integration tests for note reply threads and the author-based delete
 * authorization on notes, replies, and links. Mirrors tenancy.test.ts: a
 * hoisted session holder and a mocked @/lib/session drive the withApi
 * handlers directly against the shared SQLite dev.db.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

const holder = vi.hoisted(() => ({
  session: null as null | {
    userId: string; workspaceId: string; role: string; email: string; name: string; expiresAt: Date;
  },
}));
vi.mock("@/lib/session", () => ({
  getSession: async () => holder.session,
  createSession: async () => {},
  deleteSession: async () => {},
}));

import { prisma } from "@/lib/prisma";
import { POST as replyPOST, DELETE as replyDELETE } from "@/app/api/decisions/notes/replies/route";
import { POST as notePOST, DELETE as noteDELETE } from "@/app/api/decisions/notes/route";
import { POST as linkPOST, DELETE as linkDELETE } from "@/app/api/decisions/links/route";

const MARK = `nrp${Date.now()}`;

function setSession(userId: string, workspaceId: string, role = "member") {
  holder.session = {
    userId, workspaceId, role,
    email: `${userId}@t.test`, name: userId, expiresAt: new Date(Date.now() + 6e5),
  };
}
function json(handler: (req: NextRequest) => Promise<NextResponse>, method: string, body: unknown) {
  return handler(
    new NextRequest("http://localhost/x", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const ctx = {} as {
  wsA: string; wsB: string;
  adminA: string; author: string; other: string; outsider: string;
  decision: string; note: string;
  userIds: string[]; wsIds: string[];
};

beforeAll(async () => {
  const mkUser = (n: string) =>
    prisma.user.create({ data: { name: n, email: `${n}-${MARK}@t.test`, passwordHash: "x" } });
  const wsA = await prisma.workspace.create({ data: { name: "A", slug: `a-${MARK}` } });
  const wsB = await prisma.workspace.create({ data: { name: "B", slug: `b-${MARK}` } });
  const adminA = await mkUser("adminA");
  const author = await mkUser("author");
  const other = await mkUser("other");
  const outsider = await mkUser("outsider");
  await prisma.workspaceMembership.createMany({
    data: [
      { workspaceId: wsA.id, userId: adminA.id, role: "admin" },
      { workspaceId: wsA.id, userId: author.id, role: "member" },
      { workspaceId: wsA.id, userId: other.id, role: "member" },
      { workspaceId: wsB.id, userId: outsider.id, role: "member" },
    ],
  });
  // Decision created by the admin, note written by a plain member - so
  // author-vs-decision-creator authorization is actually distinguishable.
  const decision = await prisma.decision.create({
    data: { workspaceId: wsA.id, createdByUserId: adminA.id, title: `D-${MARK}` },
  });
  const note = await prisma.decisionNote.create({
    data: { decisionId: decision.id, userId: author.id, content: `note-${MARK}` },
  });
  Object.assign(ctx, {
    wsA: wsA.id, wsB: wsB.id,
    adminA: adminA.id, author: author.id, other: other.id, outsider: outsider.id,
    decision: decision.id, note: note.id,
    userIds: [adminA.id, author.id, other.id, outsider.id],
    wsIds: [wsA.id, wsB.id],
  });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: ctx.wsIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
});

describe("note replies", () => {
  it("creates a reply and emits a note_replied event", async () => {
    setSession(ctx.other, ctx.wsA);
    const res = await json(replyPOST, "POST", { noteId: ctx.note, content: `reply-${MARK}` });
    expect(res.status).toBe(200);
    const reply = await prisma.noteReply.findFirst({ where: { noteId: ctx.note, userId: ctx.other } });
    expect(reply?.content).toBe(`reply-${MARK}`);
    const event = await prisma.decisionEvent.findFirst({
      where: { decisionId: ctx.decision, eventType: "note_replied", userId: ctx.other },
    });
    expect(event).not.toBeNull();
  });

  it("404s for a note outside the caller's workspace", async () => {
    setSession(ctx.outsider, ctx.wsB);
    const res = await json(replyPOST, "POST", { noteId: ctx.note, content: "cross-tenant" });
    expect(res.status).toBe(404);
  });

  it("rejects reply deletion by a member who is not the reply author", async () => {
    const reply = await prisma.noteReply.create({
      data: { noteId: ctx.note, userId: ctx.author, content: `del-${MARK}` },
    });
    setSession(ctx.other, ctx.wsA);
    const res = await json(replyDELETE, "DELETE", { replyId: reply.id });
    expect(res.status).toBe(403);
    setSession(ctx.author, ctx.wsA);
    const ok = await json(replyDELETE, "DELETE", { replyId: reply.id });
    expect(ok.status).toBe(200);
    expect(await prisma.noteReply.findUnique({ where: { id: reply.id } })).toBeNull();
  });

  it("lets a workspace admin delete any reply", async () => {
    const reply = await prisma.noteReply.create({
      data: { noteId: ctx.note, userId: ctx.author, content: `admdel-${MARK}` },
    });
    setSession(ctx.adminA, ctx.wsA, "admin");
    const res = await json(replyDELETE, "DELETE", { replyId: reply.id });
    expect(res.status).toBe(200);
  });
});

describe("author-based delete authorization", () => {
  it("lets a note author delete their own note on someone else's decision", async () => {
    setSession(ctx.author, ctx.wsA);
    await json(notePOST, "POST", { decisionId: ctx.decision, content: `mine-${MARK}` });
    const note = await prisma.decisionNote.findFirst({
      where: { decisionId: ctx.decision, content: `mine-${MARK}` },
    });
    const res = await json(noteDELETE, "DELETE", { noteId: note!.id });
    expect(res.status).toBe(200);
  });

  it("rejects note deletion by a member who is neither author nor admin", async () => {
    setSession(ctx.other, ctx.wsA);
    const res = await json(noteDELETE, "DELETE", { noteId: ctx.note });
    expect(res.status).toBe(403);
  });

  it("applies the same author rule to links", async () => {
    setSession(ctx.author, ctx.wsA);
    await json(linkPOST, "POST", {
      decisionId: ctx.decision, label: `L-${MARK}`, url: "https://example.com", linkType: "doc",
    });
    const link = await prisma.decisionLink.findFirst({
      where: { decisionId: ctx.decision, label: `L-${MARK}` },
    });
    setSession(ctx.other, ctx.wsA);
    expect((await json(linkDELETE, "DELETE", { linkId: link!.id })).status).toBe(403);
    setSession(ctx.author, ctx.wsA);
    expect((await json(linkDELETE, "DELETE", { linkId: link!.id })).status).toBe(200);
  });
});
