"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  readBadgePreference,
  writeBadgePreference,
} from "@/lib/settings/preferences";

/**
 * "Notifiche" section: in-app alerts link + unread-dot switch (persisted in
 * localStorage, applied to a bell badge via `dropin:badge-pref` event).
 * Push row is intentionally non-interactive with an explanation — no fake
 * switch, and `Notification.requestPermission()` is never called.
 */
export function NotificationsSection() {
  // `true` until mount so server and client render the same markup;
  // the stored value is applied in an effect (no flash of wrong state
  // matters here, and hydration stays consistent).
  const [enabled, setEnabled] = useState(true);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    setEnabled(readBadgePreference(true));
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    writeBadgePreference(next);
    const message = next
      ? "Pallino degli avvisi attivo"
      : "Pallino degli avvisi spento";
    setLiveMessage(message);
    toast.success(message);
  };

  return (
    <section aria-labelledby="settings-notifiche">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
        <h2
          id="settings-notifiche"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          Notifiche
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="mt-2 rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
        <Link
          href="/notifications"
          className="flex min-h-[56px] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-semibold text-[var(--text-primary)]">
              Avvisi nell’app
            </span>
            <span className="text-sm text-[var(--text-muted)]">
              Le novità su campi, lobby e check-in.
            </span>
          </span>
          <ChevronRight
            className="w-5 h-5 flex-none text-[var(--text-muted)]"
            aria-hidden="true"
          />
        </Link>

        <div
          aria-hidden="true"
          className="mx-4 h-px bg-[var(--border)]"
        />

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Pallino degli avvisi non letti"
          onClick={toggle}
          className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-semibold text-[var(--text-primary)]">
              Pallino degli avvisi non letti
            </span>
            <span className="text-sm text-[var(--text-muted)]">
              Un punto sulla campanella quando c’è qualcosa di nuovo.
            </span>
          </span>
          <span className="flex flex-none flex-col items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`flex h-6 w-11 items-center rounded-chip border px-0.5 motion-safe:transition-colors ${
                enabled
                  ? "justify-end border-[var(--accent)] bg-[var(--accent)]"
                  : "justify-start border-[var(--text-muted)]/40 bg-[var(--bg-base)]"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-chip motion-safe:transition-colors ${
                  enabled
                    ? "bg-[var(--accent-foreground)]"
                    : "bg-[var(--text-muted)]"
                }`}
              />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {enabled ? "Attivo" : "Spento"}
            </span>
          </span>
        </button>

        <div
          aria-hidden="true"
          className="mx-4 h-px bg-[var(--border)]"
        />

        <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-semibold text-[var(--text-secondary)]">
              Notifiche push
            </span>
            <span className="text-sm text-[var(--text-muted)]">
              Non disponibili in questa versione: richiedono l’invio dal
              server.
            </span>
            <span className="mt-1 rounded-control-sm bg-[var(--bg-base)] px-2.5 py-2 text-[13px] leading-snug text-[var(--text-secondary)]">
              Per ora non chiediamo il permesso del telefono: non avremmo
              niente da inviarti.
            </span>
          </span>
          <Lock
            className="w-4 h-4 flex-none text-[var(--text-muted)]"
            aria-hidden="true"
          />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
    </section>
  );
}
