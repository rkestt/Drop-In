"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LobbyCard } from "./lobby-card";
import { NearbyLobbies } from "./nearby-lobbies";
import { CalendarX } from "lucide-react";
import type { LobbySummary } from "./types";

type TabId = "mine" | "nearby";
const TAB_IDS: TabId[] = ["mine", "nearby"];

/**
 * Lista lobby (prototipo d12): tab "Le tue"/"Vicine" con `aria-selected` e
 * conteggi, empty state con CTA, realtime su `lobbies`+`lobby_participants`
 * via `router.refresh()` — mai `window.location.reload()`.
 */
export function LobbyTabs({
  mine,
  userId,
}: {
  mine: LobbySummary[];
  userId: string;
}) {
  const searchParams = useSearchParams();
  const readTab = (): TabId => (searchParams.get("tab") === "nearby" ? "nearby" : "mine");
  const [tab, setTab] = useState<TabId>(readTab);
  const [nearbyCount, setNearbyCount] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // ?tab= riletto quando cambia (back/forward o link con tab esplicito).
  useEffect(() => {
    setTab(readTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const channel = supabase
      .channel("lobbies-tabs")
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies" }, () =>
        router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobby_participants" },
        () => router.refresh()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") router.refresh();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold font-[family-name:var(--font-syne)]">
        Lobby
      </h1>
      <div
        className="mb-6 flex gap-2"
        role="tablist"
        aria-label="Lobby"
        onKeyDown={(e) => {
          // Roving tabindex: frecce spostano selezione e fuoco.
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          const next =
            TAB_IDS[(TAB_IDS.indexOf(tab) + dir + TAB_IDS.length) % TAB_IDS.length];
          setTab(next);
          tabRefs.current[TAB_IDS.indexOf(next)]?.focus();
        }}
      >
        <button
          ref={(el) => {
            tabRefs.current[0] = el;
          }}
          type="button"
          role="tab"
          id="tab-mine"
          aria-controls="panel-mine"
          aria-selected={tab === "mine"}
          tabIndex={tab === "mine" ? 0 : -1}
          onClick={() => setTab("mine")}
          className={`min-h-11 rounded-chip px-4 text-sm font-medium transition-colors ${
            tab === "mine"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          }`}
        >
          Le tue <span className="tabular-nums">{mine.length}</span>
        </button>
        <button
          ref={(el) => {
            tabRefs.current[1] = el;
          }}
          type="button"
          role="tab"
          id="tab-nearby"
          aria-controls="panel-nearby"
          aria-selected={tab === "nearby"}
          tabIndex={tab === "nearby" ? 0 : -1}
          onClick={() => setTab("nearby")}
          className={`min-h-11 rounded-chip px-4 text-sm font-medium transition-colors ${
            tab === "nearby"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          }`}
        >
          Vicine
          {nearbyCount != null && (
            <span className="tabular-nums"> {nearbyCount}</span>
          )}
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-mine"
        aria-labelledby="tab-mine"
        hidden={tab !== "mine"}
      >
        {tab === "mine" &&
          (mine.length > 0 ? (
            <ul className="space-y-3">
              {mine.map((lobby) => (
                <li key={lobby.id}>
                  <LobbyCard lobby={lobby} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center">
              <CalendarX
                className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Non hai lobby attive
              </h2>
              <p className="mx-auto mt-1 max-w-60 text-sm text-[var(--text-secondary)]">
                Creane una dal campo.
              </p>
              <Link
                href="/"
                className="mx-auto mt-3 flex min-h-11 w-full max-w-60 items-center justify-center rounded-control bg-[var(--accent)] px-4 font-semibold text-[var(--accent-foreground)]"
              >
                Trova un campo
              </Link>
            </div>
          ))}
      </div>

      <div
        role="tabpanel"
        id="panel-nearby"
        aria-labelledby="tab-nearby"
        hidden={tab !== "nearby"}
      >
        {tab === "nearby" && (
          <NearbyLobbies userId={userId} onCount={setNearbyCount} />
        )}
      </div>
    </>
  );
}
