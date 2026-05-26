import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // First-time visitor: redirect root to welcome page
  if (pathname === "/") {
    const welcomeSeen = request.cookies.get("welcome_seen");
    if (!welcomeSeen) {
      return NextResponse.redirect(new URL("/welcome", request.url));
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     * - sw.js (service worker)
     * - api/ (API routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|api/).*)",
  ],
};
