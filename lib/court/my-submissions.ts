// Le tue proposte (#58): mapping puro riga -> voce da mostrare.
// Nessun DOM, nessuna fetch: unit-testabile in isolation.

import { sportDisplayLabel } from "@/lib/courts/search";

/**
 * Riga grezza di `courts` per le proposte proprie (sola lettura dal client:
 * la policy courts_select_all mostra al proponente anche le pending).
 */
export interface MySubmissionRow {
  id: string;
  name: string;
  sport: string | null;
  surface_type: string | null;
  photo_path: string | null;
  created_at: string;
  moderation_status: string | null;
}

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
}

/**
 * Solo le proposte in attesa si possono modificare o ritirare: dopo
 * l'approvazione la riga e' pubblica e la foto si congela (014).
 */
export function isPendingSubmission(
  moderationStatus: string | null | undefined
): boolean {
  return moderationStatus === "pending";
}

/** Riga grezza -> voce da mostrare. Non inventa valori: i null restano null. */
export function mapMySubmission(row: MySubmissionRow): MySubmissionItem {
  return {
    id: row.id,
    name: row.name,
    sport: row.sport ?? null,
    sportLabel: sportDisplayLabel(row.sport),
    surface: row.surface_type ?? null,
    photoPath: row.photo_path ?? null,
    submittedLabel: formatSubmissionDate(row.created_at),
    pending: isPendingSubmission(row.moderation_status),
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
