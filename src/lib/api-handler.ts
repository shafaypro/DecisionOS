/**
 * Route handler wrapper - standardizes the auth → authorize → validate → handle
 * → error pipeline that every mutation route re-implemented by hand (with subtle
 * drift). Handlers receive a typed context and focus on business logic.
 *
 *   export const POST = withApi(
 *     { require: "writer", schema: NoteWriteSchema },
 *     async ({ session, body }) => NextResponse.json(await createNote(session, body)),
 *   );
 *
 * Routes with dynamic params get them typed and already-awaited:
 *   withApi<Body, { id: string }>({ require: "admin" }, async ({ params }) => …)
 */

import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { getSession, type SessionPayload } from "./session";
import { authorizeRole, type RequireLevel } from "./authorize";
import { isPlatformAdmin } from "./auth-guards";
import { revalidateWorkspaceAccess } from "./access-control";
import { parseBody } from "./schemas";
import { logger } from "./logger";

export interface ApiContext<TBody, TParams> {
  session: SessionPayload;
  body: TBody;
  params: TParams;
  req: NextRequest;
}

export interface WithApiOptions<TBody> {
  /** Minimum capability required (default "auth"). */
  require?: RequireLevel;
  /** Zod schema for the JSON body. When set, `ctx.body` is validated + typed. */
  schema?: z.ZodType<TBody>;
}

type Handler<TBody, TParams> = (
  ctx: ApiContext<TBody, TParams>,
) => Promise<NextResponse> | NextResponse;

export function withApi<TBody = undefined, TParams = Record<string, never>>(
  opts: WithApiOptions<TBody>,
  handler: Handler<TBody, TParams>,
) {
  return async (
    req: NextRequest,
    segment?: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    let session: SessionPayload | null = null;
    try {
      session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const authz = authorizeRole(session.role, opts.require ?? "auth");
      if (!authz.ok) {
        return NextResponse.json({ error: authz.error }, { status: authz.status });
      }

      // Re-check that the 7-day cookie still reflects live access: a removed
      // member or a suspended workspace must lose API access now, not whenever
      // the session happens to expire. Platform staff who have "entered" a
      // workspace have no membership row there by design (their privilege comes
      // from the allow-list), so they bypass this check.
      if (!isPlatformAdmin(session.platformRole)) {
        const access = await revalidateWorkspaceAccess(session.userId, session.workspaceId);
        if (!access.ok) {
          return NextResponse.json({ error: access.error }, { status: access.status });
        }
      }

      let body = undefined as TBody;
      if (opts.schema) {
        const json = await req.json().catch(() => null);
        const parsed = parseBody(opts.schema, json);
        if (!parsed.ok) return NextResponse.json(parsed.error, { status: parsed.status });
        body = parsed.data;
      }

      const params = (segment?.params ? await segment.params : ({} as TParams));
      return await handler({ session, body, params, req });
    } catch (err) {
      // Pass the Error itself (not just its message) so the error tracker can
      // group by stack; logger serializes it for the structured log line.
      logger.error("api_unhandled_error", {
        path: req.nextUrl?.pathname,
        method: req.method,
        userId: session?.userId,
        workspaceId: session?.workspaceId,
        err,
      });
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}
