/**
 * Integration tests for the search filter language and the export formats.
 *
 * The grammar and the serializers have their own unit tests; what's verified
 * here is the wiring - that a `status:` term actually narrows the SQL query,
 * that `tag:` resolves against this workspace's tags, that a `health:` term is
 * applied after fetching, and that `?format=` returns the right bytes. Mirrors
 * tenancy.test.ts: a hoisted session holder and a mocked @/lib/session drive the
 * handlers directly against the shared SQLite dev.db.
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
import { GET as searchGET } from "@/app/api/decisions/search/route";
import { GET as exportGET } from "@/app/api/decisions/export/route";
import { GET as markdownGET } from "@/app/api/decisions/[id]/markdown/route";

const MARK = `sxq${Date.now()}`;

type Ctx = {
  ws: string;
  owner: string;
  other: string;
  approved: string;
  draft: string;
  overdue: string;
  tagId: string;
};
const ctx = {} as Ctx;

function setSession(userId: string, workspaceId: string, role = "admin") {
  holder.session = {
    userId,
    workspaceId,
    role,
    email: `${userId}@t.test`,
    name: userId,
    expiresAt: new Date(Date.now() + 6e5),
  };
}

async function search(q: string): Promise<{ ids: string[]; warnings: string[] }> {
  const res = await searchGET(
    new NextRequest(`http://localhost/api/decisions/search?q=${encodeURIComponent(q)}`),
  );
  const json = (await res.json()) as { decisions: { id: string }[]; warnings: string[] };
  return { ids: json.decisions.map((d) => d.id), warnings: json.warnings };
}

function exportReq(format?: string) {
  const url = format
    ? `http://localhost/api/decisions/export?format=${format}`
    : "http://localhost/api/decisions/export";
  return new NextRequest(url);
}

beforeAll(async () => {
  const ws = await prisma.workspace.create({ data: { name: "WS Q", slug: `wsq-${MARK}` } });
  const mk = (email: string) =>
    prisma.user.create({ data: { name: email, email: `${email}-${MARK}@t.test`, passwordHash: "x" } });
  const owner = await mk("qowner");
  const other = await mk("qother");

  await prisma.workspaceMembership.createMany({
    data: [
      { workspaceId: ws.id, userId: owner.id, role: "admin" },
      { workspaceId: ws.id, userId: other.id, role: "member" },
    ],
  });

  const tag = await prisma.tag.create({ data: { workspaceId: ws.id, name: `infra-${MARK}` } });

  const approved = await prisma.decision.create({
    data: {
      workspaceId: ws.id,
      createdByUserId: owner.id,
      ownerUserId: owner.id,
      title: `${MARK} approved database migration`,
      status: "approved",
      impactLevel: "high",
      category: "engineering",
      rationale: `${MARK} cost and lock-in`,
      risks: `${MARK} dual-write window`,
    },
  });
  const draft = await prisma.decision.create({
    data: {
      workspaceId: ws.id,
      createdByUserId: other.id,
      title: `${MARK} draft hiring rubric`,
      status: "draft",
      impactLevel: "low",
      category: "hiring",
    },
  });
  const overdue = await prisma.decision.create({
    data: {
      workspaceId: ws.id,
      createdByUserId: owner.id,
      title: `${MARK} overdue vendor choice`,
      status: "approved",
      reviewDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.decisionTag.create({ data: { decisionId: approved.id, tagId: tag.id } });

  Object.assign(ctx, {
    ws: ws.id,
    owner: owner.id,
    other: other.id,
    approved: approved.id,
    draft: draft.id,
    overdue: overdue.id,
    tagId: tag.id,
  });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: ctx.ws } });
  await prisma.user.deleteMany({ where: { id: { in: [ctx.owner, ctx.other] } } });
});

describe("search - filter language", () => {
  it("narrows by status", async () => {
    setSession(ctx.owner, ctx.ws);
    const { ids } = await search(`${MARK} status:draft`);
    expect(ids).toContain(ctx.draft);
    expect(ids).not.toContain(ctx.approved);
  });

  it("ANDs different fields and ORs a repeated one", async () => {
    setSession(ctx.owner, ctx.ws);
    expect((await search(`${MARK} status:approved impact:high`)).ids).toEqual([ctx.approved]);

    const either = (await search(`${MARK} status:approved status:draft`)).ids;
    expect(either).toContain(ctx.approved);
    expect(either).toContain(ctx.draft);
  });

  it("excludes with a leading dash", async () => {
    setSession(ctx.owner, ctx.ws);
    const { ids } = await search(`${MARK} -status:draft`);
    expect(ids).not.toContain(ctx.draft);
    expect(ids).toContain(ctx.approved);
  });

  it("resolves owner:me against the caller", async () => {
    setSession(ctx.owner, ctx.ws);
    expect((await search(`${MARK} owner:me`)).ids).toEqual([ctx.approved]);

    setSession(ctx.other, ctx.ws, "member");
    expect((await search(`${MARK} owner:me`)).ids).toEqual([]);
  });

  it("supports is: shorthands", async () => {
    setSession(ctx.owner, ctx.ws);
    expect((await search(`${MARK} is:overdue`)).ids).toEqual([ctx.overdue]);
    expect((await search(`${MARK} is:unowned`)).ids).not.toContain(ctx.approved);
  });

  it("resolves tag names to this workspace's tags", async () => {
    setSession(ctx.owner, ctx.ws);
    expect((await search(`${MARK} tag:infra-${MARK}`)).ids).toEqual([ctx.approved]);

    const unknown = await search(`${MARK} tag:nosuchtag`);
    expect(unknown.warnings.join(" ")).toContain("No tag named");
  });

  it("applies the derived health filter after fetching", async () => {
    setSession(ctx.owner, ctx.ws);
    expect((await search(`${MARK} health:review-overdue`)).ids).toEqual([ctx.overdue]);
  });

  it("warns and degrades to text on an unknown filter rather than erroring", async () => {
    setSession(ctx.owner, ctx.ws);
    const { warnings } = await search(`${MARK} bogus:value`);
    expect(warnings.join(" ")).toContain("Unknown filter");
  });
});

describe("export - formats", () => {
  it("defaults to CSV", async () => {
    setSession(ctx.owner, ctx.ws);
    const res = await exportGET(exportReq());
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toContain("approved database migration");
  });

  it("returns a versioned JSON envelope", async () => {
    setSession(ctx.owner, ctx.ws);
    const res = await exportGET(exportReq("json"));
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = JSON.parse(await res.text()) as {
      schemaVersion: number;
      workspace: { id: string };
      decisions: { title: string }[];
    };
    expect(body.schemaVersion).toBe(1);
    expect(body.workspace.id).toBe(ctx.ws);
    expect(body.decisions.some((d) => d.title.includes("approved database migration"))).toBe(true);
  });

  it("returns a Markdown bundle with a table of contents", async () => {
    setSession(ctx.owner, ctx.ws);
    const res = await exportGET(exportReq("md"));
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const text = await res.text();
    expect(text).toContain("## Contents");
    expect(text).toContain("## Rationale");
  });

  it("exports a single decision as an ADR-style Markdown file", async () => {
    setSession(ctx.owner, ctx.ws);
    const res = await markdownGET(
      new NextRequest(`http://localhost/api/decisions/${ctx.approved}/markdown`),
      { params: Promise.resolve({ id: ctx.approved }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(".md");
    const text = await res.text();
    expect(text.startsWith("---")).toBe(true);
    expect(text).toContain("## Rationale");
  });

  it("404s on a decision from another workspace", async () => {
    const foreign = await prisma.workspace.create({ data: { name: "WS Z", slug: `wsz-${MARK}` } });
    try {
      setSession(ctx.owner, ctx.ws);
      const other = await prisma.decision.create({
        data: { workspaceId: foreign.id, createdByUserId: ctx.owner, title: `${MARK} foreign` },
      });
      const res = await markdownGET(
        new NextRequest(`http://localhost/api/decisions/${other.id}/markdown`),
        { params: Promise.resolve({ id: other.id }) },
      );
      expect(res.status).toBe(404);
    } finally {
      await prisma.workspace.deleteMany({ where: { id: foreign.id } });
    }
  });
});
