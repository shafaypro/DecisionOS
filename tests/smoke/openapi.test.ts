import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DOCUMENTED_PATHS, buildOpenApiDocument } from "../../src/lib/openapi";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

type Json = Record<string, unknown>;

const doc = () => buildOpenApiDocument({ baseUrl: "https://d.acme.com/" }) as Json;

export const openapiTests = {
  "emits a valid 3.1 document with info, servers, and paths": () => {
    const d = doc();
    assert(d.openapi === "3.1.0", "OpenAPI version");
    const info = d.info as Json;
    assert(typeof info.title === "string" && (info.title as string).length > 0, "has a title");
    assert(typeof info.version === "string", "has a version");
    assert(Object.keys(d.paths as Json).length > 0, "documents at least one path");
  },

  "the server URL follows the deployment and drops a trailing slash": () => {
    const servers = doc().servers as { url: string }[];
    assert(servers[0].url === "https://d.acme.com", "normalized base URL");
    const fallback = (buildOpenApiDocument() as Json).servers as { url: string }[];
    assert(fallback[0].url.startsWith("http"), "falls back to a usable local URL");
  },

  "every documented path has a route file on disk": () => {
    const root = resolve(import.meta.dirname, "../../src/app");
    for (const path of DOCUMENTED_PATHS) {
      // /api/decisions/{id} → src/app/api/decisions/[id]/route.ts
      const segments = path.replace(/^\//, "").split("/").map((s) =>
        s.startsWith("{") ? `[${s.slice(1, -1)}]` : s,
      );
      const file = resolve(root, ...segments, "route.ts");
      assert(existsSync(file), `documented path ${path} has no route at ${file}`);
    }
  },

  "every documented path also appears in the spec's paths object": () => {
    const paths = doc().paths as Json;
    for (const path of DOCUMENTED_PATHS) {
      assert(path in paths, `${path} missing from the spec`);
    }
  },

  "the whole document serializes to JSON (no cycles, no undefined keys)": () => {
    const json = JSON.stringify(doc());
    assert(json.length > 1000, "serialized");
    assert(!json.includes("undefined"), "no stray undefined values");
  },

  "every operation declares at least one response": () => {
    const paths = doc().paths as Record<string, Json>;
    for (const [path, item] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(item)) {
        if (method === "parameters") continue;
        const responses = (op as Json).responses as Json | undefined;
        assert(responses && Object.keys(responses).length > 0, `${method.toUpperCase()} ${path} has no responses`);
        assert(typeof (op as Json).summary === "string", `${method.toUpperCase()} ${path} has no summary`);
      }
    }
  },

  "every $ref points at a schema that exists": () => {
    const d = doc();
    const schemas = (d.components as Json).schemas as Json;
    const refs = JSON.stringify(d).match(/#\/components\/schemas\/(\w+)/g) ?? [];
    for (const ref of refs) {
      const name = ref.split("/").pop()!;
      assert(name in schemas, `dangling $ref to ${name}`);
    }
  },

  "the API requires a session by default, and health opts out explicitly": () => {
    const d = doc();
    assert(Array.isArray(d.security) && (d.security as unknown[]).length === 1, "global security set");
    const health = ((d.paths as Json)["/api/health"] as Json).get as Json;
    assert(Array.isArray(health.security) && (health.security as unknown[]).length === 0, "health is public");
  },
};
