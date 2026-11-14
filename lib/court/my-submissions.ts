// Le tue proposte (#58, esito + resubmit #47): mapping puro riga -> voce.
// Nessun DOM, nessuna fetch: unit-testabile in isolation.

import { sportDisplayLabel } from "@/lib/courts/search";

/**
 * Riga grezza di `courts` per le proposte proprie (sola lettura dal client:
 * la policy courts_select_all mostra al proponente anche pending e rejected).
 * `moderation_note` non e' una colonna di courts: arriva da
 * `court_submissions` (il client la unisce per court_id) ed e' valorizzata
 * solo sulle rejected.
 */
export interface MySubmissionRow {
  id: string;
  name: string;
  sport: string | null;
  surface_type: string | null;
  photo_path: string | null;
  created_at: string;
  moderation_status: string | null;
  moderation_note?: string | null;
}

/** Gli unici due stati che la query di MySubmissions chiede al DB. */
export type SubmissionStatus = "pending" | "rejected";

/** Riga pronta per la UI: etichette leggibili, niente logica di fetch. */
export interface MySubmissionItem {
  id: string;
  name: string;
  /** Valore grezzo (per il form di modifica); null = non specificato. */
  sport: string | null;
  /** Etichetta leggibile ("Basket", "Sport non specificato" quando null). */
  sportLabel: string;
  surface: string | null;
  photoPath: string | null;
  /** Data di invio formattata it-IT ("12 nov 2026"). */
  submittedLabel: string;
  /** Vera solo per le proposte ancora in attesa. */
  pending: boolean;
  /** Stato normalizzato (la query chiede solo pending/rejected). */
  status: SubmissionStatus;
  /** "In revisione" | "Rifiutata". */
  statusLabel: string;
  /** Nota del moderatore; null quando assente (sempre sulle pending). */
  moderationNote: string | null;
}

/**
 * Solo le proposte in attesa si possono modificare o ritirare: dopo
 * l'approvazione la riga e' pubblica e la foto si congela (014), dopo il
 * rifiuto resta solo la riproposizione (030).
 */
export function isPendingSubmission(
  moderationStatus: string | null | undefined
): boolean {
  return moderationStatus === "pending";
}

/** "pending" -> "In revisione", "rejected" -> "Rifiutata", altro -> "". */
export function submissionStatusLabel(
  moderationStatus: string | null | undefined
): string {
  if (moderationStatus === "pending") return "In revisione";
  if (moderationStatus === "rejected") return "Rifiutata";
  return "";
}

/**
 * Stati su cui il proprietario puo' ancora agire (modifica/ritiro): solo le
 * pending. Le rejected non si toccano, si ripropongono via resubmit.
 */
export function actionableSubmissionStatuses(): SubmissionStatus[] {
  return ["pending"];
}

/** Vera quando lo stato e' tra quelli azionabili (oggi: solo pending). */
export function isActionableSubmission(
  moderationStatus: string | null | undefined
): boolean {
  return (actionableSubmissionStatuses() as string[]).includes(
    moderationStatus ?? ""
  );
}

/** Riga grezza di `court_submissions` per le note di rifiuto (sola lettura:
 * la RLS mostra al proponente solo le proprie righe). */
export interface SubmissionNoteRow {
  court_id: string;
  moderation_note: string | null;
  status: string | null;
  created_at: string;
}

/**
 * Nota del rifiuto piu' recente per una corte, `null` se mai rifiutata con
 * nota. La cronologia puo' avere piu' righe `rejected` (rifiuto -> resubmit
 * -> nuovo rifiuto): vale l'ultima, le precedenti restano storia.
 */
export function latestRejectedNote(
  notes: SubmissionNoteRow[],
  courtId: string
): string | null {
  let best: { at: number; note: string } | null = null;
  for (const note of notes) {
    if (note.court_id !== courtId) continue;
    if (note.status !== "rejected" || note.moderation_note == null) continue;
    const at = new Date(note.created_at).getTime();
    if (Number.isNaN(at)) continue;
    if (best == null || at > best.at) best = { at, note: note.moderation_note };
  }
  return best?.note ?? null;
}

/**
 * Riga grezza -> voce da mostrare, oppure `null` quando lo stato non e' tra
 * quelli che la query chiede (`pending`/`rejected`): il chiamante scarta le
 * null, invece di spacciarle per "pending" (coercizione silenziosa).
 * Non inventa valori: i null restano null.
 */
export function mapMySubmission(row: MySubmissionRow): MySubmissionItem | null {
  if (
    row.moderation_status !== "pending" &&
    row.moderation_status !== "rejected"
  ) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    sport: row.sport ?? null,
    sportLabel: sportDisplayLabel(row.sport),
    surface: row.surface_type ?? null,
    photoPath: row.photo_path ?? null,
    submittedLabel: formatSubmissionDate(row.created_at),
    pending: isPendingSubmission(row.moderation_status),
    status: row.moderation_status === "rejected" ? "rejected" : "pending",
    statusLabel: submissionStatusLabel(row.moderation_status),
    moderationNote: row.moderation_note ?? null,
  };
}

/** "2026-11-12T…" -> "12 nov 2026". Stringa non valida -> "". */
export function formatSubmissionDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
