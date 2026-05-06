"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CourtMap } from "@/components/map/court-map";
import { LoginModal } from "@/components/auth/login-modal";
import { BanBanner } from "@/components/karma/ban-banner";
import { Button } from "@/components/ui/button";
import { ReportedCourtsIndicator } from "@/components/report/reported-courts-indicator";
import { MapPin, Users } from "lucide-react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

interface Court {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  surface_type: string | null;
  hoop_count: number | null;
  status: string | null;
  zone: string | null;
}

interface Lobby {
  id: string;
  court_id: string;
  start_time: string;
  max_players: number;
  status: string;
  participants_count: number;
}

export default function HomePage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [reportedCourtIds, setReportedCourtIds] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Extract unique zones from courts for the filter
  const availableZones = useMemo(() => {
    const zones = new Set<string>();
    courts.forEach((c) => { if (c.zone) zones.add(c.zone); });
    return Array.from(zones).sort();
  }, [courts]);

  // Filter courts by selected zone
  const filteredCourts = useMemo(() => {
    if (!selectedZone) return courts;
    return courts.filter((c) => c.zone === selectedZone);
  }, [courts, selectedZone]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch courts
        // @ts-expect-error sport and zone are in DB but not in generated types
        const { data: courtsData } = await supabase.from("courts").select("*").eq("sport", "basketball").limit(500);
        setCourts((courtsData || []) as unknown as Court[]);

        // Fetch active lobbies with participant counts
        const { data: lobbiesData } = await supabase
          .from("lobbies")
          .select("*, lobby_participants(count)")
          .eq("status", "open")
          .order("start_time", { ascending: true })
          .limit(20);

        const formattedLobbies: Lobby[] =
          (lobbiesData as unknown as Array<{
            id: string;
            court_id: string;
            start_time: string;
            max_players: number;
            status: string;
            lobby_participants?: { count: number }[];
          }> | null ?? []).map((l) => ({
            id: l.id,
            court_id: l.court_id,
            start_time: l.start_time,
            max_players: l.max_players,
            status: l.status,
            participants_count: l.lobby_participants?.[0]?.count ?? 0,
          }));

        setLobbies(formattedLobbies);

        // Check auth
        const { data: authData } = await supabase.auth.getUser();
        setUser(authData.user);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to lobby changes
    const channel = supabase
      .channel("lobbies")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobbies" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center" role="status" aria-label="Caricamento dati in corso">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-32 bg-[var(--bg-surface)] rounded-lg" />
          <div className="h-4 w-48 bg-[var(--bg-surface)] rounded-lg" />
        </div>
        <span className="sr-only">Caricamento campi e lobby...</span>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col relative">
      {user && <BanBanner userId={user.id} />}
      {/* Zone filter — above the map */}
      {availableZones.length > 0 && (
        <div className="px-3 pt-3">
          <select
            value={selectedZone ?? ""}
            onChange={(e) => setSelectedZone(e.target.value || null)}
            className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--cool-muted)]/20 appearance-none cursor-pointer"
          >
            <option value="">Tutte le zone ({courts.length})</option>
            {availableZones.map((zone) => {
              const count = courts.filter((c) => c.zone === zone).length;
              return (
                <option key={zone} value={zone}>
                  {zone} ({count})
                </option>
              );
            })}
          </select>
        </div>
      )}
      <div className="flex-1 relative min-h-[50vh]">
        <CourtMap
          courts={filteredCourts}
          reportedCourtIds={reportedCourtIds}
          onCourtSelect={(id) => {
            window.location.href = `/courts/${id}`;
          }}
        />
        <ReportedCourtsIndicator onCourtsUpdate={setReportedCourtIds} />
      </div>

      <div className="bg-[var(--bg-base)] border-t border-[var(--cool-muted)]/20 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-[family-name:var(--font-syne)] sr-only">
            Drop-In — Campi da basket
          </h1>
          <h2 className="text-xl font-bold font-[family-name:var(--font-syne)]">
            Partite vicine
          </h2>
          {!user && (
            <Button variant="ghost" size="sm" onClick={() => setShowLogin(true)}>
              Accedi
            </Button>
          )}
        </div>

        {/* Live region for realtime lobby updates */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {lobbies.length} lobby attive disponibili
        </div>

        {lobbies.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-[var(--text-muted)] text-sm">
              Nessuna lobby attiva nelle vicinanze.
            </p>
            <p className="text-[var(--text-muted)] text-xs mt-1">
              Sii il primo a creare una!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lobbies.map((lobby) => (
              <Link
                key={lobby.id}
                href={`/courts/${lobby.court_id}`}
                className="block bg-[var(--bg-surface)] rounded-xl p-4 active:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {courts.find((c) => c.id === lobby.court_id)?.name || "Campo"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-secondary)]">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {lobby.participants_count}/{lobby.max_players}
                      </span>
                      <span aria-hidden="true">•</span>
                      <span>
                        {new Date(lobby.start_time).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="primary" tabIndex={-1}>
                    Vedi
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </main>
  );
}
