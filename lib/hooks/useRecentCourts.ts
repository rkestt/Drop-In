import { useCallback, useState } from "react";
import { getRecentCourts, addRecentCourt } from "@/lib/cache/recent-courts";
import type { Court } from "@/lib/cache/types";
import { useCourtCache } from "./useCourtCache";

export function useRecentCourts() {
  const { courts } = useCourtCache();
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return (getRecentCourts() ?? []).map((c) => c.id);
  });

  const addRecent = useCallback(
    (court: Pick<Court, "id" | "name" | "address" | "sport">) => {
      addRecentCourt(court);
      setRecentIds((prev) => {
        const filtered = prev.filter((id) => id !== court.id);
        return [court.id, ...filtered].slice(0, 5);
      });
    },
    []
  );

  const recentCourts = recentIds
    .map((id) => courts.find((c) => c.id === id))
    .filter((c): c is Court => !!c);

  return { recentCourts, addRecent };
}