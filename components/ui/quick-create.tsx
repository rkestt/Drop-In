"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, Users, Zap } from "lucide-react";

interface QuickCreateProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { sport: string; startTime: string; maxPlayers: number; courtId: string }) => void;
  initialCourtId?: string;
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

export function QuickCreateSheet({ open, onClose, onSubmit, initialCourtId }: QuickCreateProps) {
  const [selectedSport, setSelectedSport] = useState<string>("basketball");
  const [selectedTime, setSelectedTime] = useState<number>(0);
  const [selectedPlayers, setSelectedPlayers] = useState<number>(6);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!initialCourtId) {
      console.warn("No court selected");
      return;
    }

    setSubmitting(true);
    try {
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() + selectedTime);

      await onSubmit({
        sport: selectedSport,
        startTime: startTime.toISOString(),
        maxPlayers: selectedPlayers,
        courtId: initialCourtId,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title="Crea Partita">
      <div className="space-y-6">
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
                  selectedSport === sport.id
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
            disabled={submitting}
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