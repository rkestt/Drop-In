import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CheckInButton } from "@/components/check-in/check-in-button";
import { CoachMark } from "@/components/onboarding/coach-mark";
import { CreateLobbyButton } from "@/components/lobby/create-lobby-button";
import { ReportButton } from "@/components/report/report-button";
import type { ReportRow } from "@/components/report/report-drawer";
import {
  activeReports,
  categoryLabel,
  formatReportExpiry,
} from "@/lib/reports/active";
import { LoginPrompt } from "@/components/auth/login-prompt";
import { BanBannerWrapper } from "@/components/karma/ban-banner-wrapper";
import { MapPin, AlertTriangle, Clock, Users } from "lucide-react";
import { courtDetailKey } from "@/lib/offline/cache";
import { CacheWriter } from "@/components/offline/cache-writer";
import { CourtOfflineShell } from "@/components/offline/court-offline-shell";

export const dynamic = "force-dynamic";

export default async function CourtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // d24: Supabase irraggiungibile ≠ 404. Il fallimento di rete finisce
  // nella shell offline (cache o messaggio + Riprova); notFound solo se
  // il campo davvero non esiste.
  let loadError = false;
  let court: {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
    surface_type: string | null;
    hoop_count: number | null;
    photo_path: string | null;
  } | null = null;
  let lobbies: {
    id: string;
    start_time: string;
    max_players: number;
    lobby_participants?: { count: number }[];
  }[] | null = null;
  let reports: {
    id: string;
    category: string;
    expires_at: string;
    user_id: string;
  }[] | null = null;

  try {
    // supabase-js ritorna { error } anche su errore rete (non lancia):
    // PGRST116 = riga assente → 404 vero; altro errore → shell offline.
    const { data: courtData, error: courtError } = await supabase
      .from("courts")
      .select("*")
      .eq("id", id)
      .single();
    if (courtError) {
      if (courtError.code !== "PGRST116") throw courtError;
    } else {
      court = courtData;
    }

    if (court) {
      const { data: lobbiesData, error: lobbiesError } = await supabase
        .from("lobbies")
        .select("*, lobby_participants(count)")
        .eq("court_id", id)
        .eq("status", "open")
        .order("start_time", { ascending: true });
      if (lobbiesError) throw lobbiesError;
      lobbies = lobbiesData;

      const { data: reportsData, error: reportsError } = await supabase
        .from("court_reports")
        .select("id, category, expires_at, user_id")
        .eq("court_id", id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(10);
      if (reportsError) throw reportsError;
      reports = reportsData;
    }
  } catch {
    loadError = true;
  }

  // d24: campo assente senza errore di rete → 404 vero; errore di rete →
  // shell offline (cache o messaggio + Riprova), mai un 404 secco.
  if (!court) {
    if (loadError) return <CourtOfflineShell courtId={id} />;
    notFound();
  }


  const {
    data: { user },
  } = await supabase.auth.getUser();

  const photoUrl = court.photo_path
    ? supabase.storage.from("court-photos").getPublicUrl(court.photo_path).data.publicUrl
    : null;

  const activeReportRows: ReportRow[] = activeReports(
    (reports ?? []).map((r) => ({
      id: r.id,
      category: r.category,
      expires_at: r.expires_at,
      user_id: r.user_id,
    })),
  );

  return (
    <main className="flex-1 p-6 space-y-6">
      <CacheWriter
        storageKey={courtDetailKey(id)}
        value={{
          court: {
            name: court.name,
            address: court.address,
            surface_type: court.surface_type,
            hoop_count: court.hoop_count,
          },
          openLobbies: lobbies?.length ?? 0,
          savedAt: Date.now(),
        }}
      />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] mb-1">
          {court.name}
        </h1>
        <p className="text-[var(--text-secondary)] flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          {court.address || "Indirizzo non disponibile"}
        </p>
      </div>

      {photoUrl && (
        <div className="relative aspect-video rounded-xl overflow-hidden bg-[var(--bg-surface)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={`Foto di ${court.name}`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Info */}
      <div className="flex flex-wrap gap-2">
        {court.surface_type && (
          <Badge variant="default">{court.surface_type}</Badge>
        )}
        {court.hoop_count && (
          <Badge variant="default">{court.hoop_count} canestri</Badge>
        )}
      </div>

      {/* Active Reports */}
      {activeReportRows.length > 0 && (
        <div className="bg-[var(--danger)]/5 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-[var(--danger)]">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            <h2 className="font-semibold">Segnalazioni attive</h2>
          </div>
          <ul className="space-y-2">
            {activeReportRows.map((report) => (
              <li
                key={report.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex items-center gap-2 text-[var(--text-primary)]">
                  {categoryLabel(report.category)}
                  {user && report.user_id === user.id && (
                    <Badge variant="accent">Tua</Badge>
                  )}
                </span>
                <span className="text-[var(--text-muted)] text-xs">
                  {report.expires_at
                    ? `Scade il ${formatReportExpiry(report.expires_at)}`
                    : "Senza scadenza"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {/* Coach mark sul blocco azioni (non solo sul CheckInButton): la scheda
          campo si apre anche senza login e l'acceptance chiede il coach alla
          prima apertura; da loggato punta comunque al bottone Check-in. */}
      <CoachMark feature="check-in">
        <div className="flex flex-wrap gap-3">
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
                reports={activeReportRows}
                currentUserId={user?.id ?? null}
                signedIn={!!user}
              />
            </>
          ) : (
            <LoginPrompt />
          )}
        </div>
      </CoachMark>

      {/* Ban/Karma Warning */}
      <BanBannerWrapper userId={user?.id ?? null} />

      {/* Active Lobbies */}
      <div>
        <h2 className="text-xl font-bold font-[family-name:var(--font-syne)] mb-3">
          Lobby attive
        </h2>
        {lobbies && lobbies.length > 0 ? (
          <div className="space-y-3">
            {lobbies.map((lobby: { id: string; start_time: string; max_players: number; lobby_participants?: { count: number }[] }) => (
              <Link
                key={lobby.id}
                href={`/lobbies/${lobby.id}`}
                aria-label={`Lobby delle ${new Date(lobby.start_time).toLocaleString("it-IT", { hour: "2-digit", minute: "2-digit" })}, ${(lobby.lobby_participants?.[0]?.count ?? 0)} su ${lobby.max_players}`}
                className="block rounded-xl bg-[var(--bg-surface)] p-4 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                      <span className="font-medium text-[var(--text-primary)]">
                        {new Date(lobby.start_time).toLocaleString("it-IT", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-secondary)]">
                      <Users className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {(lobby.lobby_participants?.[0]?.count ?? 0)} /{" "}
                        {lobby.max_players}
                      </span>
                    </div>
                  </div>
                  <Badge variant="accent">Aperta</Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Nessuna lobby qui intorno. Sii il primo.
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Una lobby è un appuntamento: scegli orario e quanti siete, gli
              altri si uniscono dalla mappa.
            </p>
            <div className="mt-3">
              <CreateLobbyButton
                courtId={court.id}
                courtName={court.name}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
