import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CheckInButton } from "@/components/check-in/check-in-button";
import { CreateLobbyButton } from "@/components/lobby/create-lobby-button";
import { ReportButton } from "@/components/report/report-button";
import { LoginPrompt } from "@/components/auth/login-prompt";
import { BanBannerWrapper } from "@/components/karma/ban-banner-wrapper";
import { MapPin, AlertTriangle, Clock, Users } from "lucide-react";

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

  return (
    <main className="flex-1 p-6 space-y-6">
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
      {reports && reports.length > 0 && (
        <div className="bg-[var(--danger)]/5 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-[var(--danger)]">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="font-semibold">Segnalazioni attive</h2>
          </div>
          <ul className="space-y-2">
            {reports.map((report) => (
              <li
                key={report.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[var(--text-primary)]">
                  {reportCategories[report.category] || report.category}
                </span>
                <span className="text-[var(--text-muted)] text-xs">
                  {new Date(report.created_at).toLocaleDateString("it-IT")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
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
            />
          </>
        ) : (
          <LoginPrompt />
        )}
      </div>

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
              <div
                key={lobby.id}
                className="bg-[var(--bg-surface)] rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--text-muted)]" />
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
                    <Users className="w-4 h-4" />
                    <span>
                      {(lobby.lobby_participants?.[0]?.count ?? 0)} /{" "}
                      {lobby.max_players}
                    </span>
                  </div>
                </div>
                <Badge variant="accent">Aperta</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-sm">
            Nessuna lobby attiva su questo campo.
          </p>
        )}
      </div>
    </main>
  );
}
