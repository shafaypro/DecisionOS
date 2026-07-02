/**
 * Platform route handler wrapper - the provider control-plane counterpart to
 * `withApi`. It standardizes auth → platform-authorize → validate → handle for
 * `/api/platform/*` routes.
 *
 *   export const GET = withPlatformApi({}, async ({ session }) => …);
 *
 * Deliberately separate from `withApi`: platform privilege is a different axis
 * from the workspace role, and keeping the two wrappers apart means the existing
 * workspace authorization (and the tenancy guarantees it enforces) is never
 * affected by platform code. Platform routes intentionally do NOT scope queries
 * by `session.workspaceId` - that's the whole point of the console - so they must
 * only ever be reached through this wrapper.
 */

import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { getSession, type SessionPayload } from "./session";
import { authorizePlatform } from "./platform-authorize";
import { parseBody } from "./schemas";
import { logger } from "./logger";

export interface PlatformApiContext<TBody, TParams> {
  session: SessionPayload;
  body: TBody;
  params: TParams;
  req: NextRequest;
}

export interface WithPlatformApiOptions<TBody> {
  /** Zod schema for the JSON body. When set, `ctx.body` is validated + typed. */
  schema?: z.ZodType<TBody>;
}

type Handler<TBody, TParams> = (
  ctx: PlatformApiContext<TBody, TParams>,
) => Promise<NextResponse> | NextResponse;

export function withPlatformApi<TBody = undefined, TParams = Record<string, never>>(
  opts: WithPlatformApiOptions<TBody>,
  handler: Handler<TBody, TParams>,
) {
  return async (
    req: NextRequest,
    segment?: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    let session: SessionPayload | null = null;
    try {
      session = await getSession();

      const authz = authorizePlatform(session);
      if (!authz.ok) {
        return NextResponse.json({ error: authz.error }, { status: authz.status });
      }

      let body = undefined as TBody;
      if (opts.schema) {
        const json = await req.json().catch(() => null);
        const parsed = parseBody(opts.schema, json);
        if (!parsed.ok) return NextResponse.json(parsed.error, { status: parsed.status });
        body = parsed.data;
      }

      const params = (segment?.params ? await segment.params : ({} as TParams));
      // `session` is non-null here - authorizePlatform returns 401 otherwise.
      return await handler({ session: session as SessionPayload, body, params, req });
    } catch (err) {
      logger.error("platform_api_unhandled_error", {
        path: req.nextUrl?.pathname,
        method: req.method,
        userId: session?.userId,
        err,
      });
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}
