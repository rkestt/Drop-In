import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./useAuth";
import { useCourtCache } from "./useCourtCache";
import type { Court } from "@/lib/cache/types";

export function useFavorites() {
  const { user } = useAuth();
  const { courts } = useCourtCache();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    const fetchFavorites = async () => {
      try {
        const res = await fetch(
          `/api/favorites?userId=${user.id}`,
          { credentials: "include" }
        );
        const data = await res.json() as { favorite_court_ids?: string[] };
        if (data?.favorite_court_ids) {
          setFavoriteIds(data.favorite_court_ids);
        }
      } catch {
        // silent fail
      }
    };

    fetchFavorites();
  }, [user]);

  const toggleFavorite = useCallback(
    async (courtId: string) => {
      if (!user) return;

      const isFav = favoriteIds.includes(courtId);
      const newIds = isFav
        ? favoriteIds.filter((id) => id !== courtId)
        : [...favoriteIds, courtId];

      setFavoriteIds(newIds);

      try {
        const res = await fetch("/api/favorites", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, court_id: courtId, action: isFav ? "remove" : "add" }),
          credentials: "include",
        });

        if (!res.ok) {
          setFavoriteIds(favoriteIds);
        }
      } catch {
        setFavoriteIds(favoriteIds);
      }
    },
    [user, favoriteIds]
  );

  const favoriteCourts = favoriteIds
    .map((id) => courts.find((c) => c.id === id))
    .filter((c): c is Court => !!c);

  return {
    favoriteIds,
    favoriteCourts,
    toggleFavorite,
    isFavorite: (id: string) => favoriteIds.includes(id),
  };
}