"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { APP_TIME_ZONE, appDateKey } from "@/lib/datetime";
import { seriesWeekdayLabel } from "@/lib/series/next-occurrence";
import { sportDisplayLabel } from "@/lib/courts/search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SeriesListItem } from "./types";

/**
 * Riga di "Le mie serie" (#92, superficie 2): nome campo + switch, regola,
 * prossima occorrenza, azioni. La conferma di cancellazione è inline nella
 * card (mai un drawer per una conferma), col focus sul contenitore.
 */
export function SeriesCard({
  item,
  orphan = false,
  busy = false,
  externalError = null,
  onToggle,
  onStop,
}: {
  item: SeriesListItem;
  /** Orfana (creatore senza account): niente switch, solo "Ferma la serie". */
  orphan?: boolean;
  /** Toggle in corso: switch disabilitato + riga in `aria-busy`. */
  busy?: boolean;
  /** Errore dal padre (dopo un rollback ottimistico), `role="alert"`. */
  externalError?: string | null;
  /** Pausa/riattiva (solo non orfane). */
  onToggle: (item: SeriesListItem) => void;
  /** Cancella (mie) o ferma (orfane), dopo la conferma inline. */
  onStop: (item: SeriesListItem) => void;
}) {
  const dayLabel = seriesWeekdayLabel(item.weekday);
  const timeLabel = hhmm(item.time_of_day);
  const ruleLabel =
    dayLabel !== null && timeLabel !== null
      ? `Ogni ${dayLabel} alle ${timeLabel}`
      : "Ogni settimana";
  const switchLabel = `Serie del ${item.courtName}, ogni ${dayLabel ?? "settimana"} alle ${timeLabel ?? "--:--"}`;
  const deleteLabel = orphan
    ? `Ferma la serie del ${dayLabel ?? "settimana"} al ${item.courtName}`
    : `Cancella la serie del ${dayLabel ?? "settimana"} al ${item.courtName}`;

  return (
    <li
      aria-busy={busy || undefined}
      className="flex flex-col gap-2.5 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-base font-semibold leading-snug text-[var(--text-primary)]">
            {item.courtName}
          </p>
          <p className="text-[13px] text-[var(--text-muted)]">
            {sportDisplayLabel(item.sport)} · {item.duration_minutes} min
          </p>
        </div>
        {/* #92 decisione 4: l'orfana non ha switch (kill-switch irreversibile:
            un interruttore che non si riaccende è una trappola). */}
        {orphan ? null : (
          <button
            type="button"
            role="switch"
            aria-checked={item.active}
            aria-label={switchLabel}
            disabled={busy}
            onClick={() => onToggle(item)}
            className="flex min-h-[44px] min-w-[44px] flex-none cursor-pointer items-center justify-center rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className={`flex h-7 w-12 items-center rounded-chip border px-0.5 motion-safe:transition-colors ${
                item.active
                  ? "justify-end border-[var(--accent)] bg-[var(--accent)]"
                  : "justify-start border-[var(--text-muted)]/40 bg-[var(--bg-base)]"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-chip ${
                  item.active
                    ? "bg-[var(--accent-foreground)]"
                    : "bg-[var(--text-muted)]"
                }`}
              />
            </span>
          </button>
        )}
      </div>

      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <Repeat className="h-3.5 w-3.5 flex-none text-[var(--text-secondary)]" aria-hidden="true" />
        {ruleLabel}
        {!item.active && !orphan ? <Badge variant="default">In pausa</Badge> : null}
      </p>

      {item.nextOccurrence ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {nextLine(item)}
        </p>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">
          Nessuna partita in programma.
        </p>
      )}
      {!item.active && !orphan ? (
        <p className="text-[13px] text-[var(--text-secondary)]">
          Nessuna nuova partita finché non la riattivi.
        </p>
      ) : null}
      {!item.courtActive ? (
        <p className="text-[13px] text-[var(--text-secondary)]">
          Il campo non è attivo: non creiamo nuove partite.
        </p>
      ) : null}
      {orphan ? (
        <p className="text-[13px] text-[var(--text-secondary)]">
          Chi ha creato la serie non ha più un account. Puoi fermarla: le
          partite già in programma restano.
        </p>
      ) : null}

      {externalError ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {externalError}
        </p>
      ) : null}

      <SeriesActions
        item={item}
        orphan={orphan}
        busy={busy}
        deleteLabel={deleteLabel}
        onStop={onStop}
      />
    </li>
  );
}

/** Azioni della riga: link + distruttiva, o conferma inline al suo posto. */
function SeriesActions({
  item,
  orphan,
  busy,
  deleteLabel,
  onStop,
}: {
  item: SeriesListItem;
  orphan: boolean;
  busy: boolean;
  deleteLabel: string;
  onStop: (item: SeriesListItem) => void;
}) {
  // Conferma inline (#92 decisione 7, come "Esci dalla lobby"): il
  // contenitore riceve il focus all'apertura, il bottone sparisce.
  // Alla cancellazione ("Lascia attiva") il focus torna al trigger, che
  // viene rimontato: senza, resterebbe sul body (contratto di spec,
  // ordine di tabulazione switch → link → "Cancella serie").
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef(false);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (!confirming && returnFocusRef.current) {
      returnFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [confirming]);

  const hasNext = item.nextOccurrenceId !== null;
  const linkHref = hasNext
    ? `/lobbies/${item.nextOccurrenceId as string}`
    : `/courts/${item.court_id}`;
  const linkLabel = hasNext ? "Apri la partita" : "Apri il campo";

  if (confirming) {
    return (
      <div
        ref={confirmRef}
        tabIndex={-1}
        role="group"
        aria-label={
          orphan
            ? "Conferma chiusura della serie"
            : "Conferma cancellazione della serie"
        }
        className="flex flex-col gap-2.5 rounded-control border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 focus:outline-none"
      >
        <p className="text-sm text-[var(--text-secondary)]">
          {orphan
            ? "Fermiamo la serie: non verranno create altre partite. Quelle già in programma restano."
            : "Cancelliamo la serie: non creeremo altre partite. Quelle già in programma restano, con chi si è già confermato."}
        </p>
        <Button
          type="button"
          variant="danger"
          className="min-h-[44px] w-full"
          disabled={busy}
          onClick={() => {
            setConfirming(false);
            onStop(item);
          }}
        >
          {orphan ? "Sì, ferma la serie" : "Sì, cancella la serie"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px] w-full"
          disabled={busy}
          onClick={() => {
            // Il trigger viene rimontato: il focus va riportato lì con un
            // effetto post-render, non qui (il nodo non esiste ancora).
            returnFocusRef.current = true;
            setConfirming(false);
          }}
        >
          Lascia attiva
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link
        href={linkHref}
        className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
      >
        {linkLabel} <span aria-hidden="true">›</span>
      </Link>
      <button
        type="button"
        ref={triggerRef}
        aria-label={deleteLabel}
        disabled={busy}
        onClick={() => setConfirming(true)}
        className="ms-auto flex min-h-[44px] items-center text-sm font-semibold text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {orphan ? "Ferma la serie" : "Cancella serie"}
      </button>
    </div>
  );
}

/** `HH:MM:SS` (colonna `TIME`) → `HH:MM`, mai via `Date` (parete di Roma). */
function hhmm(raw: string | null): string | null {
  if (!raw) return null;
  const match = /^(\d{2}):(\d{2})/.exec(raw.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

/** "19 novembre" nel fuso dell'app (mai il fuso del device). */
function monthDay(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(iso));
}

/**
 * "Prossima: … · n/max confermati" (#92: 0 confermati è il caso normale di
 * un'occorrenza appena generata, non un errore; singolare a 1; "al completo"
 * quando piena; "oggi" quando la prossima è oggi).
 */
function nextLine(item: SeriesListItem): string {
  if (!item.nextOccurrence) return "Nessuna partita in programma.";
  const date =
    appDateKey(item.nextOccurrence) === appDateKey(Date.now())
      ? "oggi"
      : monthDay(item.nextOccurrence);
  const count = `${item.confirmedCount}/${item.max_players}`;
  if (item.confirmedCount >= item.max_players) {
    return `Prossima: ${date} · ${count}, al completo`;
  }
  const unit = item.confirmedCount === 1 ? "confermato" : "confermati";
  return `Prossima: ${date} · ${count} ${unit}`;
}
