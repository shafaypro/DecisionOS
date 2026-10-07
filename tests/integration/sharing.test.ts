/**
 * Public sharing is opt-in: nothing is public until a member creates a link,
 * the link is a random token (never the decision id), it can be revoked, it is
 * refused for private decisions, and an admin can turn links off workspace-wide
 * (which revokes the existing ones).
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
import { POST as sharePOST, DELETE as shareDELETE } from "@/app/api/decisions/[id]/share/route";
import { PUT as sharingPUT } from "@/app/api/settings/sharing/route";
import { PUT as decisionPUT } from "@/app/api/decisions/[id]/route";

const MARK = `shr${Date.now()}`;
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/x", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const seg = (id: string) => ({ params: Promise.resolve({ id }) });
function sessionFor(userId: string, workspaceId: string, role: string) {
  holder.session = { userId, workspaceId, role, email: `${userId}@t.test`, name: userId, expiresAt: new Date(Date.now() + 6e5) };
}

const ctx = {} as { ws: string; other: string; admin: string; member: string; outsider: string; pub: string; priv: string; foreign: string };

beforeAll(async () => {
  const ws = await prisma.workspace.create({ data: { name: "Share WS", slug: `shr-${MARK}` } });
  const other = await prisma.workspace.create({ data: { name: "Other WS", slug: `shr-o-${MARK}` } });
  const mk = (n: string) => prisma.user.create({ data: { name: n, email: `${n}-${MARK}@t.test`, passwordHash: "x" } });
  const [admin, member, outsider] = await Promise.all([mk("admin"), mk("member"), mk("outsider")]);
  await prisma.workspaceMembership.createMany({
    data: [
      { workspaceId: ws.id, userId: admin.id, role: "admin" },
      { workspaceId: ws.id, userId: member.id, role: "member" },
      { workspaceId: other.id, userId: outsider.id, role: "admin" },
    ],
  });
  const d = (workspaceId: string, createdByUserId: string, visibility: string) =>
    prisma.decision.create({ data: { workspaceId, createdByUserId, title: `${MARK} ${visibility}`, visibility } });
  const [pub, priv, foreign] = await Promise.all([
    d(ws.id, member.id, "workspace"),
    d(ws.id, member.id, "private"),
    d(other.id, outsider.id, "workspace"),
  ]);
  Object.assign(ctx, { ws: ws.id, other: other.id, admin: admin.id, member: member.id, outsider: outsider.id, pub: pub.id, priv: priv.id, foreign: foreign.id });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [ctx.ws, ctx.other] } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
});

const tokenOf = async (id: string) => (await prisma.decision.findUnique({ where: { id } }))?.shareToken ?? null;

describe("per-decision public links", () => {
  it("nothing is shared until someone creates a link", async () => {
    expect(await tokenOf(ctx.pub)).toBeNull();
  });

  it("creating a link mints a random token, not the id, and is idempotent", async () => {
    sessionFor(ctx.member, ctx.ws, "member");
    const first = (await (await sharePOST(req("POST"), seg(ctx.pub))).json()) as { url: string };
    const token = await tokenOf(ctx.pub);
    expect(token).toBeTruthy();
    expect(token).not.toContain(ctx.pub);
    expect(first.url.endsWith(`/share/${token}`)).toBe(true);

    const again = (await (await sharePOST(req("POST"), seg(ctx.pub))).json()) as { url: string };
    expect(again.url).toBe(first.url);
  });

  it("revoking clears the token; sharing again issues a different one", async () => {
    sessionFor(ctx.member, ctx.ws, "member");
    const before = await tokenOf(ctx.pub);
    expect((await shareDELETE(req("DELETE"), seg(ctx.pub))).status).toBe(200);
    expect(await tokenOf(ctx.pub)).toBeNull();
    await sharePOST(req("POST"), seg(ctx.pub));
    const after = await tokenOf(ctx.pub);
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it("refuses private decisions, viewers, and other workspaces", async () => {
    sessionFor(ctx.member, ctx.ws, "member");
    expect((await sharePOST(req("POST"), seg(ctx.priv))).status).toBe(400);
    expect((await sharePOST(req("POST"), seg(ctx.foreign))).status).toBe(404);
    sessionFor(ctx.member, ctx.ws, "viewer");
    expect((await sharePOST(req("POST"), seg(ctx.pub))).status).toBe(403);
  });

  it("making a shared decision private revokes its link", async () => {
    sessionFor(ctx.member, ctx.ws, "member");
    await sharePOST(req("POST"), seg(ctx.pub));
    expect(await tokenOf(ctx.pub)).toBeTruthy();
    expect((await decisionPUT(req("PUT", { visibility: "private" }), seg(ctx.pub))).status).toBe(200);
    expect(await tokenOf(ctx.pub)).toBeNull();
    await decisionPUT(req("PUT", { visibility: "workspace" }), seg(ctx.pub));
  });
});

describe("workspace switch", () => {
  it("only admins can change it", async () => {
    sessionFor(ctx.member, ctx.ws, "member");
    expect((await sharingPUT(req("PUT", { publicSharing: false }))).status).toBe(403);
  });

  it("turning links off revokes existing ones and blocks new ones", async () => {
    sessionFor(ctx.member, ctx.ws, "member");
    await sharePOST(req("POST"), seg(ctx.pub));
    expect(await tokenOf(ctx.pub)).toBeTruthy();

    sessionFor(ctx.admin, ctx.ws, "admin");
    expect((await sharingPUT(req("PUT", { publicSharing: false }))).status).toBe(200);
    expect(await tokenOf(ctx.pub)).toBeNull();

    sessionFor(ctx.member, ctx.ws, "member");
    expect((await sharePOST(req("POST"), seg(ctx.pub))).status).toBe(403);

    sessionFor(ctx.admin, ctx.ws, "admin");
    await sharingPUT(req("PUT", { publicSharing: true }));
    // Re-enabling doesn't resurrect the revoked link.
    expect(await tokenOf(ctx.pub)).toBeNull();
  });
});
