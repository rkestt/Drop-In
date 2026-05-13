import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@supabase/supabase-js";

const supabase = createSupabaseServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("favorite_court_ids")
    .eq("user_id", userId)
    .single();

  if (error) {
    return NextResponse.json({ favorite_court_ids: [] }, { status: 200 });
  }

  return NextResponse.json({
    favorite_court_ids: (data as unknown as { favorite_court_ids: string[] }).favorite_court_ids ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { user_id, court_id, action } = body as {
    user_id: string;
    court_id: string;
    action: "add" | "remove";
  };

  if (!user_id || !court_id || !action) {
    return NextResponse.json({ error: "user_id, court_id, action required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("favorite_court_ids")
    .eq("user_id", user_id)
    .single();

  const current = (profile as unknown as { favorite_court_ids: string[] } | null)?.favorite_court_ids ?? [];

  const updated =
    action === "add"
      ? [...new Set([...current, court_id])]
      : current.filter((id) => id !== court_id);

  const { error } = await supabase
    .from("profiles")
    .update({ favorite_court_ids: updated } as unknown as never)
    .eq("user_id", user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favorite_court_ids: updated });
}