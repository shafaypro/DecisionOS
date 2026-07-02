import { NextRequest, NextResponse } from "next/server";
import { openSession } from "@/lib/session-crypto";

const publicRoutes = ["/login", "/signup"];
const publicPrefixes = ["/share"];
// Marketing and legal pages are reachable by everyone - no auth gate, and no
// "bounce authed users away" redirect (so the legal links keep working for
// signed-in members). The landing page itself redirects authenticated visitors
// to their decision log.
const marketingRoutes = ["/", "/privacy", "/terms"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (marketingRoutes.includes(path)) {
    return NextResponse.next();
  }

  const isPublicRoute =
    publicRoutes.includes(path) ||
    publicPrefixes.some((prefix) => path.startsWith(prefix));

  const sessionCookie = req.cookies.get("session");
  const session = await openSession(sessionCookie?.value);

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublicRoute && session) {
    return NextResponse.redirect(new URL("/decisions", req.nextUrl));
  }

  // Platform console: only DecisionOS staff (sessions carrying `platformRole`)
  // may reach /admin*. Everyone else is bounced to their decision log. This is
  // edge-safe - it reads only the decrypted session, no DB.
  if (path.startsWith("/admin") && session?.platformRole !== "superadmin") {
    return NextResponse.redirect(new URL("/decisions", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|.*\\.ico$).*)"],
};
