import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { LobbyTabs } from "@/components/lobby/lobby-tabs";

export const dynamic = "force-dynamic";

type Lobby = {
  id: string;
  start_time: string;
  status: string;
  courts?: { name: string } | null;
};

export default async function LobbiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const supabase = await createClient();
  // Fail open like the middleware: a network error means "unknown session",
  // so bounce to login (with next) instead of 500ing.
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

  // Le tue lobby: dove l'utente è creatore o partecipante
  const { data: myParticipants } = await supabase
    .from("lobby_participants")
    .select("lobby_id")
    .eq("user_id", user.id);
  const joinedIds = (myParticipants ?? []).map((p) => p.lobby_id);

  let mineQuery = supabase
    .from("lobbies")
    .select("*, courts(name)");
  mineQuery =
    joinedIds.length > 0
      ? mineQuery.or(`creator_id.eq.${user.id},id.in.(${joinedIds.join(",")})`)
      : mineQuery.eq("creator_id", user.id);
  mineQuery = mineQuery.order("start_time", { ascending: true });

  const { data: mine } = await mineQuery;

  // Aperte vicine: posizione utente non disponibile -> ordina per created_at desc
  const { data: nearby } = await supabase
    .from("lobbies")
    .select("*, courts(name)")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1 p-6">
      <LobbyTabs
        mine={(mine as unknown as Lobby[] | null) ?? []}
        nearby={(nearby as unknown as Lobby[] | null) ?? []}
      />
    </main>
  );
}