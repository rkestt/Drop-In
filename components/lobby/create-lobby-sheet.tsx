"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";

interface CreateLobbySheetProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
}

export function CreateLobbySheet({
  open,
  onClose,
  courtId,
  courtName,
}: CreateLobbySheetProps) {
  const [startTime, setStartTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Devi effettuare l'accesso per creare una lobby.");
      }

      // Check for ban before attempting insert
      const { data: profile } = await supabase
        .from("profiles")
        .select("banned_until, karma_score")
        .eq("user_id", user.id)
        .single();

      if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
        throw new Error(
          `Sei bannato fino al ${new Date(profile.banned_until).toLocaleString("it-IT")}. Non puoi creare lobby.`
        );
      }

      if ((profile?.karma_score ?? 90) < 50) {
        throw new Error(
          `Karma troppo basso (${profile?.karma_score}). Non puoi creare lobby.`
        );
      }

      const { error } = await supabase.from("lobbies").insert({
        court_id: courtId,
        creator_id: user.id,
        start_time: new Date(startTime).toISOString(),
        max_players: parseInt(maxPlayers, 10),
        status: "open",
      });

      if (error) {
        // Handle PG exception strings from database triggers
        const msg = error.message.toLowerCase();
        if (msg.includes("bannato")) throw error;
        if (msg.includes("karma")) throw error;
        throw error;
      }

      onClose();
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore durante la creazione della lobby.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Crea lobby">
      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
            Campo
          </label>
          <p className="text-[var(--text-primary)] font-medium">{courtName}</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label
              htmlFor="lobby-start-time"
              className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
            >
              Orario inizio
            </label>
            <Input
              id="lobby-start-time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="lobby-max-players"
              className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
            >
              Numero massimo giocatori
            </label>
            <Input
              id="lobby-max-players"
              type="number"
              min={2}
              max={30}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creazione..." : "Crea lobby"}
          </Button>
        </form>
      </div>
    </BottomSheet>
  );
}
