import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CheckInButton } from "@/components/check-in/check-in-button";
import { CreateLobbyButton } from "@/components/lobby/create-lobby-button";
import { ReportButton } from "@/components/report/report-button";
import { LoginPrompt } from "@/components/auth/login-prompt";
import { BanBannerWrapper } from "@/components/karma/ban-banner-wrapper";
import { MapPin, AlertTriangle, Clock, Users, Navigation, Layers, Zap } from "lucide-react";
import { CourtMiniMap } from "@/components/map/court-mini-map";
import Link from "next/link";

export default async function CourtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: court } = await supabase
    .from("courts")
    .select("*")
    .eq("id", id)
    .single();

  if (!court) {
    notFound();
  }

  const { data: lobbies } = await supabase
    .from("lobbies")
    .select("*, lobby_participants(count)")
    .eq("court_id", id)
    .eq("status", "open")
    .order("start_time", { ascending: true });

  const { data: reports } = await supabase
    .from("court_reports")
    .select("*")
    .eq("court_id", id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const reportCategories: Record<string, string> = {
    broken_hoop: "Canestro rotto",
    wet_court: "Campo bagnato",
    lighting: "Illuminazione",
    occupied: "Occupato",
    other: "Altro",
  };

  const surfaceLabels: Record<string, string> = {
    asphalt: "Asfalto",
    concrete: "Cemento",
    tartan: "Tartan",
    artificial_turf: "Erba sintetica",
    ground: "Terra",
    grass: "Erba",
    paved: "Pavimentato",
    paving_stones: "Pavé",
    wood: "Legno",
    rubber: "Gomma",
    clay: "Terra battuta",
    sand: "Sabbia",
  };

  const surfaceColor: Record<string, string> = {
    asphalt: "bg-[var(--cool-muted)]/20 text-[var(--cool-muted)]",
    concrete: "bg-[var(--cool-muted)]/20 text-[var(--cool-muted)]",
    tartan: "bg-[var(--accent)]/15 text-[var(--accent)]",
    artificial_turf: "bg-[success)]/15 text-[var(--success)]",
    ground: "bg-[var(--warm)]/15 text-[var(--warm)]",
    grass: "bg-[success)]/15 text-[var(--success)]",
  };

  const surfaceIcon: Record<string, string> = {
    asphalt: "🏟️",
    concrete: "🧱",
    tartan: "🏃",
    artificial_turf: "🌿",
    ground: "⛰️",
    grass: "🌱",
    paved: "🪨",
    paving_stones: "🧱",
    wood: "🪵",
    rubber: "⚫",
    clay: "🏜️",
    sand: "🏖️",
  };

  const surfaceStyle = court.surface_type
    ? (surfaceColor[court.surface_type] || "bg-[var(--cool-muted)]/20 text-[var(--cool-muted)]")
    : null;
  const surfaceEmoji = court.surface_type
    ? (surfaceIcon[court.surface_type] || "")
    : null;

  // Count total open slots across all lobbies
  const totalSlots = lobbies?.reduce((sum, l) => sum + ((l as unknown as { max_players: number; lobby_participants?: { count: number }[] }).max_players - ((l as unknown as { lobby_participants?: { count: number }[] }).lobby_participants?.[0]?.count ?? 0)), 0) ?? 0;
  const totalPlayers = lobbies?.reduce((sum, l) => sum + (((l as unknown as { lobby_participants?: { count: number }[] }).lobby_participants?.[0]?.count ?? 0)), 0) ?? 0;

  return (
    <main className="flex-1 space-y-4">
      {/* Header Card */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 space-y-4">
        {/* Court name + address */}
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)] leading-tight">
            {court.name}
          </h1>
          <div className="flex items-start gap-1.5 mt-2 text-[var(--text-secondary)] text-sm">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{court.address || "Indirizzo non disponibile"}</span>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="flex gap-3">
          {court.surface_type && surfaceStyle && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${surfaceStyle}`}>
              <span>{surfaceEmoji}</span>
              <span>{surfaceLabels[court.surface_type] || court.surface_type}</span>
            </div>
          )}
          {court.hoop_count && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)]">
              <Layers className="w-3.5 h-3.5" />
              <span>{court.hoop_count} {court.hoop_count === 1 ? "canestro" : "canestri"}</span>
            </div>
          )}
          {(court as { zone?: string }).zone && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--cool-muted)]/15 text-[var(--text-secondary)]">
              <Navigation className="w-3.5 h-3.5" />
              <span>{(court as { zone?: string }).zone}</span>
            </div>
          )}
        </div>

        {/* Open slots highlight */}
        {lobbies && lobbies.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
            <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {totalPlayers} giocatori in {lobbies.length} {lobbies.length === 1 ? "partita" : "partite"}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {totalSlots} posti ancora disponibili
              </p>
            </div>
          </div>
        )}

        {/* Active reports */}
        {reports && reports.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-[var(--danger)] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--danger)]">
                {reports.length} {reports.length === 1 ? "segnalazione" : "segnalazioni"} attive
              </p>
              <ul className="mt-1 space-y-1">
                {reports.slice(0, 3).map((r) => (
                  <li key={r.id} className="text-xs text-[var(--text-secondary)]">
                    • {reportCategories[r.category] || r.category}
                  </li>
                ))}
                {reports.length > 3 && (
                  <li className="text-xs text-[var(--text-muted)]">
                    + altre {reports.length - 3}
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Mini map */}
        <CourtMiniMap
          lat={court.lat}
          lng={court.lng}
          courtName={court.name}
          zone={(court as { zone?: string }).zone}
        />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {user ? (
            <>
              <CheckInButton
                courtId={court.id}
                courtName={court.name}
                courtLat={court.lat}
                courtLng={court.lng}
              />
              <CreateLobbyButton
                courtId={court.id}
                courtName={court.name}
              />
              <ReportButton
                courtId={court.id}
                courtName={court.name}
              />
            </>
          ) : (
            <LoginPrompt />
          )}
        </div>
      </div>

      {/* Ban/Karma Warning */}
      <BanBannerWrapper userId={user?.id ?? null} />

      {/* Lobbies */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-lg font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
            Partite su questo campo
          </h2>
          {lobbies && lobbies.length > 0 && (
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-1 rounded-full">
              {lobbies.length} {lobbies.length === 1 ? "attiva" : "attive"}
            </span>
          )}
        </div>

        {lobbies && lobbies.length > 0 ? (
          <div className="space-y-3">
            {lobbies.map((lobby: {
              id: string;
              start_time: string;
              max_players: number;
              status: string;
              lobby_participants?: { count: number }[];
            }) => {
              const count = lobby.lobby_participants?.[0]?.count ?? 0;
              const fill = count / lobby.max_players;
              const isFull = count >= lobby.max_players;
              const startDate = new Date(lobby.start_time);
              const isToday = startDate.toDateString() === new Date().toDateString();
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

              return (
                <div
                  key={lobby.id}
                  className="bg-[var(--bg-surface)] rounded-2xl p-4 space-y-3"
                >
                  {/* Top row: time + status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[var(--accent)]" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {timeLabel}
                      </span>
                    </div>
                    <Badge variant={isFull ? "danger" : "accent"}>
                      {isFull ? "Completa" : "Aperta"}
                    </Badge>
                  </div>

                  {/* Player count bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1.5">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{count} / {lobby.max_players} giocatori</span>
                      </div>
                      <span>{Math.round(fill * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--cool-muted)]/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isFull ? "bg-[var(--danger)]" : fill > 0.7 ? "bg-[var(--warm)]" : "bg-[var(--accent)]"}`}
                        style={{ width: `${Math.round(fill * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Join button */}
                  <Link
                    href={`/courts/${court.id}`}
                    className="block w-full text-center text-sm font-medium py-2 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--cool-muted)]/20 transition-colors"
                  >
                    {isFull ? "Vedi dettagli" : "Entra nella partita"}
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[var(--cool-muted)]/10 flex items-center justify-center mx-auto">
              <Zap className="w-7 h-7 text-[var(--text-muted)]" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Nessuna partita attiva
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Sii il primo a organizzare una partita su questo campo!
              </p>
            </div>
            {user && (
              <CreateLobbyButton
                courtId={court.id}
                courtName={court.name}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
