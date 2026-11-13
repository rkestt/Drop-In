/**
 * Helper puri per le segnalazioni campo (`court_reports`).
 *
 * Puri = nessuna query qui dentro: le query restano nei componenti/pagine,
 * qui solo filtro per `expires_at`, etichette di categoria e formattazione
 * della scadenza per la UI.
 */

import { formatAppDateTime } from "@/lib/datetime";

/** TTL di una segnalazione: 48 ore (stesso valore usato all'insert). */
export const REPORT_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * Etichette UI delle categorie. Le chiavi sono i valori esatti del CHECK
 * `category` in `supabase/migrations/001_initial_schema.sql`: non inventarne.
 */
export const REPORT_CATEGORY_LABELS: Record<string, string> = {
  broken_hoop: "Canestro rotto",
  wet_court: "Campo bagnato",
  lighting: "Illuminazione",
  occupied: "Occupato",
  other: "Altro",
};

/** Etichetta UI di una categoria; le sconosciute passano invariate (mai crash). */
export function categoryLabel(category: string): string {
  return REPORT_CATEGORY_LABELS[category] ?? category;
}

export interface ReportLike {
  expires_at: string | null;
  category: string;
  user_id?: string | null;
}

/** Attiva = `expires_at` nel futuro. Scaduta o senza scadenza = non attiva. */
export function isActiveReport(
  report: Pick<ReportLike, "expires_at">,
  now: Date | string = new Date(),
): boolean {
  if (!report.expires_at) return false;
  return new Date(report.expires_at).getTime() > new Date(now).getTime();
}

/** Solo le segnalazioni ancora attive, nell'ordine ricevuto. */
export function activeReports<T extends Pick<ReportLike, "expires_at">>(
  reports: T[],
  now: Date | string = new Date(),
): T[] {
  return reports.filter((r) => isActiveReport(r, now));
}

/** La segnalazione attiva dell'utente su questo campo, se esiste. */
export function findOwnActiveReport<
  T extends Pick<ReportLike, "expires_at" | "user_id">,
>(
  reports: T[],
  userId: string | null | undefined,
  now: Date | string = new Date(),
): T | undefined {
  if (!userId) return undefined;
  return reports.find((r) => r.user_id === userId && isActiveReport(r, now));
}

/**
 * Scadenza in formato UI: "16 nov, 19:40" (stesso della copy approvata d15).
 * Input ISO o Date; output sempre a Roma via `formatAppDateTime` (#78: un
 * `Intl` senza `timeZone` diverge tra server UTC e browser).
 */
export function formatReportExpiry(expiresAt: string | Date): string {
  return formatAppDateTime(expiresAt);
}

/** `expires_at` per una nuova segnalazione: ora + 48h, in ISO. */
export function reportExpiryFromNow(now: Date = new Date()): string {
  return new Date(now.getTime() + REPORT_TTL_MS).toISOString();
}
