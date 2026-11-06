"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import { MapSkeleton } from "@/components/map/map-skeleton";
import { LoginModal } from "@/components/auth/login-modal";
import { BanBanner } from "@/components/karma/ban-banner";
import { Button } from "@/components/ui/button";
import { ReportedCourtsIndicator } from "@/components/report/reported-courts-indicator";
import { MapPin, Users } from "lucide-react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

const CourtMap = dynamic(() => import("@/components/map/court-map").then((m) => ({ default: m.CourtMap })), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const ROME_CENTER = { lat: 41.8919, lng: 12.5113 };

interface Court {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  surface_type: string | null;
  hoop_count: number | null;
  status: string | null;
  distance_m?: number;
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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [originFromDevice, setOriginFromDevice] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const handleCourtSelect = useCallback((id: string) => {
    window.location.href = `/courts/${id}`;
  }, []);

  const fetchLobbies = useCallback(async () => {
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
  }, [supabase]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchLobbies();
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();

    // auth fire-and-forget
    supabase.auth.getUser().then(({ data }) => setUser(data.user)).catch(() => {});

    const channel = supabase
      .channel("lobbies")
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies" }, () => {
        fetchLobbies().catch(() => {});
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          fetchLobbies().catch(() => {});
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchLobbies]);

  useEffect(() => {
    if (!navigator.geolocation) {
      void Promise.resolve().then(() => {
        setOrigin(ROME_CENTER);
        setOriginFromDevice(false);
        setUserLocation(null);
        setLocationError("Posizione non disponibile. Centro su Roma.");
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginFromDevice(true);
        setUserLocation([pos.coords.longitude, pos.coords.latitude]);
        setLocationError(null);
      },
      () => {
        setOrigin(ROME_CENTER);
        setOriginFromDevice(false);
        setUserLocation(null);
        setLocationError("Posizione non disponibile. Centro su Roma.");
      },
      { timeout: 4000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("nearby_courts", {
        p_lat: origin.lat,
        p_lng: origin.lng,
        p_radius_m: 15000,
        p_limit: 200,
      });
      if (cancelled) return;
      if (error) {
        console.error("nearby_courts error:", error);
        setCourts([]);
        setLoading(false);
        return;
      }
      const rows = (data || []) as Array<Court>;
      if (rows.length === 0 && originFromDevice) {
        const { data: fallback, error: fbErr } = await supabase.rpc("nearby_courts", {
          p_lat: ROME_CENTER.lat,
          p_lng: ROME_CENTER.lng,
          p_radius_m: 15000,
          p_limit: 200,
        });
        if (cancelled) return;
        if (fbErr) {
          console.error("nearby_courts fallback error:", fbErr);
          setCourts([]);
          setLoading(false);
          return;
        }
        setCourts((fallback || []) as Array<Court>);
        setLocationError("Nessun campo entro 15 km. Centro su Roma.");
        setUserLocation(null);
        setLoading(false);
        return;
      }
      setCourts(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [origin, originFromDevice, supabase]);

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
      <div className="flex-1 relative min-h-[50dvh] h-[50dvh]">
        <CourtMap
          courts={courts}
          reportedCourtIds={reportedCourtIds}
          onCourtSelect={handleCourtSelect}
          userLocation={userLocation}
          locationError={locationError}
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
