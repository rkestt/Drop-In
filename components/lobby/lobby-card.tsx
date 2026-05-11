"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock } from "lucide-react";

interface Participant {
  user_id: string;
  nickname: string | null;
}

interface LobbyCardProps {
  lobby: {
    id: string;
    court_id: string;
    creator_id: string;
    start_time: string;
    max_players: number;
    status: string;
    courts?: { name: string } | null;
    participants_count?: number;
    participants?: Participant[];
  };
  userId?: string;
}

export function LobbyCard({ lobby, userId }: LobbyCardProps) {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const isFull = (lobby.participants_count ?? 0) >= lobby.max_players;
  const statusVariant =
    lobby.status === "open"
      ? "accent"
      : lobby.status === "in_progress"
      ? "warning"
      : "default";

  const handleJoin = async () => {
    if (!userId) {
      setError("Devi effettuare l'accesso per unirti.");
      return;
    }
    if (isFull) {
      setError("La lobby è al completo.");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      // Check for ban before attempting insert
      const { data: profile } = await supabase
        .from("profiles")
        .select("banned_until, karma_score")
        .eq("user_id", userId)
        .single();

      if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
        throw new Error(
          `Sei bannato fino al ${new Date(profile.banned_until).toLocaleString("it-IT")}. Non puoi partecipare a lobby.`
        );
      }

      if ((profile?.karma_score ?? 90) < 50) {
        throw new Error(
          `Karma troppo basso (${profile?.karma_score}). Non puoi partecipare a lobby.`
        );
      }

      const { error } = await supabase.from("lobby_participants").insert({
        lobby_id: lobby.id,
        user_id: userId,
      });
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore durante l'unione.";
      setError(msg);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] truncate">
            {lobby.courts?.name || "Campo sconosciuto"}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(lobby.start_time).toLocaleString("it-IT", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {lobby.participants_count ?? 0}/{lobby.max_players}
            </span>
          </div>
        </div>
        <Badge variant={statusVariant as any}>
          {lobby.status === "open" ? "Aperta" : lobby.status === "in_progress" ? "In corso" : "Chiusa"}
        </Badge>
      </div>

      {lobby.participants && lobby.participants.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lobby.participants.slice(0, 4).map((p) => (
            <span
              key={p.user_id}
              className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]"
            >
              {p.nickname || "Anonimo"}
            </span>
          ))}
          {lobby.participants.length > 4 && (
            <span className="text-[11px] text-[var(--text-muted)]">
              +{lobby.participants.length - 4}
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      )}

      {lobby.status === "open" && (
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={handleJoin}
          disabled={joining || isFull}
        >
          {joining ? "Unione..." : isFull ? "Al completo" : "Unisciti"}
        </Button>
      )}
    </div>
  );
}
