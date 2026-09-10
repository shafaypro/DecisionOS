import { NextRequest, NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi";

/**
 * The OpenAPI 3.1 description of this deployment's API.
 *
 * Unauthenticated on purpose: it documents the *shape* of the API and contains
 * no workspace data, exactly like the published route source. Making it public
 * is what lets a client generator or Swagger UI point straight at a running
 * instance.
 */
export function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const doc = buildOpenApiDocument({ baseUrl });

  return NextResponse.json(doc, {
    headers: {
      // Static per deployment - safe to cache at the edge for a while.
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
