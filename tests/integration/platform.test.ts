/**
 * Integration tests for the platform (provider) control plane.
 *
 * Asserts the guarantees that make the cross-tenant console safe:
 *   - the platform routes are reachable ONLY by a session carrying
 *     `platformRole: "superadmin"` (a workspace admin without it gets 403), and
 *   - "enter a company" re-issues the session pointed at the target workspace
 *     while preserving platform privilege and the way home, and
 *   - suspend mutates the right workspace and 404 on unknown ids.
 *
 * Mirrors tests/integration/admin-routes.test.ts: a hoisted session holder + a
 * `createSession` spy (so we can inspect the swapped session without a cookie).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";

const holder = vi.hoisted(() => ({
  session: null as null | {
    userId: string; workspaceId: string; role: string; email: string; name: string;
    expiresAt: Date; platformRole?: string; platformHomeWorkspaceId?: string;
  },
  created: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/lib/session", () => ({
  getSession: async () => holder.session,
  createSession: async (payload: Record<string, unknown>) => { holder.created.push(payload); },
  deleteSession: async () => {},
}));

import { prisma } from "@/lib/prisma";
import { GET as workspacesGET } from "@/app/api/platform/workspaces/route";
import { PATCH as workspacePATCH } from "@/app/api/platform/workspaces/[id]/route";
import { POST as enterPOST } from "@/app/api/platform/workspaces/[id]/enter/route";
import { POST as exitPOST } from "@/app/api/platform/exit/route";
import { DELETE as memberDELETE } from "@/app/api/platform/workspaces/[id]/members/[membershipId]/route";

const MARK = `plat${Date.now()}`;

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
function memberSeg(id: string, membershipId: string) {
  return { params: Promise.resolve({ id, membershipId }) };
}
function memberSession(userId: string, workspaceId: string, role: string) {
  holder.session = { userId, workspaceId, role, email: `${userId}@t.test`, name: userId, expiresAt: new Date(Date.now() + 6e5) };
}
function platformSession(userId: string, homeWorkspaceId: string) {
  holder.session = {
    userId, workspaceId: homeWorkspaceId, role: "admin", email: `${userId}@t.test`, name: userId,
    expiresAt: new Date(Date.now() + 6e5), platformRole: "superadmin", platformHomeWorkspaceId: homeWorkspaceId,
  };
}

type Ctx = {
  wsA: string; wsB: string; staff: string; member: string; extra: string;
  wsBAdminMembership: string; wsBMemberMembership: string; userIds: string[];
};
const ctx = {} as Ctx;

beforeAll(async () => {
  const wsA = await prisma.workspace.create({ data: { name: "Plat A", slug: `plat-wsa-${MARK}` } });
  const wsB = await prisma.workspace.create({ data: { name: "Plat B", slug: `plat-wsb-${MARK}` } });
  const mk = (email: string) =>
    prisma.user.create({ data: { name: email, email: `${email}-${MARK}@t.test`, passwordHash: "x" } });
  const staff = await mk("staff");
  const member = await mk("member");
  const extra = await mk("extra");
  // The staff user owns workspace A (so "exit" can read back a real membership role).
  await prisma.workspaceMembership.create({ data: { workspaceId: wsA.id, userId: staff.id, role: "admin" } });
  // Workspace B: `member` is its sole admin (last-admin guard), `extra` is a removable member.
  const wsBAdmin = await prisma.workspaceMembership.create({ data: { workspaceId: wsB.id, userId: member.id, role: "admin" } });
  const wsBMember = await prisma.workspaceMembership.create({ data: { workspaceId: wsB.id, userId: extra.id, role: "member" } });
  Object.assign(ctx, {
    wsA: wsA.id, wsB: wsB.id, staff: staff.id, member: member.id, extra: extra.id,
    wsBAdminMembership: wsBAdmin.id, wsBMemberMembership: wsBMember.id,
    userIds: [staff.id, member.id, extra.id],
  });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [ctx.wsA, ctx.wsB] } } });
  await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
});

describe("platform routes - staff-only authorization", () => {
  it("blocks a workspace admin WITHOUT platformRole from the company list (403)", async () => {
    memberSession(ctx.staff, ctx.wsA, "admin"); // admin of their workspace, but not platform staff
    expect((await workspacesGET(req("GET"))).status).toBe(403);
  });

  it("blocks an unauthenticated caller (401)", async () => {
    holder.session = null;
    expect((await workspacesGET(req("GET"))).status).toBe(401);
  });

  it("lets a platform admin list every workspace (cross-tenant)", async () => {
    platformSession(ctx.staff, ctx.wsA);
    const res = await workspacesGET(req("GET"));
    expect(res.status).toBe(200);
    const { workspaces } = (await res.json()) as { workspaces: Array<{ id: string }> };
    const ids = workspaces.map((w) => w.id);
    expect(ids).toContain(ctx.wsA);
    expect(ids).toContain(ctx.wsB);
  });
});

describe("enter / exit - session swap", () => {
  it("blocks a non-staff session from entering (403)", async () => {
    memberSession(ctx.member, ctx.wsB, "admin");
    expect((await enterPOST(req("POST"), seg(ctx.wsB))).status).toBe(403);
  });

  it("404s when entering an unknown workspace", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect((await enterPOST(req("POST"), seg("nope_missing"))).status).toBe(404);
  });

  it("re-issues the session at the target, preserving platform privilege + home", async () => {
    platformSession(ctx.staff, ctx.wsA);
    holder.created.length = 0;
    const res = await enterPOST(req("POST"), seg(ctx.wsB));
    expect(res.status).toBe(200);
    const issued = holder.created.at(-1)!;
    expect(issued.workspaceId).toBe(ctx.wsB);
    expect(issued.platformRole).toBe("superadmin");
    expect(issued.platformHomeWorkspaceId).toBe(ctx.wsA); // way home preserved
  });

  it("does not clobber the home workspace when already impersonating", async () => {
    // Session: home is wsA, currently entered into wsB. Entering again keeps home = wsA.
    holder.session = {
      userId: ctx.staff, workspaceId: ctx.wsB, role: "admin", email: "s@t.test", name: "s",
      expiresAt: new Date(Date.now() + 6e5), platformRole: "superadmin", platformHomeWorkspaceId: ctx.wsA,
    };
    holder.created.length = 0;
    await enterPOST(req("POST"), seg(ctx.wsB));
    expect(holder.created.at(-1)!.platformHomeWorkspaceId).toBe(ctx.wsA);
  });

  it("exit returns the platform admin to their home workspace with their real role", async () => {
    holder.session = {
      userId: ctx.staff, workspaceId: ctx.wsB, role: "admin", email: "s@t.test", name: "s",
      expiresAt: new Date(Date.now() + 6e5), platformRole: "superadmin", platformHomeWorkspaceId: ctx.wsA,
    };
    holder.created.length = 0;
    const res = await exitPOST(req("POST"));
    expect(res.status).toBe(200);
    const issued = holder.created.at(-1)!;
    expect(issued.workspaceId).toBe(ctx.wsA);
    expect(issued.role).toBe("admin"); // read back from the staff user's membership in wsA
    expect(issued.platformRole).toBe("superadmin");
  });
});

describe("suspend / reactivate", () => {
  it("blocks a non-staff session (403)", async () => {
    memberSession(ctx.member, ctx.wsB, "admin");
    expect((await workspacePATCH(req("PATCH", { status: "suspended" }), seg(ctx.wsB))).status).toBe(403);
  });

  it("rejects an empty patch (400)", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect((await workspacePATCH(req("PATCH", {}), seg(ctx.wsB))).status).toBe(400);
  });

  it("404s on an unknown workspace", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect((await workspacePATCH(req("PATCH", { status: "suspended" }), seg("nope_missing"))).status).toBe(404);
  });

  it("suspends and reactivates a company", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect((await workspacePATCH(req("PATCH", { status: "suspended" }), seg(ctx.wsB))).status).toBe(200);
    expect((await prisma.workspace.findUnique({ where: { id: ctx.wsB } }))?.status).toBe("suspended");
    await workspacePATCH(req("PATCH", { status: "active" }), seg(ctx.wsB));
    expect((await prisma.workspace.findUnique({ where: { id: ctx.wsB } }))?.status).toBe("active");
  });

  it("renames a company", async () => {
    platformSession(ctx.staff, ctx.wsA);
    const res = await workspacePATCH(req("PATCH", { name: "Plat B Renamed" }), seg(ctx.wsB));
    expect(res.status).toBe(200);
    expect((await prisma.workspace.findUnique({ where: { id: ctx.wsB } }))?.name).toBe("Plat B Renamed");
  });

  it("rejects a blank rename (400)", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect((await workspacePATCH(req("PATCH", { name: "   " }), seg(ctx.wsB))).status).toBe(400);
  });

  it("changes a company's slug", async () => {
    platformSession(ctx.staff, ctx.wsA);
    const next = `plat-wsb-renamed-${MARK}`;
    expect((await workspacePATCH(req("PATCH", { slug: next }), seg(ctx.wsB))).status).toBe(200);
    expect((await prisma.workspace.findUnique({ where: { id: ctx.wsB } }))?.slug).toBe(next);
  });

  it("rejects a slug already taken by another workspace (400)", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect((await workspacePATCH(req("PATCH", { slug: `plat-wsa-${MARK}` }), seg(ctx.wsB))).status).toBe(400);
  });
});

describe("member removal", () => {
  it("blocks a non-staff session (403)", async () => {
    memberSession(ctx.member, ctx.wsB, "admin");
    expect(
      (await memberDELETE(req("DELETE"), memberSeg(ctx.wsB, ctx.wsBMemberMembership))).status,
    ).toBe(403);
  });

  it("404s when the membership belongs to a different workspace (no leak)", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect(
      (await memberDELETE(req("DELETE"), memberSeg(ctx.wsA, ctx.wsBMemberMembership))).status,
    ).toBe(404);
    expect(await prisma.workspaceMembership.findUnique({ where: { id: ctx.wsBMemberMembership } })).not.toBeNull();
  });

  it("refuses to remove the last admin (400)", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect(
      (await memberDELETE(req("DELETE"), memberSeg(ctx.wsB, ctx.wsBAdminMembership))).status,
    ).toBe(400);
    expect(await prisma.workspaceMembership.findUnique({ where: { id: ctx.wsBAdminMembership } })).not.toBeNull();
  });

  it("refuses to remove a platform administrator - the main admin (400)", async () => {
    platformSession(ctx.staff, ctx.wsA);
    const prev = process.env.PLATFORM_ADMIN_EMAILS;
    process.env.PLATFORM_ADMIN_EMAILS = `extra-${MARK}@t.test`; // `extra` is now a platform admin
    try {
      const res = await memberDELETE(req("DELETE"), memberSeg(ctx.wsB, ctx.wsBMemberMembership));
      expect(res.status).toBe(400);
      expect(
        await prisma.workspaceMembership.findUnique({ where: { id: ctx.wsBMemberMembership } }),
      ).not.toBeNull();
    } finally {
      process.env.PLATFORM_ADMIN_EMAILS = prev;
    }
  });

  it("removes a regular member (200)", async () => {
    platformSession(ctx.staff, ctx.wsA);
    expect(
      (await memberDELETE(req("DELETE"), memberSeg(ctx.wsB, ctx.wsBMemberMembership))).status,
    ).toBe(200);
    expect(await prisma.workspaceMembership.findUnique({ where: { id: ctx.wsBMemberMembership } })).toBeNull();
  });
});
