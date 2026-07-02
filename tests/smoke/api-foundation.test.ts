import { authorizeRole } from "../../src/lib/authorize";
import {
  workspaceWhere,
  decisionVisibilityWhere,
  sameWorkspace,
} from "../../src/lib/tenant";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const SESSION = { userId: "u_1", workspaceId: "w_1" };

export const apiFoundationTests = {
  "authorizeRole: 'auth' allows every role incl. viewer": () => {
    for (const role of ["admin", "member", "viewer"]) {
      assert(authorizeRole(role, "auth").ok, `${role} should pass auth`);
    }
  },

  "authorizeRole: 'writer' blocks viewer, allows admin/member": () => {
    assert(authorizeRole("admin", "writer").ok, "admin writes");
    assert(authorizeRole("member", "writer").ok, "member writes");
    const v = authorizeRole("viewer", "writer");
    assert(!v.ok && v.status === 403, "viewer blocked with 403");
  },

  "authorizeRole: 'admin' allows only admin": () => {
    assert(authorizeRole("admin", "admin").ok, "admin passes");
    const m = authorizeRole("member", "admin");
    assert(!m.ok && m.status === 403, "member blocked");
    const v = authorizeRole("viewer", "admin");
    assert(!v.ok && v.status === 403, "viewer blocked");
  },

  "workspaceWhere: scopes by the session workspace": () => {
    assert(workspaceWhere(SESSION).workspaceId === "w_1", "workspaceId set");
  },

  "decisionVisibilityWhere: workspace + (workspace-visible OR own private)": () => {
    const w = decisionVisibilityWhere(SESSION);
    assert(w.workspaceId === "w_1", "workspace scoped");
    assert(Array.isArray(w.OR) && w.OR.length === 2, "two visibility branches");
    const json = JSON.stringify(w.OR);
    assert(json.includes("workspace"), "includes workspace-visible branch");
    assert(json.includes("u_1"), "includes own-private (createdByUserId) branch");
  },

  "sameWorkspace: returns the row only on a workspace match": () => {
    const mine = { id: "d1", workspaceId: "w_1" };
    const theirs = { id: "d2", workspaceId: "w_2" };
    assert(sameWorkspace(mine, SESSION) === mine, "same workspace → row");
    assert(sameWorkspace(theirs, SESSION) === null, "other workspace → null");
    assert(sameWorkspace(null, SESSION) === null, "null row → null");
  },
};
