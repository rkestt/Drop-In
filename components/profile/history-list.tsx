"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, TrendingDown } from "lucide-react";
import {
  formatHistoryDate,
  historySummary,
  type HistoryEntry,
} from "@/lib/profile/history";

/** Prime voci visibili; oltre questa soglia compare "Mostra altri". */
const VISIBLE_FIRST = 10;

/**
 * Storico del profilo: check-in + eventi karma, dati gia' pronti da props.
 * Solo il toggle "Mostra altri" e' client; nessun fetch qui dentro.
 * Stile specchiato a KarmaPanel (card) e alle righe home (icone + meta).
 */
export function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const summary = historySummary(entries);

  if (entries.length === 0) {
    return (
      <section
        aria-labelledby="profile-history-title"
        className="rounded-card bg-[var(--bg-surface)] p-5"
      >
        <h2 id="profile-history-title" className="text-base font-semibold m-0">
          Attività recente
        </h2>
        <div className="text-center py-8">
          <MapPin
            className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2"
            aria-hidden="true"
          />
          <p className="text-[var(--text-muted)] text-sm m-0">
            Ancora nessun check-in. Quando fai check-in a un campo lo trovi
            qui.
          </p>
          <Link
            href="/"
            className="inline-flex items-center min-h-[44px] mt-1 px-2 text-sm font-semibold text-[var(--accent)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:rounded-control-sm"
          >
            Apri la mappa
          </Link>
        </div>
      </section>
    );
  }

  const visible = expanded ? entries : entries.slice(0, VISIBLE_FIRST);
  const hidden = entries.length - visible.length;

  return (
    <section
      aria-labelledby="profile-history-title"
      className="rounded-card bg-[var(--bg-surface)] p-5"
    >
      <h2 id="profile-history-title" className="text-base font-semibold m-0">
        Attività recente
      </h2>
      <p className="m-0 mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
        {summary.checkIns} check-in · {summary.karmaEvents} eventi karma
      </p>
      <ul className="m-0 mt-2 p-0 list-none divide-y divide-[var(--border)]">
        {visible.map((entry) => {
          const isCheckIn = entry.kind === "checkin";
          const title = isCheckIn ? entry.courtName : entry.label;
          const date = formatHistoryDate(
            isCheckIn ? entry.checkedInAt : entry.at
          );
          const active = isCheckIn && entry.status === "active";
          return (
            <li
              key={`${entry.kind}:${entry.id}`}
              className="flex items-center gap-3 min-h-[56px] py-2.5"
            >
              <span
                aria-hidden="true"
                className={
                  isCheckIn
                    ? "inline-flex items-center justify-center w-[34px] h-[34px] shrink-0 rounded-control-sm bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                    : "inline-flex items-center justify-center w-[34px] h-[34px] shrink-0 rounded-control-sm bg-[var(--danger)]/10 text-[var(--danger)]"
                }
              >
                {isCheckIn ? (
                  <MapPin className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="m-0 truncate text-base font-medium text-[var(--text-primary)]">
                  {title}
                </p>
                <p className="m-0 mt-0.5 text-[13px] text-[var(--text-muted)]">
                  {date}
                </p>
              </div>
              {active && (
                <span className="shrink-0 rounded-chip bg-[var(--accent-subtle)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                  In corso
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={expanded}
          className="mt-2 min-h-[44px] w-full rounded-control border border-[var(--border-strong)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          Mostra altri ({hidden})
        </button>
      )}
    </section>
  );
}
