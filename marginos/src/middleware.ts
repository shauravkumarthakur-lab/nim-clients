import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [/^\/$/, /^\/login/, /^\/signup/, /^\/forgot-password/, /^\/reset-password/, /^\/invite\//, /^\/offline/, /^\/api\/health/, /^\/dev\/mailbox/];

/** Cheap edge gate: no session cookie → login. Real validation happens server-side in getCtx(). */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  if (!req.cookies.get("mos_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/dashboard" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|sw.js|manifest.webmanifest|favicon.ico|robots.txt).*)"],
};
