import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { LobbyTabs } from "@/components/lobby/lobby-tabs";
import { resolveNickname } from "@/lib/profile/utils";
import { listMySeries, listOrphanSeries } from "@/lib/series/client";
import type { SeriesWithNextOccurrence } from "@/lib/series/types";
import type { SeriesListItem } from "@/components/series/types";
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
    // #92: provenienza serie per il chip (un join, nessuna query in più).
    .select(
      "id, court_id, start_time, sport, duration_minutes, ends_at, max_players, status, series_id, courts(name, sport, photo_path), lobby_series(weekday, time_of_day)",
    )
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
    const courts = l.courts as {
      name?: string;
      sport?: string;
      photo_path?: string | null;
    } | null;
    // #92: join illeggibile (vecchio dato) con series_id presente → chip
    // ridotto a "Ricorrente", mai card rotta.
    const seriesEmbed = l.lobby_series as {
      weekday?: number;
      time_of_day?: string;
    } | null;
    return {
      id: l.id as string,
      court_id: l.court_id as string,
      start_time: l.start_time as string,
      sport: (l.sport as string | null) ?? null,
      duration_minutes: l.duration_minutes as number,
      ends_at: l.ends_at as string,
      max_players: l.max_players as number,
      status: l.status as string,
      court_name: courts?.name ?? "Campo",
      court_sport: courts?.sport ?? null,
      court_photo_path: courts?.photo_path ?? null,
      participants_count: ids.length,
      participants: ids.map((uid) => ({
        user_id: uid,
        nickname: resolveNickname(nicknameByUser, uid),
      })),
      is_joined: ids.includes(userId),
      series: (l.series_id as string | null)
        ? {
            weekday:
              typeof seriesEmbed?.weekday === "number"
                ? seriesEmbed.weekday
                : null,
            timeOfDay: seriesEmbed?.time_of_day ?? null,
          }
        : null,
    };
  });

  // #92 superficie 2: "Le mie serie" + orfane, con i nomi dei campi risolti
  // qui (una query, non una per riga). La lista resta del server: il client
  // (SeriesList) fa solo toggle/cancella ottimistici + refresh.
  const [{ items: mySeries, error: mySeriesError }, { items: orphanSeries, error: orphanError }] =
    await Promise.all([listMySeries(supabase), listOrphanSeries(supabase)]);
  const allSeries: SeriesWithNextOccurrence[] = [...mySeries, ...orphanSeries];
  let courtById = new Map<string, { name?: string; status?: string | null }>();
  if (allSeries.length > 0) {
    const { data: courtsData } = await supabase
      .from("courts")
      .select("id, name, status")
      .in(
        "id",
        [...new Set(allSeries.map((s) => s.court_id))],
      );
    courtById = new Map(
      ((courtsData ?? []) as { id: string; name?: string; status?: string | null }[]).map(
        (c) => [c.id, { name: c.name, status: c.status }],
      ),
    );
  }
  const toListItem = (s: SeriesWithNextOccurrence): SeriesListItem => ({
    ...s,
    courtName: courtById.get(s.court_id)?.name ?? "Campo",
    // `coalesce(c.status, 'active')` come il RPC `nearby_courts` (009).
    courtActive: (courtById.get(s.court_id)?.status ?? "active") === "active",
  });

  return (
    <main id="contenuto" tabIndex={-1} className="mx-auto w-full max-w-[720px] flex-1 p-6">
      <LobbyTabs
        mine={mine}
        userId={userId}
        series={mySeries.map(toListItem)}
        orphans={orphanSeries.map(toListItem)}
        seriesError={mySeriesError || orphanError}
      />
    </main>
  );
}
