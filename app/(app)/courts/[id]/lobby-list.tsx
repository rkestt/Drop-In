"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, MapPin } from "lucide-react";
import Link from "next/link";

interface Participant {
  user_id: string;
  nickname: string | null;
}

interface Lobby {
  id: string;
  court_id: string;
  creator_id: string;
  start_time: string;
  max_players: number;
  status: string;
  participants_count: number;
  participants: Participant[];
  is_joined: boolean;
}

export function CourtLobbyList({ courtId }: { courtId: string }) {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchLobbies = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData.user?.id || null;

        const now = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: lobbiesData } = await supabase
          .from("lobbies")
          .select("*")
          .eq("court_id", courtId)
          .eq("status", "open")
          .gte("start_time", now)
          .order("start_time", { ascending: true });

        const lobbyIds = (lobbiesData ?? []).map(
          (l: Record<string, unknown>) => l.id as string
        );

        let countsMap: Record<string, number> = {};
        if (lobbyIds.length > 0) {
          const { data: countsData } = await supabase.rpc("get_lobby_counts", {
            p_lobby_ids: lobbyIds,
          });
          (
            countsData as Array<{ lobby_id: string; count: number }> | null
          )?.forEach((c) => {
            countsMap[c.lobby_id] = Number(c.count);
          });
        }

        const participantsByLobby: Record<string, Participant[]> = {};
        if (lobbyIds.length > 0) {
          const results = await Promise.all(
            lobbyIds.map((id) =>
              supabase
                .rpc("get_lobby_participants", { p_lobby_id: id })
                .then(({ data }) => ({
                  id,
                  participants: (data ?? []).map(
                    (p: Record<string, unknown>) => ({
                      user_id: (p.user_id as string) || "",
                      nickname: (p.nickname as string) || null,
                    })
                  ),
                }))
            )
          );
          results.forEach(({ id, participants }) => {
            participantsByLobby[id] = participants;
          });
        }

        let joinedLobbyIds: Set<string> = new Set();
        if (currentUserId) {
          const { data: joinedData } = await supabase
            .from("lobby_participants")
            .select("lobby_id")
            .eq("user_id", currentUserId);
          joinedLobbyIds = new Set((joinedData ?? []).map((j) => j.lobby_id));
        }

        const formattedLobbies =
          (lobbiesData ?? []).map((l: Record<string, unknown>) => ({
            id: l.id as string,
            court_id: l.court_id as string,
            creator_id: l.creator_id as string,
            start_time: l.start_time as string,
            max_players: l.max_players as number,
            status: l.status as string,
            participants_count: countsMap[l.id as string] ?? 0,
            participants: participantsByLobby[l.id as string] ?? [],
            is_joined: joinedLobbyIds.has(l.id as string),
          })) || [];

        setLobbies(formattedLobbies);
      } catch (err) {
        console.error("Error fetching lobbies:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLobbies();

    const channel = supabase
      .channel(`court-lobbies-${courtId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobbies", filter: `court_id=eq.${courtId}` },
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
  }, [courtId, supabase]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-[var(--bg-surface)] rounded-xl" />
        ))}
      </div>
    );
  }

  if (lobbies.length === 0) {
    return (
      <div className="text-center py-8 bg-[var(--bg-surface)] rounded-xl">
        <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-[var(--text-muted)] text-sm">
          Nessuna lobby attiva per questo campo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lobbies.map((lobby) => (
        <div
          key={lobby.id}
          className="block bg-[var(--bg-surface)] rounded-xl p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
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
                  {lobby.participants.slice(0, 5).map((p) => (
                    <Link
                      key={p.user_id}
                      href={`/users/${p.user_id}`}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] hover:underline"
                    >
                      {p.nickname || "Anonimo"}
                    </Link>
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
        </div>
      ))}
    </div>
  );
}
