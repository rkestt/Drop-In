import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";
import { CourtLobbyList } from "./lobby-list";

interface CourtDetail {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  surface_type: string | null;
  hoop_count: number | null;
  venue_type: string | null;
  sport: string | null;
  access: string | null;
  zone: string | null;
}

function getSportLabel(sport: string | null): string {
  if (!sport) return "Multi-sport";
  const s = sport.toLowerCase();
  if (s.includes("basket")) return "Basket";
  if (s.includes("volley")) return "Volley";
  if (s.includes("soccer") || s.includes("calcetto") || s.includes("futsal")) return "Calcio";
  if (s.includes("tennis")) return "Tennis";
  if (s.includes("padel")) return "Padel";
  if (s.includes(";") || s === "multi") return "Multi-sport";
  return sport;
}

function formatSurface(surface: string | null): string {
  if (!surface) return "N/D";
  const s = surface.toLowerCase();
  if (s.includes("asphalt")) return "Asfalto";
  if (s.includes("concrete") || s.includes("cement")) return "Cemento";
  if (s.includes("grass") || s.includes("erba")) return "Erba";
  if (s.includes("synthetic") || s.includes("sintetico")) return "Sintetico";
  if (s.includes("tartan") || s.includes("rubber")) return "Tartan";
  if (s.includes("parquet") || s.includes("wood") || s.includes("legno")) return "Parquet";
  if (s.includes("clay") || s.includes("terra")) return "Terra";
  return surface;
}

function formatAccess(access: string | null): string {
  if (!access) return "N/D";
  const a = access.toLowerCase();
  if (a === "public" || a === "yes") return "Pubblico";
  if (a === "private" || a === "no") return "Privato";
  if (a === "customers" || a === "permissive") return "Clienti";
  return access;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("courts")
    .select("name")
    .eq("id", id)
    .single();

  return {
    title: data?.name ? `${data.name} | Drop-In` : "Campo | Drop-In",
    description: `Dettagli del campo ${data?.name || ""} su Drop-In`,
  };
}

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
    .single<CourtDetail>();

  if (!court) {
    notFound();
  }

  return (
    <main className="min-h-full bg-[var(--bg-base)]">
      <div className="max-w-[720px] mx-auto px-4 py-6 space-y-6">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alla mappa
        </Link>

        {/* Court header */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-syne)]">
              {court.name}
            </h1>
            {court.sport && (
              <Badge variant="accent">{getSportLabel(court.sport)}</Badge>
            )}
          </div>

          {court.address && (
            <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--text-muted)]" />
              <span>{court.address}</span>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <DetailBlock label="Superficie" value={formatSurface(court.surface_type)} />
            <DetailBlock label="Accesso" value={formatAccess(court.access)} />
            {court.venue_type && (
              <DetailBlock label="Tipo" value={court.venue_type.replace(/_/g, " ")} />
            )}
            {court.hoop_count != null && court.hoop_count > 0 && (
              <DetailBlock label="Canestri" value={String(court.hoop_count)} />
            )}
            {court.zone && (
              <DetailBlock label="Zona" value={court.zone} />
            )}
          </div>
        </div>

        {/* Active lobbies */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] font-[family-name:var(--font-syne)]">
            Lobby attive
          </h2>
          <CourtLobbyList courtId={court.id} />
        </section>
      </div>
    </main>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-base)] rounded-lg p-3 space-y-0.5">
      <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
        {label}
      </p>
      <p className="text-sm font-medium text-[var(--text-primary)] capitalize">
        {value}
      </p>
    </div>
  );
}
