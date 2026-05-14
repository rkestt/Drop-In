"use client";

import { useEffect, useMemo, useState } from "react";
import { useCourtCache } from "@/lib/hooks/useCourtCache";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRecentCourts } from "@/lib/hooks/useRecentCourts";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { createClient } from "@/lib/supabase/client";
import { CourtMap } from "@/components/map/court-map";
import { LoginModal } from "@/components/auth/login-modal";
import { BanBanner } from "@/components/karma/ban-banner";
import { Button } from "@/components/ui/button";
import { QuickCreateFAB } from "@/components/ui/fab";
import { RecentCourtsSheet } from "@/components/ui/recent-courts-sheet";
import { ReportedCourtsIndicator } from "@/components/report/reported-courts-indicator";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  ChevronRight,
  Volleyball,
} from "lucide-react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

interface Court {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  sport?: string | null;
  zone?: string | null;
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
  const { courts } = useCourtCache();
  const { user } = useAuth();
  const { recentCourts, addRecent } = useRecentCourts();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRecentCourts, setShowRecentCourts] = useState(false);

  const [reportedCourtIds, setReportedCourtIds] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"time" | "distance" | "spots">("time");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Lobby count per court — for map markers
  const lobbyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    lobbies.forEach((l) => {
      counts[l.court_id] = (counts[l.court_id] ?? 0) + 1;
    });
    return counts;
  }, [lobbies]);

  // All available sport filters (these are the only ones with UI buttons)
  const FILTER_SPORTS = ["basketball", "volleyball", "soccer", "tennis", "padel"] as const;

  // Filter courts by selected sport
  // When ALL filter sports are selected, show ALL courts (same as "Tutti")
  const filteredCourts = useMemo(() => {
    const totalSports = 5;
    // If no filters selected OR all filters selected, show all courts
    if (selectedSports.length === 0 || selectedSports.length === totalSports) {
      return courts;
    }
    // Otherwise, filter by selected sports
    return courts.filter(
      (c) => c.sport && selectedSports.some((s) => c.sport!.includes(s))
    );
  }, [courts, selectedSports]);

  // Today's lobbies only (for hero card) - with sorting
  const todayLobbies = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    let filtered = lobbies.filter((l) => {
      const t = new Date(l.start_time);
      return t >= startOfDay && t <= endOfDay;
    });
    
    if (sortBy === "distance" && userLocation) {
      // Add distance to each lobby's court
      filtered = filtered.map(lobby => {
        const court = courts.find(c => c.id === lobby.court_id);
        let distance = Infinity;
        if (court) {
          distance = Math.sqrt(
            Math.pow((court.lat - userLocation.lat) * 111, 2) + 
            Math.pow((court.lng - userLocation.lng) * 111 * Math.cos(userLocation.lat * Math.PI / 180), 2)
          );
        }
        return { ...lobby, distance };
      }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else if (sortBy === "spots") {
      filtered = [...filtered].sort((a, b) => {
        const freeA = a.max_players - a.participants_count;
        const freeB = b.max_players - b.participants_count;
        return freeB - freeA;
      });
    } else {
      // Default: sort by time
      filtered = [...filtered].sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    }
    
    return filtered;
  }, [lobbies, courts, sortBy, userLocation]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch active lobbies (status=open AND start_time >= now)
        const now = new Date().toISOString();
        const { data: lobbiesData } = await supabase
          .from("lobbies")
          .select("*, lobby_participants(count)")
          .eq("status", "open")
          .gte("start_time", now)
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

  // Get user location for distance sorting
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Location denied - fallback to time sorting
        setSortBy("time");
      }
    );
  }, []);

  const isInitialLoading = loading || courts.length === 0;

  if (isInitialLoading) {
    return (
      <main
        className="flex-1 flex items-center justify-center"
        role="status"
        aria-label="Caricamento dati in corso"
      >
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-32 bg-[var(--bg-surface)] rounded-lg" />
          <div className="h-4 w-48 bg-[var(--bg-surface)] rounded-lg" />
        </div>
        <span className="sr-only">Caricamento campi e lobby...</span>
      </main>
    );
  }

  const totalActiveLobbies = lobbies.length;

  return (
    <main className="flex flex-col flex-1 relative overflow-hidden">
      {user && <BanBanner userId={user.id} />}

      {/* ── DESKTOP: top bar (lg+) ──────────────────────────────── */}
      <div className="hidden lg:flex lg:items-center lg:gap-3 lg:px-4 lg:py-3 lg:border-b lg:border-[var(--cool-muted)]/20 lg:bg-[var(--bg-surface)]">
        <h1 className="font-bold font-[family-name:var(--font-syne)] text-sm text-[var(--text-primary)]">
          Drop in
        </h1>

        {/* Desktop sport filter chips */}
        <div className="flex items-center gap-1.5 ml-2">
          {/* "Tutti" button - shows all when active or when all filters are selected */}
          <button
            onClick={() => setSelectedSports(FILTER_SPORTS as unknown as string[])}
            className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
              selectedSports.length === 0
                ? "bg-[var(--accent)] text-white border-transparent"
                : "text-[var(--text-secondary)] border-[var(--cool-muted)]/30 bg-[var(--bg-elevated)] hover:border-[var(--cool-muted)]/50"
            }`}
          >
            Tutti
          </button>
          {FILTER_SPORTS.map((s) => (
            <button
              key={s}
              onClick={() =>
                setSelectedSports((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                )
              }
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                selectedSports.includes(s)
                  ? "bg-[var(--accent)] text-white border-transparent"
                  : "text-[var(--text-secondary)] border-[var(--cool-muted)]/30 bg-[var(--bg-elevated)] hover:border-[var(--cool-muted)]/50"
              }`}
            >
              {s === "basketball" ? "🏀 Basket" :
               s === "volleyball" ? "🏐 Pallavolo" :
               s === "soccer" ? "⚽ Calcetto" :
               s === "tennis" ? "🎾 Tennis" :
               s === "padel" ? "🎾 Padel" : s}
            </button>
          ))}
        </div>

        {!user && (
          <Button variant="ghost" size="sm" onClick={() => setShowLogin(true)} className="ml-auto">
            Accedi
          </Button>
        )}
      </div>

      {/* ── MOBILE+DESKTOP body: map + sidebar ─────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* ── Left: Map (mobile: top section, desktop: 60%) ── */}
        <div className="relative min-h-[50vh] lg:min-h-0 lg:flex-1">
          <CourtMap
            courts={filteredCourts}
            reportedCourtIds={reportedCourtIds}
            lobbyCounts={lobbyCounts}
            onCourtClick={(court) => {
              addRecent(court);
            }}
            onCourtSelect={(id) => {
              window.location.href = `/courts/${id}`;
            }}
          />
          <ReportedCourtsIndicator onCourtsUpdate={setReportedCourtIds} />
        </div>

        {/* ── Right: sidebar (mobile: scrollable below, desktop: 40%) ── */}
        <div className="flex flex-col flex-1 lg:w-[420px] lg:flex-shrink-0 bg-[var(--bg-base)] lg:border-l lg:border-[var(--cool-muted)]/20 overflow-hidden">

          {/* MOBILE only: sport filter chips */}
          <div className="lg:hidden px-3 pt-3 pb-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* "Tutti" button - shows all when active or when all filters are selected */}
              <button
                onClick={() => setSelectedSports(FILTER_SPORTS as unknown as string[])}
                className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                  selectedSports.length === 0
                    ? "bg-[var(--accent)] text-white border-transparent"
                    : "text-[var(--text-secondary)] border-[var(--cool-muted)]/30 bg-[var(--bg-elevated)]"
                }`}
              >
                Tutti
              </button>
              {FILTER_SPORTS.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    setSelectedSports((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                    )
                  }
                  className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                    selectedSports.includes(s)
                      ? "bg-[var(--accent)] text-white border-transparent"
                      : "text-[var(--text-secondary)] border-[var(--cool-muted)]/30 bg-[var(--bg-elevated)]"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Hero card — "partite oggi" (desktop only at top of sidebar) */}
          {todayLobbies.length > 0 && (
            <div className="hidden lg:block px-4 pt-4 pb-2 flex-shrink-0">
              <HeroCard
                lobbies={todayLobbies}
                courts={courts}
                totalActive={totalActiveLobbies}
                user={user}
                onLoginClick={() => setShowLogin(true)}
              />
            </div>
          )}

          {/* Mobile hero card (shown above list) */}
          {todayLobbies.length > 0 && (
            <div className="lg:hidden px-3 pb-2 flex-shrink-0">
              <HeroCard
                lobbies={todayLobbies}
                courts={courts}
                totalActive={totalActiveLobbies}
                user={user}
                onLoginClick={() => setShowLogin(true)}
              />
            </div>
          )}

          {/* Live region for realtime updates */}
          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {lobbies.length} lobby attive disponibili
          </div>

          {/* Lobby list — scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3 space-y-3 min-h-0">
            {/* Section header */}
            <div className="flex items-center justify-between pt-2 pb-1 sticky top-0 bg-[var(--bg-base)] z-10">
              <h2 className="text-base font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
                {totalActiveLobbies > 0
                  ? `${totalActiveLobbies} partite attive`
                  : "Nessuna partita"}
              </h2>
              <div className="flex items-center gap-2">
                {totalActiveLobbies > 0 && (
                  <span className="flex items-center gap-1 text-xs text-[var(--success)] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                    Live
                  </span>
                )}
                {todayLobbies.length > 0 && (
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "time" | "distance" | "spots")}
                    className="text-xs bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--cool-muted)]/30 rounded px-2 py-1 cursor-pointer"
                  >
                    <option value="time">🕐 Orario</option>
                    {userLocation && <option value="distance">📍 Vicino</option>}
                    <option value="spots">👥 Posti</option>
                  </select>
                )}
              </div>
            </div>

            {lobbies.length === 0 ? (
              <div className="text-center py-10">
                <Volleyball className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                <p className="text-[var(--text-muted)] text-sm font-medium">
                  Nessuna partita attiva
                </p>
                <p className="text-[var(--text-muted)] text-xs mt-1">
                  Sii il primo a crearne una!
                </p>
                <div className="mt-4">
                  <QuickCreateFAB
                    onClick={() => {
                      if (!user) {
                        setShowLogin(true);
                      } else {
                        setShowRecentCourts(true);
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                {lobbies.map((lobby) => {
                  const court = courts.find((c) => c.id === lobby.court_id);
                  const isToday = todayLobbies.some((l) => l.id === lobby.id);
                  return (
                    <LobbyRow
                      key={lobby.id}
                      lobby={lobby}
                      courtName={court?.name || "Campo"}
                      courtZone={court?.zone || null}
                      highlight={isToday}
                      user={user}
                      onLoginClick={() => setShowLogin(true)}
                    />
                  );
                })}
              </>
            )}
          </div>

          {/* CTA sticky at bottom of sidebar */}
          {lobbies.length > 0 && (
            <div className="flex-shrink-0 p-3 border-t border-[var(--cool-muted)]/20">
              <QuickCreateFAB
                onClick={() => {
                  if (!user) {
                    setShowLogin(true);
                  } else {
                    setShowRecentCourts(true);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />

      {/* FAB - fixed bottom on mobile, inline in sidebar on desktop */}
      <div className="lg:hidden fixed bottom-20 left-3 right-3 z-30">
        <QuickCreateFAB
          onClick={() => {
            if (!user) {
              setShowLogin(true);
            } else {
              setShowRecentCourts(true);
            }
          }}
        />
      </div>

      {/* Recent Courts Sheet */}
      <RecentCourtsSheet
        open={showRecentCourts}
        onClose={() => setShowRecentCourts(false)}
        onSelectCourt={(courtId) => {
          setShowRecentCourts(false);
          window.location.href = `/courts/${courtId}`;
        }}
        recentCourts={recentCourts}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
      />
    </main>
  );
}

// ─── Hero card ──────────────────────────────────────────────────────────────

function HeroCard({
  lobbies,
  courts,
  totalActive,
  user: _user,
  onLoginClick: _onLoginClick,
}: {
  lobbies: Lobby[];
  courts: Court[];
  totalActive: number;
  user: User | null;
  onLoginClick: () => void;
}) {
  const preview = lobbies.slice(0, 3);

  return (
    <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-[var(--accent)] uppercase tracking-wide">
            {totalActive > 3 ? "Oggi" : "Attive ora"}
          </span>
        </div>
        <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/15 px-2 py-0.5 rounded-full">
          {totalActive}
        </span>
      </div>

      <div className="space-y-2">
        {preview.map((lobby) => {
          const court = courts.find((c) => c.id === lobby.court_id);
          return (
            <Link
              key={lobby.id}
              href={`/courts/${lobby.court_id}`}
              className="flex items-center justify-between bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Volleyball className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                <span className="text-sm font-semibold truncate">
                  {court?.name || "Campo"}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="success" className="text-[10px]">
                  {lobby.participants_count}/{lobby.max_players}
                </Badge>
                <span className="text-xs text-[var(--text-secondary)]">
                  {new Date(lobby.start_time).toLocaleTimeString("it-IT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {totalActive > 3 && (
        <div className="mt-3 text-center">
          <span className="text-xs text-[var(--text-muted)]">
            +{totalActive - 3} altre partite in lista
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Lobby row ───────────────────────────────────────────────────────────────

function LobbyRow({
  lobby,
  courtName,
  courtZone,
  highlight,
  user: _user,
  onLoginClick: _onLoginClick,
}: {
  lobby: Lobby;
  courtName: string;
  courtZone: string | null;
  highlight?: boolean;
  user: User | null;
  onLoginClick: () => void;
}) {
  const fillPct = (lobby.participants_count / lobby.max_players) * 100;
  const isFull = lobby.participants_count >= lobby.max_players;

  return (
    <Link
      href={`/courts/${lobby.court_id}`}
      className={`block rounded-xl p-3 transition-colors active:scale-[0.99] ${
        highlight
          ? "bg-[var(--accent)]/8 border border-[var(--accent)]/20"
          : "bg-[var(--bg-surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{courtName}</p>
          {courtZone && (
            <p className="text-xs text-[var(--text-muted)]">{courtZone}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant={isFull ? "danger" : "success"} className="text-[10px]">
            {isFull ? "Pieno" : `${lobby.participants_count}/${lobby.max_players}`}
          </Badge>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${fillPct}%`,
            backgroundColor: isFull
              ? "var(--danger)"
              : fillPct > 70
              ? "var(--warning)"
              : "var(--success)",
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <Users className="w-3.5 h-3.5" />
          <span>
            {new Date(lobby.start_time).toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <span className="text-xs font-medium text-[var(--accent)]">
          Vedi →
        </span>
      </div>
    </Link>
  );
}
