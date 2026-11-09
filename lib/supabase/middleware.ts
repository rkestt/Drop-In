import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, loginRedirectUrl } from "@/lib/auth/routes";
import { supabaseUrl } from "@/lib/supabase/url";

const GET_USER_TIMEOUT_MS = 3000;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired. Fail open on network errors (offline or
  // unreachable Supabase): treat the user as anonymous instead of 500ing,
  // so public pages and the offline fallback still render. Client-side
  // guards remain the reliable layer; middleware is a UX optimisation.
  let user = null;
  try {
    const getUserPromise = supabase.auth.getUser();
    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("supabase.auth.getUser() timed out")),
        GET_USER_TIMEOUT_MS
      );
      // Avoid keeping the process alive for a settled race.
      getUserPromise.then(
        () => clearTimeout(timer),
        () => clearTimeout(timer)
      );
    });
    const {
      data: { user: fetchedUser },
    } = await Promise.race([getUserPromise, timeout]);
    user = fetchedUser;
  } catch {
    user = null;
  }

  // Protect dashboard routes (route group (dashboard) maps to /lobbies, /profile at root).
  // Exact first-segment match: /profile and /profile/x yes, /profiles no.
  if (isProtectedPath(request.nextUrl.pathname) && !user) {
    return NextResponse.redirect(
      new URL(
        loginRedirectUrl(
          request.nextUrl.pathname,
          request.nextUrl.search
        ),
        request.url
      )
    );
  }

  return supabaseResponse;
}
