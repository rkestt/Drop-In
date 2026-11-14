"use client";

import * as React from "react";
import { ChevronRight, X } from "lucide-react";
import {
  COURT_LIST_LIMIT,
  courtsForList,
  type CourtMarkerInput,
} from "@/lib/map/court-features";

interface MapCourtListProps {
  /** Ordinati e limitati qui: il chiamante passa tutti i campi visibili. */
  courts: ReadonlyArray<CourtMarkerInput>;
  selectedId?: string | null;
  onSelect: (courtId: string) => void;
  onClose: () => void;
}

/**
 * Lista accessibile dei campi visibili (#44).
 *
 * Alternativa leggibile ai punti sulla mappa: un solo ingresso da tastiera
 * ("Lista campi"), poi una lista di bottoni con ordine alfabetico e tetto di
 * 30 voci. E' un dialog NON modale: niente focus trap, Tab esce e torna alla
 * pagina; Escape chiude e il focus torna al bottone che l'ha aperta (lo fa il
 * chiamante). Nessun punto della mappa e' piu' un tab stop.
 */
export function MapCourtList({
  courts,
  selectedId = null,
  onSelect,
  onClose,
}: MapCourtListProps) {
  const titleId = React.useId();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const firstItemRef = React.useRef<HTMLButtonElement>(null);
  const items = React.useMemo(() => courtsForList(courts), [courts]);
  const total = courts.length;

  // Solo all'apertura: i refetch successivi (pan, ricerca) non devono mai
  // rubare il focus all'utente. Deps vuote di proposito.
  React.useEffect(() => {
    // Prima voce subito raggiungibile; lista vuota → focus sul Chiudi.
    if (items.length > 0) firstItemRef.current?.focus();
    else closeRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      className="absolute inset-x-3 top-3 bottom-20 z-30 flex flex-col overflow-hidden rounded-card border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-sm font-semibold text-[var(--text-primary)]"
          >
            Lista campi
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {total === 0
              ? "Nessun campo visibile"
              : total > COURT_LIST_LIMIT
                ? `${COURT_LIST_LIMIT} di ${total} campi, in ordine alfabetico`
                : `${total} ${total === 1 ? "campo" : "campi"}, in ordine alfabetico`}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Chiudi la lista dei campi"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          Sposta la mappa o allarga la zona: la lista si aggiorna con i campi
          che entrano nell&apos;inquadratura.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.map((court, index) => {
            const selected = court.id === selectedId;
            return (
              <li key={court.id}>
                <button
                  type="button"
                  ref={index === 0 ? firstItemRef : undefined}
                  onClick={() => onSelect(court.id)}
                  aria-current={selected ? "true" : undefined}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-control px-2 py-2 text-left hover:bg-[var(--bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                      {court.name}
                    </span>
                    {court.address && (
                      <span className="block truncate text-xs text-[var(--text-secondary)]">
                        {court.address}
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
