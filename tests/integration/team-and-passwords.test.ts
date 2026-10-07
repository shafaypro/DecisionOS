/**
 * Invitations, set-password links, and role management: an invited person can
 * actually get in, links are single-use, and role changes keep at least one
 * admin and take effect without waiting for a new sign-in.
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

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { POST as teamPOST } from "@/app/api/team/route";
import { PATCH as teamPATCH } from "@/app/api/team/[id]/route";
import { POST as decisionsPOST } from "@/app/api/decisions/route";
import { checkPasswordLink, setPasswordFromLink, sendResetLink } from "@/lib/password-links";
import { __resetAccessCache } from "@/lib/access-control";

const MARK = `tpw${Date.now()}`;

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/x", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const seg = (id: string) => ({ params: Promise.resolve({ id }) });
function sessionFor(userId: string, workspaceId: string, role: string) {
  holder.session = { userId, workspaceId, role, email: `${userId}@t.test`, name: userId, expiresAt: new Date(Date.now() + 6e5) };
}
const tokenFrom = (url: string) => decodeURIComponent(url.split("/set-password/")[1]);

const ctx = {} as { ws: string; admin: string; adminMembership: string; userIds: string[] };

beforeAll(async () => {
  const ws = await prisma.workspace.create({ data: { name: "Invite WS", slug: `inv-${MARK}` } });
  const admin = await prisma.user.create({
    data: { name: "Admin", email: `admin-${MARK}@t.test`, passwordHash: await bcrypt.hash("pw-admin-1", 4) },
  });
  const m = await prisma.workspaceMembership.create({ data: { workspaceId: ws.id, userId: admin.id, role: "admin" } });
  Object.assign(ctx, { ws: ws.id, admin: admin.id, adminMembership: m.id, userIds: [admin.id] });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: ctx.ws } });
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
});

describe("invitations and set-password links", () => {
  it("a new invitee gets a working link when email isn't configured", async () => {
    sessionFor(ctx.admin, ctx.ws, "admin");
    const res = await teamPOST(req("POST", { email: `new-${MARK}@t.test`, role: "member" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { inviteUrl?: string };
    expect(body.inviteUrl).toMatch(/\/set-password\//);

    const token = tokenFrom(body.inviteUrl!);
    const check = await checkPasswordLink(token);
    expect(check).toMatchObject({ ok: true, purpose: "invite" });

    const set = await setPasswordFromLink(token, "a-good-password", "New Person");
    expect(set.ok).toBe(true);
    const user = await prisma.user.findUnique({ where: { email: `new-${MARK}@t.test` } });
    expect(user?.name).toBe("New Person");
    expect(await bcrypt.compare("a-good-password", user!.passwordHash)).toBe(true);

    // Single use: the same link no longer works.
    expect(await checkPasswordLink(token)).toEqual({ ok: false, reason: "used" });
    expect((await setPasswordFromLink(token, "another-password")).ok).toBe(false);
  });

  it("an existing account is added without minting a link for it", async () => {
    await prisma.user.create({ data: { name: "Existing", email: `existing-${MARK}@t.test`, passwordHash: "x" } });
    sessionFor(ctx.admin, ctx.ws, "admin");
    const res = await teamPOST(req("POST", { email: `existing-${MARK}@t.test` }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { inviteUrl?: string }).inviteUrl).toBeUndefined();
  });

  it("rejects a short password and keeps the link usable", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.admin } });
    const { url } = await sendResetLink(user);
    const token = tokenFrom(url);
    expect(await setPasswordFromLink(token, "short")).toMatchObject({ ok: false });
    expect(await checkPasswordLink(token)).toMatchObject({ ok: true, purpose: "reset" });
  });

  it("a reset link is invalidated by any later password change", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.admin } });
    const first = tokenFrom((await sendResetLink(user)).url);
    const second = tokenFrom((await sendResetLink(user)).url);
    expect((await setPasswordFromLink(second, "rotated-password-1")).ok).toBe(true);
    expect(await checkPasswordLink(first)).toEqual({ ok: false, reason: "used" });
  });
});

describe("role management", () => {
  it("won't demote the last admin", async () => {
    sessionFor(ctx.admin, ctx.ws, "admin");
    const res = await teamPATCH(req("PATCH", { role: "member" }), seg(ctx.adminMembership));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown role", async () => {
    sessionFor(ctx.admin, ctx.ws, "admin");
    expect((await teamPATCH(req("PATCH", { role: "owner" }), seg(ctx.adminMembership))).status).toBe(400);
  });

  it("a demotion takes effect on the next request, without signing in again", async () => {
    const user = await prisma.user.create({ data: { name: "Writer", email: `writer-${MARK}@t.test`, passwordHash: "x" } });
    const m = await prisma.workspaceMembership.create({ data: { workspaceId: ctx.ws, userId: user.id, role: "member" } });
    __resetAccessCache();

    // Still holding a "member" session cookie, they can write...
    sessionFor(user.id, ctx.ws, "member");
    expect((await decisionsPOST(req("POST", { title: `${MARK} before demotion` }))).status).toBe(200);

    sessionFor(ctx.admin, ctx.ws, "admin");
    expect((await teamPATCH(req("PATCH", { role: "viewer" }), seg(m.id))).status).toBe(200);

    // ...and after the demotion the same cookie is read-only.
    sessionFor(user.id, ctx.ws, "member");
    expect((await decisionsPOST(req("POST", { title: `${MARK} after demotion` }))).status).toBe(403);
  });

  it("can't change a member of another workspace (404)", async () => {
    const other = await prisma.workspace.create({ data: { name: "Other", slug: `inv-other-${MARK}` } });
    const u = await prisma.user.create({ data: { name: "O", email: `other-${MARK}@t.test`, passwordHash: "x" } });
    const m = await prisma.workspaceMembership.create({ data: { workspaceId: other.id, userId: u.id, role: "member" } });
    sessionFor(ctx.admin, ctx.ws, "admin");
    expect((await teamPATCH(req("PATCH", { role: "viewer" }), seg(m.id))).status).toBe(404);
    await prisma.workspace.delete({ where: { id: other.id } });
  });
});
