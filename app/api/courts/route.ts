import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

const FILTER_SPORTS = ["basketball", "volleyball", "soccer", "tennis", "padel"];

export async function GET() {
  try {
    const supabase = await createClient();

    // Build OR conditions for exact matches
    const exactConditions = FILTER_SPORTS.map(
      (s) => `sport.eq.${s}`
    ).join(",");
    exactConditions.split(",");

    // Build ILIKE conditions for multi-sport courts (e.g., "basketball;soccer")
    const likeConditions = FILTER_SPORTS.map(
      (s) => `sport.ilike.*${s}*`
    ).join(",");

    // Combine: exact matches OR containing any filter sport
    const orConditions = `${exactConditions},${likeConditions},sport.eq.multi`;

    const { data, error } = await supabase
      .from("courts")
      .select("id, name, lat, lng, address, sport, zone")
      .or(orConditions)
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