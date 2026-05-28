"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface LobbyJoinCardProps {
  lobby: {
    id: string;
    court_id: string;
    creator_id: string;
    start_time: string;
    max_players: number;
    status: string;
    sport?: string;
    participant_count?: number;
  };
  userId?: string;
}

export function LobbyJoinCard({ lobby, userId }: LobbyJoinCardProps) {
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [loadingJoined, setLoadingJoined] = useState(!userId);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const count = lobby.participant_count ?? 0;
  const isFull = count >= lobby.max_players;

  useEffect(() => {
    if (!userId) return;

    supabase
      .from("lobby_participants")
      .select("id")
      .eq("lobby_id", lobby.id)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setAlreadyJoined(!!data);
        setLoadingJoined(false);
      });
  }, [lobby.id, userId, supabase]);

  const handleJoin = async () => {
    if (!userId) {
      setError("Devi effettuare l'accesso per unirti.");
      return;
    }
    if (isFull || alreadyJoined) return;

    setJoining(true);
    setError(null);

    try {
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

      const { error: insertError } = await supabase.from("lobby_participants").insert({
        lobby_id: lobby.id,
        user_id: userId,
      });
      if (insertError) throw insertError;

      setAlreadyJoined(true);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore durante l'unione.";
      setError(msg);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!userId) return;
    setLeaving(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("lobby_participants")
        .delete()
        .eq("lobby_id", lobby.id)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      setAlreadyJoined(false);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore durante l'abbandono.";
      setError(msg);
    } finally {
      setLeaving(false);
    }
  };

  const startDate = new Date(lobby.start_time);
  const isToday = startDate.toDateString() === new Date().toDateString();
  // eslint-disable-next-line react-hooks/purity
  const isTomorrow = startDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

  let timeLabel = startDate.toLocaleDateString("it-IT", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) timeLabel = "Oggi " + startDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  if (isTomorrow) timeLabel = "Domani " + startDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const sportEmoji: Record<string, string> = {
    volleyball: "🏐",
    basketball: "🏀",
    tennis: "🎾",
    football: "⚽",
    general: "🏟️",
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3">
      {/* Top row: time + sport + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {timeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lobby.sport && (
            <span className="text-sm">
              {sportEmoji[lobby.sport] ?? "🏐"}
            </span>
          )}
          {alreadyJoined ? (
            <Badge variant="success">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Dentro
            </Badge>
          ) : (
            <Badge variant={isFull ? "danger" : "accent"}>
              {isFull ? "Completa" : "Aperta"}
            </Badge>
          )}
        </div>
      </div>

      {/* Player count bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1.5">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{count} / {lobby.max_players} giocatori</span>
          </div>
          <span>{Math.round((count / lobby.max_players) * 100)}%</span>
        </div>
        <div className="w-full h-2 bg-[var(--cool-muted)]/20 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              alreadyJoined
                ? "bg-[var(--success)]"
                : isFull
                ? "bg-[var(--danger)]"
                : count / lobby.max_players > 0.7
                ? "bg-[var(--warm)]"
                : "bg-[var(--accent)]"
            }`}
            style={{ width: `${Math.round((count / lobby.max_players) * 100)}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      )}

      {alreadyJoined && !loadingJoined && (
        <p className="text-xs text-[var(--success)] flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sei iscritto a questa partita
        </p>
      )}

      {/* Join button */}
      {lobby.status === "open" && (
        loadingJoined ? (
          <Button variant="primary" size="sm" className="w-full" disabled>
            ...
          </Button>
        ) : alreadyJoined ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled
            >
              <CheckCircle2 className="w-4 h-4" />
              Sei dentro
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeave}
              disabled={leaving}
              className="flex-shrink-0 text-[var(--danger)]"
            >
              {leaving ? "..." : "Abbandona"}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={handleJoin}
            disabled={joining || isFull || loadingJoined}
          >
            {joining ? "Unione..." : isFull ? "Al completo" : "Entra nella partita"}
          </Button>
        )
      )}
    </div>
  );
}
