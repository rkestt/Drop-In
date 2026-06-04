import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    let response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[Auth Callback] Exchange failed:", error.message, error.code);
      return NextResponse.redirect(`${origin}/?error=auth_callback_failed&msg=${encodeURIComponent(error.message)}`);
    }
    console.log("[Auth Callback] Session created for user:", data.user?.email);
    return response;
  }

  console.error("[Auth Callback] No code in URL");
  return NextResponse.redirect(`${origin}/?error=auth_callback_failed&msg=no_code`);
}
