/**
 * Integration tests for the GDPR self-serve routes: personal-data export,
 * account deletion (with the sole-admin guard), and workspace deletion.
 * Mirrors tests/integration/platform.test.ts: a hoisted session holder and a
 * mocked @/lib/session so we can drive the withApi handlers directly.
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
import { DELETE as accountDELETE } from "@/app/api/account/route";
import { DELETE as workspaceDELETE } from "@/app/api/settings/workspace/route";
import { GET as exportGET } from "@/app/api/account/export/route";

const MARK = `acct${Date.now()}`;

function req(method: string) {
  return new NextRequest("http://localhost/x", { method });
}
function setSession(userId: string, workspaceId: string, role: string, email: string) {
  holder.session = { userId, workspaceId, role, email, name: userId, expiresAt: new Date(Date.now() + 6e5) };
}

const ctx = {} as {
  wsMulti: string; admin1: string; admin1Email: string; admin2: string;
  wsSolo: string; solo: string;
  wsDel: string; delAdmin: string; delMember: string;
  userIds: string[]; wsIds: string[];
};

beforeAll(async () => {
  const mkUser = (n: string) =>
    prisma.user.create({ data: { name: n, email: `${n}-${MARK}@t.test`, passwordHash: "x" } });
  const wsMulti = await prisma.workspace.create({ data: { name: "Multi", slug: `multi-${MARK}` } });
  const wsSolo = await prisma.workspace.create({ data: { name: "Solo", slug: `solo-${MARK}` } });
  const wsDel = await prisma.workspace.create({ data: { name: "Del", slug: `del-${MARK}` } });
  const admin1 = await mkUser("admin1");
  const admin2 = await mkUser("admin2");
  const solo = await mkUser("solo");
  const delAdmin = await mkUser("deladmin");
  const delMember = await mkUser("delmember");
  await prisma.workspaceMembership.createMany({
    data: [
      { workspaceId: wsMulti.id, userId: admin1.id, role: "admin" },
      { workspaceId: wsMulti.id, userId: admin2.id, role: "admin" },
      { workspaceId: wsSolo.id, userId: solo.id, role: "admin" },
      { workspaceId: wsDel.id, userId: delAdmin.id, role: "admin" },
      { workspaceId: wsDel.id, userId: delMember.id, role: "member" },
    ],
  });
  await prisma.decision.create({
    data: { workspaceId: wsMulti.id, createdByUserId: admin1.id, title: `D-${MARK}` },
  });
  Object.assign(ctx, {
    wsMulti: wsMulti.id, admin1: admin1.id, admin1Email: admin1.email, admin2: admin2.id,
    wsSolo: wsSolo.id, solo: solo.id,
    wsDel: wsDel.id, delAdmin: delAdmin.id, delMember: delMember.id,
    userIds: [admin1.id, admin2.id, solo.id, delAdmin.id, delMember.id],
    wsIds: [wsMulti.id, wsSolo.id, wsDel.id],
  });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: ctx.wsIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
});

describe("personal-data export", () => {
  it("returns the caller's data as JSON without the password hash", async () => {
    setSession(ctx.admin1, ctx.wsMulti, "admin", ctx.admin1Email);
    const res = await exportGET(req("GET"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain(ctx.admin1Email);
    expect(text).not.toContain("passwordHash");
    const json = JSON.parse(text);
    expect(json.account.email).toBe(ctx.admin1Email);
  });
});

describe("account deletion (right to erasure)", () => {
  it("is blocked when the user is the sole admin of a workspace (400)", async () => {
    setSession(ctx.solo, ctx.wsSolo, "admin", `solo-${MARK}@t.test`);
    const res = await accountDELETE(req("DELETE"));
    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: ctx.solo } })).not.toBeNull();
  });

  it("succeeds for a co-admin and cascades, leaving the workspace intact", async () => {
    setSession(ctx.admin2, ctx.wsMulti, "admin", `admin2-${MARK}@t.test`);
    const res = await accountDELETE(req("DELETE"));
    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: ctx.admin2 } })).toBeNull();
    expect(await prisma.workspace.findUnique({ where: { id: ctx.wsMulti } })).not.toBeNull();
    expect(
      await prisma.workspaceMembership.findFirst({ where: { workspaceId: ctx.wsMulti, userId: ctx.admin1 } }),
    ).not.toBeNull();
  });
});

describe("workspace deletion", () => {
  it("requires admin (a member is blocked, 403)", async () => {
    setSession(ctx.delMember, ctx.wsDel, "member", `delmember-${MARK}@t.test`);
    const res = await workspaceDELETE(req("DELETE"));
    expect(res.status).toBe(403);
    expect(await prisma.workspace.findUnique({ where: { id: ctx.wsDel } })).not.toBeNull();
  });

  it("deletes the workspace and cascades its members", async () => {
    setSession(ctx.delAdmin, ctx.wsDel, "admin", `deladmin-${MARK}@t.test`);
    const res = await workspaceDELETE(req("DELETE"));
    expect(res.status).toBe(200);
    expect(await prisma.workspace.findUnique({ where: { id: ctx.wsDel } })).toBeNull();
    expect(await prisma.workspaceMembership.findFirst({ where: { workspaceId: ctx.wsDel } })).toBeNull();
  });
});
