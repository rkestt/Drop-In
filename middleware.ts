import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { withSecurityHeaders } from "@/lib/security/headers";

export async function middleware(request: NextRequest) {
  // Anche i redirect del login passano di qui: gli header vanno su ogni
  // risposta, non solo su `NextResponse.next()`.
  return withSecurityHeaders(await updateSession(request));
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
