"use client";

import { useFavorites } from "@/lib/hooks/useFavorites";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteButton({ courtId }: { courtId: string }) {
  const { favoriteIds, toggleFavorite } = useFavorites();
  const isFav = favoriteIds.includes(courtId);

  return (
    <Button
      variant="ghost"
      onClick={() => toggleFavorite(courtId)}
      aria-label={isFav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
    >
      <Heart
        className={cn(
          "w-4 h-4",
          isFav
            ? "fill-[var(--accent)] text-[var(--accent)]"
            : "text-[var(--text-secondary)]"
        )}
      />
      {isFav ? "Preferito" : "Preferisci"}
    </Button>
  );
}