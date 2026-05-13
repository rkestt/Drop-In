import { useEffect, useState } from "react";
import { getCachedCourts, setCachedCourts } from "@/lib/cache/courts";
import { createClient } from "@/lib/supabase/client";
import type { Court } from "@/lib/cache/types";
import { USE_COURT_CACHE } from "@/lib/cache/types";

export function useCourtCache() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    const fetchAndCache = async () => {
      if (!USE_COURT_CACHE) {
        await fetchFresh();
        return;
      }

      const cached = getCachedCourts();

      if (cached && !cancelled) {
        setCourts(cached);
        setLoading(false);
        setIsStale(true);
      }

      await fetchFresh();
    };

    const fetchFresh = async () => {
      try {
        const { data } = await supabase
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

        if (!cancelled) {
          if (data) {
            setCachedCourts(data as Court[]);
            setCourts(data as Court[]);
          }
          setIsStale(false);
        }
      } catch (err) {
        console.warn("Courts fetch failed:", err);
        if (!cancelled) {
          setLoading(false);
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    fetchAndCache();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return { courts, loading, isStale };
}