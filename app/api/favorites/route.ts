import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("favorite_court_ids")
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ favorite_court_ids: [] }, { status: 200 });
  }

  return NextResponse.json({
    favorite_court_ids: (data as unknown as { favorite_court_ids: string[] }).favorite_court_ids ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { court_id, action } = body as {
    court_id: string;
    action: "add" | "remove";
  };

  if (!court_id || !action) {
    return NextResponse.json({ error: "court_id and action required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("favorite_court_ids")
    .eq("user_id", user.id)
    .single();

  const current = (profile as unknown as { favorite_court_ids: string[] } | null)?.favorite_court_ids ?? [];

  const updated =
    action === "add"
      ? [...new Set([...current, court_id])]
      : current.filter((id) => id !== court_id);

  const { error } = await supabase
    .from("profiles")
    .update({ favorite_court_ids: updated } as unknown as never)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favorite_court_ids: updated });
}
