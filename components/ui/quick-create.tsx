"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, Users, Zap, MapPin, ChevronRight } from "lucide-react";
import type { Court } from "@/lib/cache/types";

interface QuickCreateProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { sport: string; startTime: string; maxPlayers: number; courtId: string }) => void;
  initialCourtId?: string;
  allCourts?: Court[];
}

const SPORTS = [
  { id: "basketball", label: "Basket", emoji: "🏀" },
  { id: "volleyball", label: "Pallavolo", emoji: "🏐" },
  { id: "soccer", label: "Calcetto", emoji: "⚽" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "padel", label: "Padel", emoji: "🎾" },
];

const TIME_PRESETS = [
  { label: "Adesso", value: 0 },
  { label: "30 min", value: 30 },
  { label: "1 ora", value: 60 },
  { label: "2 ore", value: 120 },
];

const PLAYER_COUNTS = [2, 4, 6, 8, 10, 12];

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

function getSportForCourt(sport: string | null | undefined): string {
  if (!sport) return "basketball";
  const s = sport.toLowerCase();
  if (s.includes("basket")) return "basketball";
  if (s.includes("volley")) return "volleyball";
  if (s.includes("soccer") || s.includes("calcetto") || s.includes("futsal")) return "soccer";
  if (s.includes("tennis")) return "tennis";
  if (s.includes("padel")) return "padel";
  if (s.includes(";")) return "basketball";
  return "basketball";
}

export function QuickCreateSheet({ open, onClose, onSubmit, initialCourtId, allCourts = [] }: QuickCreateProps) {
  const [selectedSport, setSelectedSport] = useState<string>("basketball");
  const [selectedTime, setSelectedTime] = useState<number>(0);
  const [selectedPlayers, setSelectedPlayers] = useState<number>(6);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [showCourtSelector, setShowCourtSelector] = useState(!initialCourtId && allCourts.length > 0);

  const effectiveCourtId = selectedCourt?.id ?? initialCourtId;
  const effectiveSport = selectedCourt ? getSportForCourt(selectedCourt.sport) : selectedSport;

  const handleCourtSelect = (court: Court) => {
    setSelectedCourt(court);
    setSelectedSport(getSportForCourt(court.sport));
    setShowCourtSelector(false);
  };

  const handleSubmit = async () => {
    if (!effectiveCourtId) {
      setShowCourtSelector(true);
      return;
    }

    setSubmitting(true);
    try {
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() + selectedTime);

      await onSubmit({
        sport: effectiveSport,
        startTime: startTime.toISOString(),
        maxPlayers: selectedPlayers,
        courtId: effectiveCourtId,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSelectedCourt(null);
      setShowCourtSelector(!initialCourtId && allCourts.length > 0);
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title="Crea Partita">
      <div className="space-y-6">
        {/* Court Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">
            Campo
          </label>
          <button
            onClick={() => setShowCourtSelector(!showCourtSelector)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl",
              "border min-h-[48px] transition-all",
              "bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]",
              selectedCourt || initialCourtId
                ? "border-[var(--accent)]/40"
                : "border-[var(--cool-muted)]/30"
            )}
          >
            {selectedCourt ? (
              <div className="flex items-center gap-2 text-left">
                <span>{getSportEmoji(selectedCourt.sport)}</span>
                <div>
                  <div className="text-sm font-medium">{selectedCourt.name}</div>
                  {selectedCourt.address && (
                    <div className="text-xs text-[var(--text-muted)] truncate max-w-[240px]">
                      {selectedCourt.address}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Seleziona un campo</span>
              </div>
            )}
            <ChevronRight className={cn("w-4 h-4 text-[var(--text-muted)] transition-transform", showCourtSelector && "rotate-90")} />
          </button>

          {showCourtSelector && (
            <div className="max-h-[280px] overflow-y-auto rounded-xl border border-[var(--cool-muted)]/20 bg-[var(--bg-elevated)]">
              {allCourts.length === 0 ? (
                <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                  Nessun campo disponibile
                </div>
              ) : (
                allCourts.map((court) => (
                  <button
                    key={court.id}
                    onClick={() => handleCourtSelect(court)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left",
                      "border-b border-[var(--cool-muted)]/10 last:border-b-0",
                      "hover:bg-[var(--bg-surface)] transition-colors",
                      "min-h-[52px]"
                    )}
                  >
                    <span className="text-lg">{getSportEmoji(court.sport)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{court.name}</div>
                      {court.address && (
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          {court.address}
                        </div>
                      )}
                    </div>
                    {(selectedCourt?.id === court.id || (!selectedCourt && initialCourtId === court.id)) && (
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sport Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">
            Sport
          </label>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setSelectedSport(sport.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full",
                  "text-sm font-medium transition-all duration-150",
                  "border min-h-[44px]",
                  effectiveSport === sport.id
                    ? "bg-[var(--accent)] text-white border-transparent"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--cool-muted)]/30 hover:border-[var(--cool-muted)]"
                )}
              >
                <span>{sport.emoji}</span>
                <span>{sport.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Selection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
            <Clock className="w-4 h-4" />
            Quando
          </label>
          <div className="flex gap-2">
            {TIME_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setSelectedTime(preset.value)}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-lg text-sm font-medium",
                  "border min-h-[44px] transition-all duration-150",
                  selectedTime === preset.value
                    ? "bg-[var(--accent)] text-white border-transparent"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--cool-muted)]/30 hover:border-[var(--cool-muted)]"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Player Count */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
            <Users className="w-4 h-4" />
            Numero giocatori
          </label>
          <div className="flex gap-2">
            {PLAYER_COUNTS.map((count) => (
              <button
                key={count}
                onClick={() => setSelectedPlayers(count)}
                className={cn(
                  "flex-1 px-2 py-2.5 rounded-lg text-sm font-medium",
                  "border min-h-[44px] transition-all duration-150",
                  selectedPlayers === count
                    ? "bg-[var(--accent)] text-white border-transparent"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--cool-muted)]/30 hover:border-[var(--cool-muted)]"
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !effectiveCourtId}
            className="w-full"
            size="default"
          >
            <Zap className="w-5 h-5" />
            {submitting ? "Creando..." : "Crea Partita"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}