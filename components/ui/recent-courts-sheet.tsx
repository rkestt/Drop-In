"use client";

import { useMemo } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { Heart, Clock, ChevronRight, MapPin } from "lucide-react";
import type { Court } from "@/lib/cache/types";

interface RecentCourtsSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectCourt: (courtId: string) => void;
  recentCourts: Court[];
  favoriteIds: string[];
  onToggleFavorite: (courtId: string) => void;
}

function getSportEmoji(sport: string | null | undefined): string {
  if (!sport) return "🏟️";
  const s = sport.toLowerCase();
  if (s.includes("basket")) return "🏀";
  if (s.includes("volley")) return "🏐";
  if (s.includes("soccer") || s.includes("calcetto") || s.includes("futsal")) return "⚽";
  if (s.includes("tennis") || s.includes("padel")) return "🎾";
  if (s.includes(";")) return "🏟️";
  return "🏟️";
}

function CourtItem({
  court,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: {
  court: Court;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="flex items-center gap-3 min-h-[52px]">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="flex-shrink-0 p-2 -ml-1 rounded-full hover:bg-[var(--bg-surface)] transition-colors"
        aria-label={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
      >
        <Heart
          className={cn("w-4 h-4 transition-colors", isFavorite ? "fill-[var(--accent)] text-[var(--accent)]" : "text-[var(--text-muted)]")}
        />
      </button>
      <button
        onClick={onSelect}
        className="flex items-center gap-3 flex-1 text-left min-w-0 py-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors -mx-2 px-2"
      >
        <span className="text-lg flex-shrink-0">{getSportEmoji(court.sport)}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{court.name}</div>
          {court.address && (
            <div className="text-xs text-[var(--text-muted)] truncate">
              {court.address}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
      </button>
    </div>
  );
}

export function RecentCourtsSheet({
  open,
  onClose,
  onSelectCourt,
  recentCourts,
  favoriteIds,
  onToggleFavorite,
}: RecentCourtsSheetProps) {
  const favoritedCourts = useMemo(
    () => recentCourts.filter((c) => favoriteIds.includes(c.id)),
    [recentCourts, favoriteIds]
  );

  const notFavoritedRecent = useMemo(
    () => recentCourts.filter((c) => !favoriteIds.includes(c.id)),
    [recentCourts, favoriteIds]
  );

  const hasContent = favoritedCourts.length > 0 || notFavoritedRecent.length > 0;

  return (
    <BottomSheet open={open} onClose={onClose} title="Seleziona campo">
      <div className="space-y-4">
        {favoritedCourts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <Heart className="w-3 h-3" />
              Preferiti
            </div>
            {favoritedCourts.map((court) => (
              <CourtItem
                key={court.id}
                court={court}
                isFavorite={true}
                onToggleFavorite={() => onToggleFavorite(court.id)}
                onSelect={() => {
                  onSelectCourt(court.id);
                  onClose();
                }}
              />
            ))}
          </div>
        )}

        {notFavoritedRecent.length > 0 && (
          <div className="space-y-2">
            {favoritedCourts.length > 0 && (
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <Clock className="w-3 h-3" />
                Recenti
              </div>
            )}
            {notFavoritedRecent.map((court) => (
              <CourtItem
                key={court.id}
                court={court}
                isFavorite={false}
                onToggleFavorite={() => onToggleFavorite(court.id)}
                onSelect={() => {
                  onSelectCourt(court.id);
                  onClose();
                }}
              />
            ))}
          </div>
        )}

        {!hasContent && (
          <div className="text-center py-8">
            <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
            <p className="text-sm text-[var(--text-muted)]">
              Clicca su un campo nella mappa per iniziare
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}