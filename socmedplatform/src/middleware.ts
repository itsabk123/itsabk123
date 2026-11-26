import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Fast gate for authenticated areas (full session validation still happens server-side in each layout).
  if ((pathname.startsWith("/app") || pathname.startsWith("/admin") || pathname.startsWith("/pay")) && !req.cookies.get("mj_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  // Expose the current path to server components (used for the language switch "back" link).
  const h = new Headers(req.headers);
  h.set("x-pathname", pathname + search);
  return NextResponse.next({ request: { headers: h } });
}
export const config = { matcher: ["/((?!_next|api|favicon.ico|r/).*)"] };
