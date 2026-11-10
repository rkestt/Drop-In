import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { LobbyDetail } from "@/components/lobby/lobby-detail";
import Link from "next/link";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function RetryBox({ id }: { id: string }) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 p-6">
      <div
        className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center"
        role="alert"
      >
        <p className="font-medium text-[var(--text-primary)]">
          Non riusciamo a caricare la lobby. Controlla la connessione.
        </p>
        <Link
          href={`/lobbies/${id}`}
          className="mx-auto mt-3 flex min-h-11 w-full max-w-60 items-center justify-center rounded-control bg-[var(--accent)] px-4 font-semibold text-[var(--accent-foreground)]"
        >
          Riprova
        </Link>
      </div>
    </main>
  );
}

/**
 * Dettaglio lobby a freddo (deep link da `/notifications`): dati reali,
 * `notFound()` se la lobby non esiste. Rete giù ≠ 404: messaggio + riprova.
 *
 * NB: `notFound()` lancia: resta FUORI dai try/catch, altrimenti il catch
 * lo ingoia e mostra il fallback "rete giù" al posto del 404.
 */
export default async function LobbyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) redirect(loginRedirectUrl(`/lobbies/${id}`));

  let lobby: {
    id: string;
    court_id: string;
    start_time: string;
    max_players: number;
    status: string | null;
  } | null = null;
  try {
    const { data, error: lobbyError } = await supabase
      .from("lobbies")
      .select("id, court_id, start_time, max_players, status")
      .eq("id", id)
      .single();
    // PGRST116 = riga assente → 404 vero; altro errore → messaggio + riprova.
    if (lobbyError) {
      if (lobbyError.code !== "PGRST116") return <RetryBox id={id} />;
    } else {
      lobby = data;
    }
  } catch {
    return <RetryBox id={id} />;
  }
  if (!lobby) notFound();

  // Fetch secondari: fallimento = messaggio + riprova (mai 404, mai 500).
  let court = null;
  let parts: Array<{ user_id: string }> | null = null;
  let profile: { karma_score: number | null; banned_until: string | null } | null =
    null;
  try {
    const [courtRes, partsRes, profileRes] = await Promise.all([
      supabase
        .from("courts")
        .select("id, name, address, sport")
        .eq("id", lobby.court_id)
        .single(),
      supabase
        .from("lobby_participants")
        .select("user_id")
        .eq("lobby_id", lobby.id),
      supabase
        .from("profiles")
        .select("karma_score, banned_until")
        .eq("user_id", user.id)
        .single(),
    ]);
    court = courtRes.data;
    parts = partsRes.data;
    profile = profileRes.data;
  } catch {
    return <RetryBox id={id} />;
  }

  const memberIds = (parts ?? []).map((p) => p.user_id);
  let nicknames = new Map<string, string | null>();
  if (memberIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", memberIds);
    nicknames = new Map(
      (profiles ?? []).map((p) => [p.user_id, p.nickname])
    );
  }

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 p-6">
      <LobbyDetail
        lobby={{ ...lobby, status: lobby.status ?? "open" }}
        court={
          court ?? {
            id: lobby.court_id,
            name: "Campo",
            address: null,
            sport: null,
          }
        }
        participants={memberIds.map((uid) => ({
          user_id: uid,
          nickname: nicknames.get(uid) ?? null,
        }))}
        userId={user.id}
        joinedInitial={memberIds.includes(user.id)}
        userKarma={profile?.karma_score ?? null}
        bannedUntil={profile?.banned_until ?? null}
      />
    </main>
  );
}
