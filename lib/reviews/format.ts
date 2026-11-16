/**
 * Seam puro delle recensioni (#34): formattazione e normalizzazione senza
 * DOM ne' Supabase, cosi' e' testabile con vitest senza browser.
 */

/** Recensioni per pagina: primo caricamento server + "Mostra altre". */
export const REVIEW_PAGE_SIZE = 5;

export interface ReviewItem {
  id: string;
  /** Autore: serve al confronto con l'utente corrente ("Tua"). */
  user_id: string;
  /** `profiles.nickname`: null quando il profilo non esiste ancora. */
  nickname: string | null;
  rating: number;
  body: string | null;
  created_at: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
}

/**
 * Media della view `court_rating_summary` in forma italiana: `4.5 -> "4,5"`.
 * `toFixed` invece di `toLocaleString`: la virgola non deve dipendere
 * dall'ICU del runtime (CI e browser devono produrre lo stesso testo).
 */
export function formatAverage(average: number | null | undefined): string {
  if (average == null || !Number.isFinite(average)) return "–";
  const clamped = Math.min(5, Math.max(0, average));
  return clamped.toFixed(1).replace(".", ",");
}

/** Etichetta del conteggio: 0 recensioni / 1 recensione / n recensioni. */
export function reviewCountLabel(count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n === 0) return "Nessuna recensione";
  if (n === 1) return "1 recensione";
  return `${n} recensioni`;
}

/**
 * Valutazione -> stelle 1..5, oppure null se il valore non e' utilizzabile.
 * `null` (non un clamp a 1) perche' "nessuna stella" e' uno stato reale del
 * form, mentre un DB fuori range non deve diventare 1 stella per sbaglio.
 */
export function clampRating(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

/**
 * Body del form -> valore da scrivere nel DB. Il check della 033 rifiuta la
 * stringa di soli spazi (`23514`): vuoto e spazi diventano NULL.
 */
export function bodyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}
