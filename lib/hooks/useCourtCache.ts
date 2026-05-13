import { useEffect, useState } from "react";
import { getCachedCourts, setCachedCourts } from "@/lib/cache/courts";
import type { Court } from "@/lib/cache/types";
import { USE_COURT_CACHE } from "@/lib/cache/types";

export function useCourtCache() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);

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
        const response = await fetch("/api/courts", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!cancelled) {
          if (result.data) {
            setCachedCourts(result.data as Court[]);
            setCourts(result.data as Court[]);
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
  }, []);

  return { courts, loading, isStale };
}