import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { CheckInButton } from "@/components/check-in/check-in-button";
import { CheckoutButton } from "@/components/check-in/checkout-button";
import { CreateLobbyButton } from "@/components/lobby/create-lobby-button";
import { ReportButton } from "@/components/report/report-button";
import { LoginPrompt } from "@/components/auth/login-prompt";
import { BanBannerWrapper } from "@/components/karma/ban-banner-wrapper";
import { FavoriteButtonWrapper } from "@/components/favorites/favorite-button-wrapper";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, AlertTriangle, Users, Navigation, Layers, Zap,
  ExternalLink, ArrowLeft, SunDim, Lock, Unlock, HelpCircle
} from "lucide-react";
import { CourtMiniMap } from "@/components/map/court-mini-map";
import { LobbyJoinCard } from "@/components/lobby/lobby-join-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

  // Active check-ins for this court (last 2 hours)
  // eslint-disable-next-line react-hooks/purity
  const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
  const { data: activeCheckIns } = await supabase
    .from("check_ins")
    .select("id")
    .eq("court_id", id)
    .gte("checked_in_at", twoHoursAgo);

  const now = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: lobbies } = await supabase
    .from("lobbies")
    .select("*")
    .eq("court_id", id)
    .eq("status", "open")
    .gte("start_time", now)
    .order("start_time", { ascending: true });

  const countsMap: Record<string, number> = {};
  if (lobbies && lobbies.length > 0) {
    const { data: countsData } = await supabase.rpc(
      "get_lobby_counts",
      { p_lobby_ids: lobbies.map((l) => l.id) }
    );
    countsData?.forEach((c) => {
      countsMap[c.lobby_id] = Number(c.count);
    });
  }

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

  // Check if current user has an active check-in at this court
  let userCheckInId: string | null = null;
  if (user) {
    const { data: userCheckIn } = await supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", user.id)
      .eq("court_id", id)
      .eq("status", "active")
      .maybeSingle();
    userCheckInId = userCheckIn?.id ?? null;
  }

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
    paving_stones: "Pav├⌐",
    wood: "Legno",
    rubber: "Gomma",
    clay: "Terra battuta",
    sand: "Sabbia",
  };

  const surfaceEmoji: Record<string, string> = {
    asphalt: "≡ƒÅƒ∩╕Å",
    concrete: "≡ƒº▒",
    tartan: "≡ƒÅâ",
    artificial_turf: "≡ƒî┐",
    ground: "Γ¢░∩╕Å",
    grass: "≡ƒî▒",
    paved: "≡ƒ¬¿",
    paving_stones: "≡ƒº▒",
    wood: "≡ƒ¬╡",
    rubber: "ΓÜ½",
    clay: "≡ƒÅ£∩╕Å",
    sand: "≡ƒÅû∩╕Å",
  };

  const sportEmoji: Record<string, string> = {
    volleyball: "≡ƒÅÉ",
    basketball: "≡ƒÅÇ",
    tennis: "≡ƒÄ╛",
    football: "ΓÜ╜",
    general: "≡ƒÅƒ∩╕Å",
  };

  const sportLabels: Record<string, string> = {
    volleyball: "Pallavolo",
    basketball: "Basket",
    tennis: "Tennis",
    football: "Calcetto",
    general: "Sport",
  };

  const accessConfig: Record<string, { label: string; variant: "success" | "accent" | "warning" | "danger"; icon: React.ReactNode }> = {
    public: { label: "Pubblico", variant: "success", icon: <Unlock className="w-3 h-3" /> },
    yes: { label: "Accessibile", variant: "success", icon: <Unlock className="w-3 h-3" /> },
    permissive: { label: "Consentito", variant: "accent", icon: <Unlock className="w-3 h-3" /> },
    private: { label: "Privato", variant: "danger", icon: <Lock className="w-3 h-3" /> },
    restricted: { label: "Riservato", variant: "warning", icon: <Lock className="w-3 h-3" /> },
    no: { label: "Vietato", variant: "danger", icon: <Lock className="w-3 h-3" /> },
    permit: { label: "Su permesso", variant: "warning", icon: <HelpCircle className="w-3 h-3" /> },
  };

  const courtAny = court as Record<string, unknown>;
  const courtZone = courtAny.zone as string | null;
  const courtSport = courtAny.sport as string | null;
  const courtVenueType = courtAny.venue_type as string | null;

  const activeCheckInCount = activeCheckIns?.length ?? 0;
  const totalSlots = lobbies?.reduce((sum, l) => {
    const count = countsMap[l.id] ?? 0;
    return sum + ((l as any).max_players - count);
  }, 0) ?? 0;
  const totalPlayersInLobbies = lobbies?.reduce((sum, l) => {
    return sum + (countsMap[l.id] ?? 0);
  }, 0) ?? 0;

  const mapUrl = court.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(court.address + ", Roma")}`
    : `https://www.google.com/maps/search/?api=1&query=${court.lat},${court.lng}`;

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
    <main className="px-4 pt-5 pb-8 max-w-[1600px] mx-auto">

      {/* Ban/Karma Warning */}
      <BanBannerWrapper userId={user?.id ?? null} />

      {/* Desktop: 2-column layout | Mobile: stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">

        {/* LEFT COLUMN ΓÇö Info */}
        <div className="space-y-4">

          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Torna alla mappa</span>
          </Link>

          {/* Court header card */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-5 space-y-4">

            {/* Name + address + navigate */}
            <div>
              <h1 className="text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)] leading-tight">
                {court.name}
              </h1>
              <div className="flex items-start gap-1.5 mt-2 text-[var(--text-secondary)] text-sm">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{court.address || "Indirizzo non disponibile"}</span>
              </div>
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Apri in Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Court info chips */}
            <div className="flex flex-wrap gap-2">
              {court.surface_type && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--cool-muted)]/15 text-[var(--cool-muted)]">
                  <span>{surfaceEmoji[court.surface_type] ?? "≡ƒÅƒ∩╕Å"}</span>
                  <span>{surfaceLabels[court.surface_type] ?? court.surface_type}</span>
                </div>
              )}
              {court.hoop_count && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{court.hoop_count} {court.hoop_count === 1 ? "canestro" : "canestri"}</span>
                </div>
              )}
              {courtSport && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--warm)]/15 text-[var(--warm)]">
                  <span>{sportEmoji[courtSport] ?? "≡ƒÅƒ∩╕Å"}</span>
                  <span>{sportLabels[courtSport] ?? courtSport}</span>
                </div>
              )}
              {courtVenueType && courtVenueType !== "field_multi" && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--cool-muted)]/15 text-[var(--cool-muted)]">
                  <span>≡ƒÅƒ∩╕Å</span>
                  <span>{courtVenueType}</span>
                </div>
              )}
              {courtZone && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--cool-muted)]/15 text-[var(--text-secondary)]">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{courtZone}</span>
                </div>
              )}
              {court.access ? (
                <Badge variant={accessConfig[court.access]?.variant ?? "warning"}>
                  <span className="flex items-center gap-1">
                    {accessConfig[court.access]?.icon}
                    {accessConfig[court.access]?.label ?? "Sconosciuto"}
                  </span>
                </Badge>
              ) : null}
            </div>

            {/* Access unknown warning */}
            {!court.access && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/20">
                <HelpCircle className="w-4 h-4 mt-0.5 text-[var(--warning)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--warning-dark)]">
                    Non sappiamo se questo campo ├¿ pubblico
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Potrebbe essere privato ΓÇö verifica prima di andare.
                  </p>
                </div>
              </div>
            )}

            {/* Mini map */}
            <CourtMiniMap
              lat={court.lat}
              lng={court.lng}
              courtName={court.name}
              zone={courtZone ?? undefined}
            />

            {/* Active reports */}
            {reports && reports.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-[var(--danger)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--danger)]">
                    {reports.length} {reports.length === 1 ? "segnalazione" : "segnalazioni"} attive
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {reports.slice(0, 3).map((r) => (
                      <li key={r.id} className="text-xs text-[var(--text-secondary)]">
                        ΓÇó {reportCategories[r.category] || r.category}
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

            {/* Action buttons */}
            {user ? (
              <div className="flex flex-wrap gap-2">
                {userCheckInId ? (
                  <CheckoutButton checkInId={userCheckInId} />
                ) : (
                  <CheckInButton
                    courtId={court.id}
                    courtName={court.name}
                    courtLat={court.lat}
                    courtLng={court.lng}
                  />
                )}
                <FavoriteButtonWrapper courtId={court.id} />
                <ReportButton
                  courtId={court.id}
                  courtName={court.name}
                />
              </div>
            ) : (
              <LoginPrompt />
            )}
          </div>
        </div>

        {/* RIGHT COLUMN ΓÇö Now + Lobbies */}
        <div className="space-y-4 min-w-0">

          {/* "Now" card */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 sm:p-5 space-y-3">

            {/* Now header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                  <SunDim className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h2 className="font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
                    Ora su questo campo
                  </h2>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Active check-ins */}
              <div className="bg-[var(--bg-elevated)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-syne)]">
                  {activeCheckInCount}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {activeCheckInCount === 1 ? "in campo" : "in campo"}
                </p>
              </div>
              {/* Open lobbies */}
              <div className="bg-[var(--bg-elevated)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[var(--accent)] font-[family-name:var(--font-syne)]">
                  {lobbies?.length ?? 0}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {(lobbies?.length ?? 0) === 1 ? "partita aperta" : "partite aperte"}
                </p>
              </div>
            </div>

            {/* Slots available */}
            {lobbies && lobbies.length > 0 && totalSlots > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-[var(--text-secondary)]">
                  {totalPlayersInLobbies} giocatori in campo,
                  <span className="text-[var(--text-primary)] font-medium"> {totalSlots} posti liberi</span> nelle partite aperte
                </span>
              </div>
            )}

            {lobbies && lobbies.length > 0 && (
              <CreateLobbyButton
                courtId={court.id}
                courtName={court.name}
              />
            )}
          </div>

          {/* Lobbies list */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-lg font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
                Prossime partite
              </h2>
              {lobbies && lobbies.length > 0 && (
                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-1 rounded-full">
                  {lobbies.length} {lobbies.length === 1 ? "attiva" : "attive"}
                </span>
              )}
            </div>

            {lobbies && lobbies.length > 0 ? (
              <div className="space-y-3">
                {lobbies.map((lobby) => {
                  const lp = lobby as unknown as {
                    id: string;
                    court_id: string;
                    creator_id: string;
                    start_time: string;
                    max_players: number;
                    status: string;
                    sport?: string;
                  };

                  return (
                    <div key={lp.id} className="space-y-3">
                      <LobbyJoinCard
                        lobby={{ ...lp, participant_count: countsMap[lp.id] ?? 0 }}
                        userId={user?.id}
                      />
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
        </div>
      </div>
    </main>
    </div>
  );
}
