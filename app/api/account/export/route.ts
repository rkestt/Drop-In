import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/account/export (#94, Lane A): scarica tutti i dati personali in
// un unico JSON. L'utente e' identificato dai cookie via
// `supabase.auth.getUser()` e ogni lettura passa dal suo client: solo le
// righe gia' leggibili via RLS finiscono nell'export, nessun privilegio
// extra. Niente righe altrui (solo conteggi), niente `push_subscriptions`
// (l'endpoint e' un segreto), niente `rate_limit_events`, niente metadati
// auth oltre l'email. Le FK sono risolte in nomi leggibili, non UUID.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const uid = user.id;

  const [
    profileRes,
    ageRes,
    createdRes,
    participationsRes,
    checkInsRes,
    reviewsRes,
    reportsRes,
    submissionsRes,
    notificationsRes,
    favoritesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, avatar_url, karma_score, created_at")
      .eq("user_id", uid)
      .maybeSingle(),
    // Data di nascita (#97): riga assente = non verificato, l'export non
    // deve rompersi (maybeSingle da' data null senza errore).
    supabase
      .from("profile_age")
      .select("birth_date")
      .eq("user_id", uid)
      .maybeSingle(),
    supabase
      .from("lobbies")
      .select("id, start_time, status, sport, max_players, court_id")
      .eq("creator_id", uid),
    supabase
      .from("lobby_participants")
      .select("lobby_id, joined_at, reconfirmed_at")
      .eq("user_id", uid),
    supabase
      .from("check_ins")
      .select("checked_in_at, checked_out_at, status, court_id")
      .eq("user_id", uid),
    supabase
      .from("court_reviews")
      .select("rating, body, created_at, court_id")
      .eq("user_id", uid),
    supabase
      .from("court_reports")
      .select("category, description, created_at, expires_at, court_id")
      .eq("user_id", uid),
    supabase
      .from("court_submissions")
      .select("raw_name, status, moderation_note, created_at, court_id")
      .eq("submitter_id", uid),
    supabase
      .from("push_notifications")
      .select("title, body, data, sent_at, read_at")
      .eq("user_id", uid),
    supabase.from("user_favorites").select("court_id").eq("user_id", uid),
  ]);

  const firstError = [
    profileRes,
    ageRes,
    createdRes,
    participationsRes,
    checkInsRes,
    reviewsRes,
    reportsRes,
    submissionsRes,
    notificationsRes,
    favoritesRes,
  ].find((r) => r.error);

  if (firstError?.error) {
    return NextResponse.json(
      { error: "Lettura dei dati non riuscita" },
      { status: 500 }
    );
  }

  const createdLobbies = createdRes.data ?? [];
  const participations = participationsRes.data ?? [];

  // Nomi leggibili per le FK (corti e lobby coinvolte) + conteggi degli
  // altri iscritti: mai user_id altrui nell'export.
  const courtIds = new Set<string>();
  for (const l of createdLobbies) courtIds.add(l.court_id);
  for (const c of [
    ...(checkInsRes.data ?? []),
    ...(reviewsRes.data ?? []),
    ...(reportsRes.data ?? []),
    ...(favoritesRes.data ?? []),
  ])
    courtIds.add(c.court_id);
  for (const s of submissionsRes.data ?? []) {
    if (s.court_id) courtIds.add(s.court_id);
  }

  const lobbyIds = new Set<string>();
  for (const l of createdLobbies) lobbyIds.add(l.id);
  for (const p of participations) lobbyIds.add(p.lobby_id);

  const [lobbiesRes, countsRes] = await Promise.all([
    lobbyIds.size > 0
      ? supabase
          .from("lobbies")
          .select("id, start_time, status, sport, court_id")
          .in("id", [...lobbyIds])
      : Promise.resolve({ data: [], error: null }),
    lobbyIds.size > 0
      ? supabase
          .from("lobby_participants")
          .select("lobby_id")
          .in("lobby_id", [...lobbyIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (lobbiesRes.error || countsRes.error) {
    return NextResponse.json(
      { error: "Lettura dei dati non riuscita" },
      { status: 500 }
    );
  }

  // Anche i campi delle lobby (create o unite) vanno risolti in nomi.
  for (const l of lobbiesRes.data ?? []) courtIds.add(l.court_id);

  const courtsRes =
    courtIds.size > 0
      ? await supabase.from("courts").select("id, name").in("id", [...courtIds])
      : { data: [], error: null };

  if (courtsRes.error) {
    return NextResponse.json(
      { error: "Lettura dei dati non riuscita" },
      { status: 500 }
    );
  }

  const courtNames = new Map(
    (courtsRes.data ?? []).map((c) => [c.id, c.name] as const)
  );
  const lobbyById = new Map((lobbiesRes.data ?? []).map((l) => [l.id, l]));
  const participantCounts = new Map<string, number>();
  for (const row of countsRes.data ?? []) {
    participantCounts.set(
      row.lobby_id,
      (participantCounts.get(row.lobby_id) ?? 0) + 1
    );
  }

  const exportData = {
    exported_at: new Date().toISOString(),
    profilo: {
      email: user.email,
      ...(profileRes.data ?? {}),
      data_nascita: ageRes.data?.birth_date ?? null,
    },
    lobby_create: createdLobbies.map((l) => ({
      campo: courtNames.get(l.court_id) ?? null,
      inizio: l.start_time,
      stato: l.status,
      sport: l.sport,
      posti_totali: l.max_players,
      altri_iscritti: Math.max(
        0,
        (participantCounts.get(l.id) ?? 0) -
          (participations.some((p) => p.lobby_id === l.id) ? 1 : 0)
      ),
    })),
    partecipazioni: participations.map((p) => {
      const lobby = lobbyById.get(p.lobby_id);
      return {
        campo: lobby ? (courtNames.get(lobby.court_id) ?? null) : null,
        inizio_partita: lobby?.start_time ?? null,
        stato_partita: lobby?.status ?? null,
        iscritto_il: p.joined_at,
        riconfermato_il: p.reconfirmed_at,
      };
    }),
    check_in: (checkInsRes.data ?? []).map((c) => ({
      campo: courtNames.get(c.court_id) ?? null,
      entrato_il: c.checked_in_at,
      uscito_il: c.checked_out_at,
      stato: c.status,
    })),
    valutazioni: (reviewsRes.data ?? []).map((r) => ({
      campo: courtNames.get(r.court_id) ?? null,
      voto: r.rating,
      testo: r.body,
      creato_il: r.created_at,
    })),
    segnalazioni: (reportsRes.data ?? []).map((r) => ({
      campo: courtNames.get(r.court_id) ?? null,
      categoria: r.category,
      descrizione: r.description,
      creato_il: r.created_at,
      scade_il: r.expires_at,
    })),
    proposte_campo: (submissionsRes.data ?? []).map((s) => ({
      nome_proposto: s.raw_name,
      stato: s.status,
      nota_moderazione: s.moderation_note,
      creato_il: s.created_at,
      campo: s.court_id ? (courtNames.get(s.court_id) ?? null) : null,
    })),
    notifiche: (notificationsRes.data ?? []).map((n) => {
      // `data` puo' contenere UUID altrui (`participant_joined.user_id` e'
      // l'iscritto, non il destinatario) e FK grezze: si tengono solo le
      // chiavi non-identificative e si risolvono lobby/campo in nomi.
      const raw =
        n.data !== null && typeof n.data === "object" && !Array.isArray(n.data)
          ? (n.data as Record<string, unknown>)
          : {};
      const { user_id, lobby_id, court_id, ...rest } = raw;
      void user_id;
      const lobby =
        typeof lobby_id === "string" ? lobbyById.get(lobby_id) : undefined;
      const courtId =
        typeof court_id === "string" ? court_id : lobby?.court_id;
      return {
        titolo: n.title,
        testo: n.body,
        inviata_il: n.sent_at,
        letta_il: n.read_at,
        dettagli: {
          ...rest,
          campo:
            courtId !== undefined
              ? (courtNames.get(courtId) ?? null)
              : undefined,
          inizio_partita: lobby?.start_time,
        },
      };
    }),
    preferiti: (favoritesRes.data ?? []).map((f) => ({
      campo: courtNames.get(f.court_id) ?? null,
    })),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="drop-in-export-${stamp}.json"`,
    },
  });
}
