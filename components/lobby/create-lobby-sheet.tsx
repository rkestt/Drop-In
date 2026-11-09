"use client";

import { useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createLobbySchema,
  type CreateLobbyInput,
  type CreateLobbyValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";

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
  // Orario e posti in react-hook-form (schema zod = unica fonte).
  // Restano useState solo per: loading, errori di rete/DB.
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<CreateLobbyInput, unknown, CreateLobbyValues>({
    resolver: zodResolver(createLobbySchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { startTime: "", maxPlayers: 10 },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guardia anti-doppio-invio (il disabled non copre due submit ravvicinati).
  const submittingRef = useRef(false);

  const supabase = createClient();

  const focusFirstError = (fieldErrors: FieldErrors<CreateLobbyInput>) => {
    const order: (keyof CreateLobbyInput)[] = ["startTime", "maxPlayers"];
    for (const field of order) {
      if (fieldErrors[field]) {
        setFocus(field);
        return;
      }
    }
  };

  const onValidCreate = async (values: CreateLobbyValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
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
        start_time: new Date(values.startTime).toISOString(),
        max_players: values.maxPlayers,
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
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Crea lobby">
      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
            Campo
          </label>
          <p className="text-[var(--text-primary)] font-medium">{courtName}</p>
        </div>

        {error && (
          <div
            className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onValidCreate, focusFirstError)} className="space-y-3" noValidate>
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
              {...register("startTime")}
              aria-invalid={errors.startTime ? "true" : undefined}
              aria-describedby={errors.startTime ? "lobby-start-time-error" : undefined}
            />
            {errors.startTime && (
              <p id="lobby-start-time-error" role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                {errors.startTime.message}
              </p>
            )}
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
              inputMode="numeric"
              {...register("maxPlayers")}
              aria-invalid={errors.maxPlayers ? "true" : undefined}
              aria-describedby={errors.maxPlayers ? "lobby-max-players-error" : undefined}
            />
            {errors.maxPlayers && (
              <p id="lobby-max-players-error" role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                {errors.maxPlayers.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creazione..." : "Crea lobby"}
          </Button>
        </form>
      </div>
    </Drawer>
  );
}
