import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  // Double gate: only available in local development
  if (
    process.env.NODE_ENV !== "development" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Route handlers: cookies().set() modifies the response cookie jar
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  // 1. Try sign-in with existing dev user
  const { error } = await supabase.auth.signInWithPassword({
    email: "dev@localhost",
    password: "devdevdev",
  });

  if (!error) {
    return NextResponse.json({ ok: true });
  }

  // 2. Sign-in failed — user doesn't exist yet, create via Admin API
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email: "dev@localhost",
      password: "devdevdev",
      email_confirm: true,
      user_metadata: { dev_user: true },
    });

  if (createError) {
    // User might already exist from a previous run
    if (!createError.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
  }

  if (created?.user) {
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
  const { error: retryError } = await supabase.auth.signInWithPassword({
    email: "dev@localhost",
    password: "devdevdev",
  });

  if (retryError) {
    return NextResponse.json({ error: retryError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
