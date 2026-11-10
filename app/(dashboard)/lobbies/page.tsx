import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { LobbyTabs } from "@/components/lobby/lobby-tabs";
import type { LobbySummary } from "@/components/lobby/types";

export const dynamic = "force-dynamic";

/**
 * Lista lobby: "Le tue" dal server (creatore o partecipante, con conteggi e
 * nickname reali); "Vicine" nel client `NearbyLobbies` con raggio dal RPC
 * `nearby_courts` (bug #48: mai tutta Italia). Niente fetch duplicati.
 */
export default async function LobbiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const supabase = await createClient();
  // Fail open come il middleware: errore di rete = "sessione ignota",
  // quindi login (con next) invece di 500.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    const params = await searchParams;
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    redirect(loginRedirectUrl("/lobbies", tab ? `?tab=${tab}` : ""));
  }

  const userId = user.id;

  const { data: myParticipants } = await supabase
    .from("lobby_participants")
    .select("lobby_id")
    .eq("user_id", userId);
  const joinedIds = (myParticipants ?? []).map((p) => p.lobby_id);

  let mineQuery = supabase
    .from("lobbies")
    .select("id, court_id, start_time, max_players, status, courts(name, sport)")
    .order("start_time", { ascending: true });
  if (joinedIds.length > 0) {
    mineQuery = mineQuery.or(
      `creator_id.eq.${userId},id.in.(${joinedIds.join(",")})`
    );
  } else {
    mineQuery = mineQuery.eq("creator_id", userId);
  }
  const { data: mineRows } = await mineQuery;

  const mineIds = (mineRows ?? []).map((l) => l.id as string);
  let partsByLobby = new Map<string, string[]>();
  let nicknameByUser = new Map<string, string | null>();
  if (mineIds.length > 0) {
    const { data: parts } = await supabase
      .from("lobby_participants")
      .select("lobby_id, user_id")
      .in("lobby_id", mineIds);
    partsByLobby = new Map<string, string[]>();
    for (const p of parts ?? []) {
      const list = partsByLobby.get(p.lobby_id) ?? [];
      list.push(p.user_id);
      partsByLobby.set(p.lobby_id, list);
    }
    const allUserIds = [...new Set((parts ?? []).map((p) => p.user_id))];
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname")
        .in("user_id", allUserIds);
      nicknameByUser = new Map(
        (profiles ?? []).map((p) => [p.user_id, p.nickname])
      );
    }
  }

  const mine: LobbySummary[] = (mineRows ?? []).map((l) => {
    const ids = partsByLobby.get(l.id as string) ?? [];
    const courts = l.courts as { name?: string; sport?: string } | null;
    return {
      id: l.id as string,
      court_id: l.court_id as string,
      start_time: l.start_time as string,
      max_players: l.max_players as number,
      status: l.status as string,
      court_name: courts?.name ?? "Campo",
      court_sport: courts?.sport ?? null,
      participants_count: ids.length,
      participants: ids.map((uid) => ({
        user_id: uid,
        nickname: nicknameByUser.get(uid) ?? null,
      })),
      is_joined: ids.includes(userId),
    };
  });

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 p-6">
      <LobbyTabs mine={mine} userId={userId} />
    </main>
  );
}
