import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("courts")
      .select("id, name, lat, lng, address, sport, zone")
      .or(
        "sport.ilike.*basket*,sport.eq.basketball," +
        "sport.ilike.*volleyball*,sport.eq.volleyball," +
        "sport.ilike.*soccer*,sport.eq.soccer,sport.eq.futsal,sport.ilike.*futsal*," +
        "sport.ilike.*tennis*,sport.eq.tennis," +
        "sport.ilike.*padel*,sport.eq.padel," +
        "sport.eq.multi"
      )
      .limit(10000);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch courts" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data, timestamp: Date.now(), version: 1 },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}