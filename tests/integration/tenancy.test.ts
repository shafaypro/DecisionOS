/**
 * Integration tests - exercise real API route handlers against a real database
 * (SQLite locally / CI) with a mocked session, proving the guarantees that
 * matter most for a multi-tenant SaaS: cross-tenant isolation, per-decision
 * visibility, and role authorization.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock the cookie-bound session module so we can drive each request's identity.
const holder = vi.hoisted(() => ({
  session: null as null | {
    userId: string;
    workspaceId: string;
    role: string;
    email: string;
    name: string;
    expiresAt: Date;
    platformRole?: "superadmin";
    platformHomeWorkspaceId?: string;
  },
}));
vi.mock("@/lib/session", () => ({
  getSession: async () => holder.session,
  createSession: async () => {},
  deleteSession: async () => {},
  encrypt: async () => "",
  decrypt: async () => null,
}));

import { prisma } from "@/lib/prisma";
import { GET as searchGET } from "@/app/api/decisions/search/route";
import { POST as askPOST } from "@/app/api/decisions/ask/route";
import { POST as notesPOST } from "@/app/api/decisions/notes/route";
import { POST as archivePOST } from "@/app/api/decisions/archive/route";
import { POST as reviewsPOST } from "@/app/api/decisions/reviews/route";
import { POST as linksPOST } from "@/app/api/decisions/links/route";
import { POST as watchPOST } from "@/app/api/decisions/[id]/watch/route";
import { POST as reactionsPOST } from "@/app/api/decisions/[id]/reactions/route";
import { POST as repliesPOST } from "@/app/api/decisions/notes/replies/route";
import { POST as decisionsPOST } from "@/app/api/decisions/route";
import { PUT as decisionsPUT } from "@/app/api/decisions/[id]/route";
import { GET as relationsGET, POST as relationsPOST } from "@/app/api/decisions/[id]/relations/route";
import { POST as supersedePOST } from "@/app/api/decisions/[id]/supersede/route";
import { GET as versionsGET } from "@/app/api/decisions/[id]/versions/route";
import { POST as bulkPOST } from "@/app/api/decisions/bulk/route";
import { GET as similarGET } from "@/app/api/decisions/similar/route";
import { GET as exportGET } from "@/app/api/decisions/export/route";
import { withApi } from "@/lib/api-handler";
import { __resetAccessCache } from "@/lib/access-control";

type Segment = { params: Promise<{ id: string }> };
function jsonReq(body?: unknown) {
  return body === undefined
    ? new NextRequest("http://localhost/x", { method: "POST" })
    : new NextRequest("http://localhost/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
}
function withParams(id: string): Segment {
  return { params: Promise.resolve({ id }) };
}

function postJson(handler: (req: NextRequest) => Promise<NextResponse>, body: unknown) {
  return handler(
    new NextRequest("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const MARK = `znt${Date.now()}`; // unique token so we only match our fixtures

type Ctx = {
  wsA: string; wsB: string;
  aAdmin: string; aMember: string; bAdmin: string;
  dApublic: string; dAprivate: string; dB: string;
  noteB: string;
  userIds: string[];
};
const ctx = {} as Ctx;

function sessionFor(userId: string, workspaceId: string, role: string) {
  holder.session = { userId, workspaceId, role, email: `${userId}@t.test`, name: userId, expiresAt: new Date(Date.now() + 6e5) };
}

beforeAll(async () => {
  const wsA = await prisma.workspace.create({ data: { name: "WS A", slug: `wsa-${MARK}` } });
  const wsB = await prisma.workspace.create({ data: { name: "WS B", slug: `wsb-${MARK}` } });

  const mk = async (email: string) =>
    prisma.user.create({ data: { name: email, email: `${email}-${MARK}@t.test`, passwordHash: "x" } });
  const aAdmin = await mk("aadmin");
  const aMember = await mk("amember");
  const bAdmin = await mk("badmin");

  await prisma.workspaceMembership.createMany({
    data: [
      { workspaceId: wsA.id, userId: aAdmin.id, role: "admin" },
      { workspaceId: wsA.id, userId: aMember.id, role: "member" },
      { workspaceId: wsB.id, userId: bAdmin.id, role: "admin" },
    ],
  });

  const dApublic = await prisma.decision.create({
    data: { workspaceId: wsA.id, createdByUserId: aAdmin.id, title: `${MARK} workspace auth overhaul`, visibility: "workspace", status: "approved", rationale: `${MARK} cost control` },
  });
  const dAprivate = await prisma.decision.create({
    data: { workspaceId: wsA.id, createdByUserId: aMember.id, title: `${MARK} private comp policy`, visibility: "private", status: "approved", rationale: `${MARK} sensitive` },
  });
  const dB = await prisma.decision.create({
    data: { workspaceId: wsB.id, createdByUserId: bAdmin.id, title: `${MARK} other tenant secret`, visibility: "workspace", status: "approved", rationale: `${MARK} leak me` },
  });
  const noteB = await prisma.decisionNote.create({
    data: { decisionId: dB.id, userId: bAdmin.id, content: "workspace B note" },
  });

  Object.assign(ctx, {
    wsA: wsA.id, wsB: wsB.id,
    aAdmin: aAdmin.id, aMember: aMember.id, bAdmin: bAdmin.id,
    dApublic: dApublic.id, dAprivate: dAprivate.id, dB: dB.id, noteB: noteB.id,
    userIds: [aAdmin.id, aMember.id, bAdmin.id],
  });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [ctx.wsA, ctx.wsB] } } });
  await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
});

async function search(q: string): Promise<string[]> {
  const res = await searchGET(new NextRequest(`http://localhost/api/decisions/search?q=${q}`));
  const json = (await res.json()) as { decisions: { id: string }[] };
  return json.decisions.map((d) => d.id);
}

describe("search - tenant isolation & visibility", () => {
  it("never returns another workspace's decisions", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    const ids = await search(MARK);
    expect(ids).toContain(ctx.dApublic);
    expect(ids).not.toContain(ctx.dB); // cross-tenant isolation
  });

  it("hides another member's private decision from non-creators", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    const ids = await search(MARK);
    expect(ids).not.toContain(ctx.dAprivate);
  });

  it("shows a member their own private decision", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    const ids = await search(MARK);
    expect(ids).toContain(ctx.dAprivate);
  });
});

describe("ask - tenant isolation", () => {
  it("only cites decisions from the caller's workspace", async () => {
    sessionFor(ctx.bAdmin, ctx.wsB, "admin");
    const res = await askPOST(
      new NextRequest("http://localhost/api/decisions/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: `tell me about ${MARK}` }),
      }),
    );
    const json = (await res.json()) as { sources: { id: string }[] };
    const ids = json.sources.map((s) => s.id);
    expect(ids).toContain(ctx.dB);
    expect(ids).not.toContain(ctx.dApublic); // WS A is invisible to WS B
    expect(ids).not.toContain(ctx.dAprivate);
  });
});

describe("mutation routes - tenant isolation & authz (withApi + sameWorkspace)", () => {
  it("notes: a viewer is blocked (403) regardless of payload", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "viewer");
    expect((await postJson(notesPOST, { decisionId: ctx.dApublic, content: "hi there" })).status).toBe(403);
  });

  it("notes: cannot attach a note to another workspace's decision (404)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await postJson(notesPOST, { decisionId: ctx.dB, content: "cross-tenant write" })).status).toBe(404);
  });

  it("notes: a member can note their own workspace's decision (200)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await postJson(notesPOST, { decisionId: ctx.dApublic, content: "legit note" })).status).toBe(200);
  });

  it("archive/review/link: cannot mutate another workspace's decision (404)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await postJson(archivePOST, { decisionId: ctx.dB })).status).toBe(404);
    expect((await postJson(reviewsPOST, { decisionId: ctx.dB, outcomeStatus: "successful" })).status).toBe(404);
    expect((await postJson(linksPOST, { decisionId: ctx.dB, label: "x", url: "https://x.test" })).status).toBe(404);
  });

  it("link: rejects an invalid URL (400)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await postJson(linksPOST, { decisionId: ctx.dApublic, label: "x", url: "not a url" })).status).toBe(400);
  });
});

describe("decision-scoped [id] & nested routes - tenancy & authz", () => {
  it("watch: cannot watch another workspace's decision (404), can watch own (200)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await watchPOST(jsonReq(), withParams(ctx.dB))).status).toBe(404);
    expect((await watchPOST(jsonReq(), withParams(ctx.dApublic))).status).toBe(200);
  });

  it("reactions: viewer blocked (403), bad emoji (400), cross-tenant (404), valid (200)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "viewer");
    expect((await reactionsPOST(jsonReq({ emoji: "rocket" }), withParams(ctx.dApublic))).status).toBe(403);

    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await reactionsPOST(jsonReq({ emoji: "nope" }), withParams(ctx.dApublic))).status).toBe(400);
    expect((await reactionsPOST(jsonReq({ emoji: "rocket" }), withParams(ctx.dB))).status).toBe(404);
    expect((await reactionsPOST(jsonReq({ emoji: "rocket" }), withParams(ctx.dApublic))).status).toBe(200);
  });

  it("note replies: cannot reply to another workspace's note (404)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await repliesPOST(jsonReq({ noteId: ctx.noteB, content: "cross-tenant reply" }))).status).toBe(404);
  });
});

describe("decisions create/update - tenancy, authz, validation", () => {
  it("create: a viewer is blocked (403)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "viewer");
    expect((await decisionsPOST(jsonReq({ title: "A perfectly valid title" }))).status).toBe(403);
  });

  it("create: invalid payload (short title) → 400", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await decisionsPOST(jsonReq({ title: "ab" }))).status).toBe(400);
  });

  it("create: a valid decision is scoped to the caller's workspace (200)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    const res = await decisionsPOST(jsonReq({ title: `${MARK} created via integration test` }));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    const row = await prisma.decision.findUnique({ where: { id } });
    expect(row?.workspaceId).toBe(ctx.wsA);
  });

  it("update: cannot update another workspace's decision (404)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    const res = await decisionsPUT(jsonReq({ title: "Hijacked title attempt" }), withParams(ctx.dB));
    expect(res.status).toBe(404);
    const untouched = await prisma.decision.findUnique({ where: { id: ctx.dB } });
    expect(untouched?.title).not.toBe("Hijacked title attempt");
  });

  it("update: a valid update of an own-workspace decision (200)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await decisionsPUT(jsonReq({ title: `${MARK} updated title` }), withParams(ctx.dApublic))).status).toBe(200);
  });
});

describe("decision graph - relations / supersede / versions tenancy & authz", () => {
  it("relations GET: cross-tenant 404, own 200", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await relationsGET(jsonReq(), withParams(ctx.dB))).status).toBe(404);
    expect((await relationsGET(jsonReq(), withParams(ctx.dApublic))).status).toBe(200);
  });

  it("relations POST: viewer 403, self 400, cross-tenant target 404, valid 200", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "viewer");
    expect((await relationsPOST(jsonReq({ toDecisionId: ctx.dAprivate, relationType: "relates_to" }), withParams(ctx.dApublic))).status).toBe(403);

    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await relationsPOST(jsonReq({ toDecisionId: ctx.dApublic, relationType: "relates_to" }), withParams(ctx.dApublic))).status).toBe(400);
    expect((await relationsPOST(jsonReq({ toDecisionId: ctx.dB, relationType: "relates_to" }), withParams(ctx.dApublic))).status).toBe(404);
    expect((await relationsPOST(jsonReq({ toDecisionId: ctx.dAprivate, relationType: "relates_to" }), withParams(ctx.dApublic))).status).toBe(200);
  });

  it("supersede: cannot supersede across tenants (404); valid within workspace (200)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await supersedePOST(jsonReq({ toDecisionId: ctx.dB }), withParams(ctx.dApublic))).status).toBe(404);

    const a = await prisma.decision.create({ data: { workspaceId: ctx.wsA, createdByUserId: ctx.aAdmin, title: `${MARK} sup-old`, visibility: "workspace" } });
    const b = await prisma.decision.create({ data: { workspaceId: ctx.wsA, createdByUserId: ctx.aAdmin, title: `${MARK} sup-new`, visibility: "workspace" } });
    expect((await supersedePOST(jsonReq({ toDecisionId: b.id }), withParams(a.id))).status).toBe(200);
  });

  it("versions GET: cross-tenant 404, own 200", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await versionsGET(jsonReq(), withParams(ctx.dB))).status).toBe(404);
    expect((await versionsGET(jsonReq(), withParams(ctx.dApublic))).status).toBe(200);
  });
});

describe("reads & bulk - tenancy, authz, visibility", () => {
  it("bulk: viewer blocked (403), foreign ids rejected (404), valid export (200), bad action (400)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "viewer");
    expect((await postJson(bulkPOST, { action: "export", ids: [ctx.dApublic] })).status).toBe(403);

    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await postJson(bulkPOST, { action: "export", ids: [ctx.dApublic, ctx.dB] })).status).toBe(404);
    expect((await postJson(bulkPOST, { action: "export", ids: [ctx.dApublic] })).status).toBe(200);
    expect((await postJson(bulkPOST, { action: "delete", ids: [ctx.dApublic] })).status).toBe(400);
  });

  it("similar: hides another member's private decision; shows it to its creator", async () => {
    const url = `http://localhost/api/decisions/similar?q=${encodeURIComponent("private comp policy")}`;
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    const asAdmin = (await (await similarGET(new NextRequest(url))).json()) as { matches: { id: string }[] };
    expect(asAdmin.matches.map((m) => m.id)).not.toContain(ctx.dAprivate);

    sessionFor(ctx.aMember, ctx.wsA, "member");
    const asMember = (await (await similarGET(new NextRequest(url))).json()) as { matches: { id: string }[] };
    expect(asMember.matches.map((m) => m.id)).toContain(ctx.dAprivate);
  });

  it("export: CSV excludes another member's private decision, includes it for its creator", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect(await (await exportGET(jsonReq())).text()).not.toContain("private comp policy");

    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect(await (await exportGET(jsonReq())).text()).toContain("private comp policy");
  });
});

describe("withApi - role authorization", () => {
  const adminOnly = withApi({ require: "admin" }, () => NextResponse.json({ ok: true }));
  const req = () => new NextRequest("http://localhost/x", { method: "POST" });

  it("401 when unauthenticated", async () => {
    holder.session = null;
    expect((await adminOnly(req())).status).toBe(401);
  });
  it("403 for a member on an admin route", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect((await adminOnly(req())).status).toBe(403);
  });
  it("200 for an admin", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await adminOnly(req())).status).toBe(200);
  });
});

describe("withApi - session revalidation (live membership + workspace status)", () => {
  const anyMember = withApi({ require: "auth" }, () => NextResponse.json({ ok: true }));
  const req = () => new NextRequest("http://localhost/x", { method: "POST" });

  it("allows a current member of an active workspace", async () => {
    __resetAccessCache();
    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect((await anyMember(req())).status).toBe(200);
  });

  it("401s once the caller's membership is removed (revocation, not 7-day lag)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    const m = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: ctx.wsA, userId: ctx.aMember } },
    });
    await prisma.workspaceMembership.delete({ where: { id: m!.id } });
    __resetAccessCache(); // the team-remove route does this via invalidateWorkspaceAccess
    expect((await anyMember(req())).status).toBe(401);
    // restore for any later tests
    await prisma.workspaceMembership.create({
      data: { workspaceId: ctx.wsA, userId: ctx.aMember, role: "member" },
    });
    __resetAccessCache();
  });

  it("403s every member when the workspace is suspended", async () => {
    __resetAccessCache();
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    await prisma.workspace.update({ where: { id: ctx.wsA }, data: { status: "suspended" } });
    __resetAccessCache();
    expect((await anyMember(req())).status).toBe(403);
    await prisma.workspace.update({ where: { id: ctx.wsA }, data: { status: "active" } });
    __resetAccessCache();
  });

  it("lets a platform admin who entered a workspace through (no membership row there)", async () => {
    __resetAccessCache();
    // aAdmin has no membership in wsB; as platform staff they still get through.
    holder.session = {
      userId: ctx.aAdmin, workspaceId: ctx.wsB, role: "admin",
      email: "a@t.test", name: "a", expiresAt: new Date(Date.now() + 6e5),
      platformRole: "superadmin",
    };
    expect((await anyMember(req())).status).toBe(200);
    holder.session = null;
  });
});
