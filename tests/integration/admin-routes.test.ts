/**
 * Integration tests for the admin/workspace routes migrated onto `withApi`
 * (Phase 1, T1.3): tags, templates, action-items, settings, team, integrations.
 *
 * Asserts the two guarantees the migration is responsible for:
 *   - role authorization (admin-only / writer-only routes reject lower roles), and
 *   - tenant isolation (a row from another workspace is never mutable - 404, not 403,
 *     so existence isn't leaked).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";

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
import { POST as tagsPOST, DELETE as tagsDELETE } from "@/app/api/tags/route";
import { POST as templatesPOST } from "@/app/api/templates/route";
import { PUT as templatePUT, DELETE as templateDELETE } from "@/app/api/templates/[id]/route";
import { POST as aiPOST } from "@/app/api/action-items/route";
import { PATCH as aiPATCH, DELETE as aiDELETE } from "@/app/api/action-items/[id]/route";
import { PUT as settingsPUT } from "@/app/api/settings/route";
import { POST as teamPOST } from "@/app/api/team/route";
import { PUT as integrationsPUT } from "@/app/api/integrations/route";

const MARK = `adm${Date.now()}`;

function req(method: string, body?: unknown) {
  return body === undefined
    ? new NextRequest("http://localhost/x", { method })
    : new NextRequest("http://localhost/x", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
}
function seg(id: string) {
  return { params: Promise.resolve({ id }) };
}
function sessionFor(userId: string, workspaceId: string, role: string) {
  holder.session = { userId, workspaceId, role, email: `${userId}@t.test`, name: userId, expiresAt: new Date(Date.now() + 6e5) };
}

type Ctx = {
  wsA: string; wsB: string;
  aAdmin: string; aMember: string; bAdmin: string;
  tagA: string; tagB: string;
  tplA: string; tplB: string;
  aiA: string; aiB: string;
  decB: string;
  userIds: string[];
};
const ctx = {} as Ctx;

beforeAll(async () => {
  const wsA = await prisma.workspace.create({ data: { name: "WS A", slug: `adm-wsa-${MARK}` } });
  const wsB = await prisma.workspace.create({ data: { name: "WS B", slug: `adm-wsb-${MARK}` } });

  const mk = (email: string) =>
    prisma.user.create({ data: { name: email, email: `${email}-${MARK}@t.test`, passwordHash: "x" } });
  const aAdmin = await mk("aadmin");
  const aMember = await mk("amember");
  const bAdmin = await mk("badmin");

  const tagA = await prisma.tag.create({ data: { workspaceId: wsA.id, name: `${MARK}-tagA`, color: "#111111" } });
  const tagB = await prisma.tag.create({ data: { workspaceId: wsB.id, name: `${MARK}-tagB`, color: "#222222" } });

  const tplA = await prisma.decisionTemplate.create({
    data: { workspaceId: wsA.id, name: `${MARK}-tplA`, category: "engineering", defaultValues: "{}", isBuiltIn: false },
  });
  const tplB = await prisma.decisionTemplate.create({
    data: { workspaceId: wsB.id, name: `${MARK}-tplB`, category: "engineering", defaultValues: "{}", isBuiltIn: false },
  });

  const aiA = await prisma.actionItem.create({ data: { workspaceId: wsA.id, createdById: aAdmin.id, title: `${MARK}-aiA` } });
  const aiB = await prisma.actionItem.create({ data: { workspaceId: wsB.id, createdById: bAdmin.id, title: `${MARK}-aiB` } });

  const decB = await prisma.decision.create({
    data: { workspaceId: wsB.id, createdByUserId: bAdmin.id, title: `${MARK}-decB`, visibility: "workspace" },
  });

  Object.assign(ctx, {
    wsA: wsA.id, wsB: wsB.id,
    aAdmin: aAdmin.id, aMember: aMember.id, bAdmin: bAdmin.id,
    tagA: tagA.id, tagB: tagB.id,
    tplA: tplA.id, tplB: tplB.id,
    aiA: aiA.id, aiB: aiB.id, decB: decB.id,
    userIds: [aAdmin.id, aMember.id, bAdmin.id],
  });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [ctx.wsA, ctx.wsB] } } });
  await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
});

describe("tags - admin authz & tenant isolation", () => {
  it("blocks a non-admin from creating a tag (403)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect((await tagsPOST(req("POST", { name: `${MARK}-nope` }))).status).toBe(403);
  });

  it("admin creates a tag (200) and rejects a duplicate name (400)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await tagsPOST(req("POST", { name: `${MARK}-fresh` }))).status).toBe(200);
    expect((await tagsPOST(req("POST", { name: `${MARK}-fresh` }))).status).toBe(400);
  });

  it("cannot delete another workspace's tag (404); the tag survives", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await tagsDELETE(req("DELETE", { tagId: ctx.tagB }))).status).toBe(404);
    expect(await prisma.tag.findUnique({ where: { id: ctx.tagB } })).not.toBeNull();
  });

  it("deletes an own-workspace tag (200)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await tagsDELETE(req("DELETE", { tagId: ctx.tagA }))).status).toBe(200);
  });
});

describe("templates - admin authz, validation & tenant isolation", () => {
  it("blocks a non-admin from creating a template (403)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect((await templatesPOST(req("POST", { name: "X", category: "engineering" }))).status).toBe(403);
  });

  it("admin create: missing category → 400, valid → 200", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await templatesPOST(req("POST", { name: `${MARK}-t` }))).status).toBe(400);
    expect((await templatesPOST(req("POST", { name: `${MARK}-t2`, category: "product" }))).status).toBe(200);
  });

  it("cannot update or delete another workspace's template (404)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await templatePUT(req("PUT", { name: "hijack", category: "engineering" }), seg(ctx.tplB))).status).toBe(404);
    expect((await templateDELETE(req("DELETE"), seg(ctx.tplB))).status).toBe(404);
  });
});

describe("action-items - writer authz & tenant isolation", () => {
  it("blocks a viewer from creating an item (403)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "viewer");
    expect((await aiPOST(req("POST", { title: "blocked" }))).status).toBe(403);
  });

  it("a member creates an item scoped to their workspace (200)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    const res = await aiPOST(req("POST", { title: `${MARK}-newitem` }));
    expect(res.status).toBe(200);
    const { item } = (await res.json()) as { item: { id: string } };
    const row = await prisma.actionItem.findUnique({ where: { id: item.id } });
    expect(row?.workspaceId).toBe(ctx.wsA);
  });

  it("rejects linking an item to another workspace's decision (404)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect((await aiPOST(req("POST", { title: `${MARK}-x`, decisionId: ctx.decB }))).status).toBe(404);
  });

  it("cannot patch or delete another workspace's item (404)", async () => {
    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await aiPATCH(req("PATCH", { status: "done" }), seg(ctx.aiB))).status).toBe(404);
    expect((await aiDELETE(req("DELETE"), seg(ctx.aiB))).status).toBe(404);
    expect(await prisma.actionItem.findUnique({ where: { id: ctx.aiB } })).not.toBeNull();
  });
});

describe("settings / team / integrations - admin authz", () => {
  it("settings: blocks a non-admin (403); admin invalid slug → 400; valid → 200", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect((await settingsPUT(req("PUT", { name: "X", slug: "ok-slug" }))).status).toBe(403);

    sessionFor(ctx.aAdmin, ctx.wsA, "admin");
    expect((await settingsPUT(req("PUT", { name: "X", slug: "Has Space!" }))).status).toBe(400);
    expect((await settingsPUT(req("PUT", { name: "Renamed", slug: `adm-wsa-renamed-${MARK}` }))).status).toBe(200);
  });

  it("team: blocks a non-admin from inviting (403)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect((await teamPOST(req("POST", { email: "new@t.test" }))).status).toBe(403);
  });

  it("integrations: blocks a non-admin from writing config (403)", async () => {
    sessionFor(ctx.aMember, ctx.wsA, "member");
    expect((await integrationsPUT(req("PUT", { type: "slack", config: { webhookUrl: "https://x.test" } }))).status).toBe(403);
  });
});
