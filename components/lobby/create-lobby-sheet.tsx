"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { StepTransition } from "@/components/motion/step-transition";
import { SuccessPop } from "@/components/motion/success-pop";

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
  const [created, setCreated] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setError(null);
        setCreated(false);
      });
    }
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open]);

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

      // Successo: si mostra l'esito dentro lo sheet (l'uscita vera —
      // chiusura del drawer — resta quella di Base UI), poi si torna al
      // contesto con la lobby visibile in "Lobby attive".
      setCreated(true);
      closeTimer.current = window.setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore durante la creazione della lobby.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Crea lobby">
      {/* Entrata/uscita del drawer restano quelle di Base UI: qui dentro si
          scambia solo il contenuto (form -> esito), senza animazioni custom
          sul contenitore e senza salti di layout. */}
      <StepTransition stepKey={created ? "done" : "form"}>
        {created ? (
          <SuccessPop
            title="Lobby creata"
            description={`${courtName} · fino a ${maxPlayers} giocatori. La trovi in "Lobby attive" con lo stato "Sei dentro".`}
          />
        ) : (
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
        )}
      </StepTransition>
    </Drawer>
  );
}
