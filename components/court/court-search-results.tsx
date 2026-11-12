"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourtPhotoThumb } from "@/components/court/court-photo-thumb";
import { formatDistanceM } from "@/lib/lobbies/nearby";
import {
  SEARCH_RADIUS_M,
  sportDisplayLabel,
  venueTypeLabel,
  type Court,
  type SearchPhase,
} from "@/lib/courts/search";

const RADIUS_KM = SEARCH_RADIUS_M / 1000;

export interface CourtSearchResultsProps {
  /** Query mostrata all'utente (testo originale, solo trim). */
  query: string;
  phase: SearchPhase;
  results: Court[];
  onRetry: () => void;
  onClear: () => void;
}

/**
 * Risultati della ricerca per raggio (#68), subito sotto il box.
 *
 * Vive nel flusso della pagina, non sopra la mappa: a query vuota non è
 * renderizzato, quindi non ruba touch ai controlli della mappa. Righe intere
 * cliccabili (un solo focus stop) con miniatura, nome, distanza, sport e tipo
 * di luogo; touch target ≥ 44px e nessun overflow a 360px.
 */
export function CourtSearchResults({
  query,
  phase,
  results,
  onRetry,
  onClear,
}: CourtSearchResultsProps) {
  const titleId = "court-search-results-title";

  if (phase === "waiting" || phase === "loading") {
    return (
      <section aria-labelledby={titleId} aria-busy="true">
        <h2 id={titleId} className="sr-only">
          Risultati della ricerca
        </h2>
        <div className="space-y-2" aria-hidden="true">          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-shimmer rounded-card bg-[var(--bg-surface)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className="sr-only">
          Risultati della ricerca
        </h2>
        <div
          role="alert"
          className="rounded-card border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4"
        >
          <p className="text-sm font-semibold text-[var(--danger-dark)]">
            Non riusciamo a cercare i campi.
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Controlla la connessione e riprova.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={onRetry}
          >
            Riprova
          </Button>
        </div>
      </section>
    );
  }

  if (phase !== "ready" || results.length === 0) {
    return (
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className="sr-only">
          Risultati della ricerca
        </h2>
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
          <MapPin
            className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--text-secondary)]">
            Nessun campo per «{query}» entro {RADIUS_KM} km.
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Prova con un altro nome o sposta la mappa.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={onClear}
          >
            Cancella ricerca
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="sr-only">
        Risultati della ricerca
      </h2>
      <ul className="space-y-2">
        {results.map((court) => {
          const sports = sportDisplayLabel(court.sport);
          const venue = venueTypeLabel(court.venue_type);
          // Un'unica riga di metadati: il punto resta attaccato alla voce
          // precedente (NBSP) se il testo va a capo a 360px.
          const meta = [
            court.distance_m != null
              ? `a ${formatDistanceM(court.distance_m)}`
              : null,
            sports,
            venue,
          ].filter((part): part is string => part !== null);
          return (
            <li key={court.id}>
              <Link
                href={`/courts/${court.id}`}
                className="flex min-h-[44px] items-center gap-3 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <CourtPhotoThumb
                  photoPath={court.photo_path}
                  className="h-14 w-14"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[var(--text-primary)]">
                    {court.name}
                  </span>
                  {meta.length > 0 && (
                    <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                      {meta.join("\u00A0· ")}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
