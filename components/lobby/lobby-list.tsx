"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Participant {
  user_id: string;
  nickname: string | null;
}

interface Lobby {
  id: string;
  court_id: string;
  start_time: string;
  max_players: number;
  status: string;
  participants_count: number;
  participants: Participant[];
  court_name: string;
  is_joined: boolean;
}

export function LobbyList() {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchLobbies = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
const currentUserId = authData.user?.id || null;

        const now = new Date().toISOString();
        const { data: lobbiesData } = await supabase
          .from("lobbies")
          .select(
            `*,
            courts(name),
            lobby_participants(user_id)`
          )
          .eq("status", "open")
          .gte("start_time", now)
          .order("start_time", { ascending: true });

        // Collect all unique user_ids from lobby participants
        const allUserIds = [
          ...new Set(
            (lobbiesData || []).flatMap(
              (l: Record<string, unknown>) => (l.lobby_participants as Array<Record<string, string>> | undefined)?.map((p) => p.user_id) || []
            )
          ),
        ];

        // Fetch profiles (nicknames) for all participant user_ids
        const nicknameMap: Record<string, string | null> = {};
        if (allUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, nickname")
            .in("user_id", allUserIds);
          profiles?.forEach((p) => {
            nicknameMap[p.user_id] = p.nickname;
          });
        }

        const formattedLobbies =
          (lobbiesData ?? []).map((l: Record<string, unknown>) => {
            const participants = ((l.lobby_participants as Array<Record<string, string>> | undefined) || []).map(
              (p) => ({
                user_id: p.user_id,
                nickname: nicknameMap[p.user_id] || null,
              })
            );
            return {
              id: l.id as string,
              court_id: l.court_id as string,
              start_time: l.start_time as string,
              max_players: l.max_players as number,
              status: l.status as string,
              participants_count: participants.length,
              participants,
              court_name: (l.courts as { name?: string } | undefined)?.name || "Campo",
              is_joined: participants.some(
                (p) => p.user_id === currentUserId
              ),
            };
          }) || [];

        setLobbies(formattedLobbies);
      } catch (err) {
        console.error("Error fetching lobbies:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLobbies();

    const channel = supabase
      .channel("lobby-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobbies" },
        () => fetchLobbies()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobby_participants" },
        () => fetchLobbies()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-[var(--bg-surface)] rounded-xl" />
        ))}
      </div>
    );
  }

  if (lobbies.length === 0) {
    return (
      <div className="text-center py-8">
        <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-[var(--text-muted)] text-sm">
          Nessuna lobby attiva nelle vicinanze.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lobbies.map((lobby) => (
        <Link
          key={lobby.id}
          href={`/courts/${lobby.court_id}`}
          className="block bg-[var(--bg-surface)] rounded-xl p-4 hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                {lobby.court_name}
              </p>
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
                  {lobby.participants_count}/{lobby.max_players}
                </span>
              </div>
              {lobby.participants.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {lobby.participants.slice(0, 5).map((p, i) => (
                    <span
                      key={i}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/users/${p.user_id}`);
                      }}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] cursor-pointer hover:underline"
                    >
                      {p.nickname || "Anonimo"}
                    </span>
                  ))}
                  {lobby.participants.length > 5 && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      +{lobby.participants.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="accent">
                {lobby.status === "open" ? "Aperta" : "Chiusa"}
              </Badge>
              {lobby.is_joined && (
                <span className="text-[10px] uppercase tracking-wider text-[var(--accent)] font-medium">
                  Iscritto
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
