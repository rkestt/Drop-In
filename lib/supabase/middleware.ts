import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

  // Refresh session if expired
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();

  let user = cookieUser;

  // Dev login bypass: auto-sign-in for local development only.
  // Double gate: NODE_ENV (compile-time dead) + localhost check (defense in depth).
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost") &&
    !user
  ) {
    user = (await ensureDevSession(supabase)) ?? null;
  }

  // Protect dashboard routes
  if (
    !user &&
    request.nextUrl.pathname.startsWith("/dashboard")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("login", "required");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// ---------------------------------------------------------------------------
// Dev login bypass: auto-sign-in for local development
// Entire block is compile-time dead in production (NODE_ENV inlined by Next.js)
// ---------------------------------------------------------------------------

const DEV_EMAIL = "dev@localhost";
const DEV_PASSWORD = "devdevdev";

/**
 * Tries to sign in as the dev user. If the user doesn't exist yet,
 * creates it via the Supabase Admin API and retries.
 * Returns the signed-in user, or null if everything fails.
 */
async function ensureDevSession(
  ssrClient: ReturnType<typeof createServerClient>,
): Promise<Awaited<ReturnType<typeof ssrClient.auth.getUser>>["data"]["user"]> {
  // 1. Try sign-in with existing dev user
  let { data } = await ssrClient.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });

  if (data.user) return data.user;

  // 2. User doesn't exist — create via Admin API
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // createUser fails harmlessly on duplicate email; retry sign-in below handles it
  const { data: created } = await adminClient.auth.admin.createUser({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: { dev_user: true },
  });

  if (created.user) {
    // Seed profile with max karma so all karma/ban checks pass naturally
    await adminClient.from("profiles").upsert(
      {
        user_id: created.user.id,
        nickname: "Dev",
        karma_score: 999,
        banned_until: null,
      },
      { onConflict: "user_id" },
    );
  }

  // 3. Retry sign-in
  const retry = await ssrClient.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });

  return retry.data.user ?? null;
}
