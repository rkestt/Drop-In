/**
 * Query del pannello di moderazione (#33). Un unico posto per select, filtri
 * e limiti, condiviso tra Server Component (primo render) e refetch client
 * dopo un'azione RPC. Gli errori non lanciano: tornano come flag `error`,
 * così la UI mostra uno stato di errore recuperabile invece di crashare.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  mapDedupCandidate,
  mapPendingCourt,
  toReportCourtGroups,
  type DedupCandidateItem,
  type DedupCandidateRow,
  type ModerationQueueItem,
  type PendingCourtRow,
  type ReportCourtGroup,
  type ReportCourtRow,
} from "./queue";

type ModerationClient = SupabaseClient<Database>;

/** Colonne della coda proposte: solo ciò che la riga mostra. */
export const PENDING_COURTS_SELECT =
  "id,name,sport,surface_type,photo_path,lat,lng,address,created_at";

/** Segnalazioni + nome campo (la RLS moderatore vede anche le pending). */
export const REPORTS_SELECT =
  "id,court_id,category,expires_at,created_at,courts(name)";

/** Tetto di sicurezza: il pannello non è un archivio storico. */
export const REPORTS_LIMIT = 100;

/** Tetto di sicurezza per la coda proposte (stesso ruolo di REPORTS_LIMIT). */
export const PENDING_COURTS_LIMIT = 200;

export interface QueueResult {
  items: ModerationQueueItem[];
  error: boolean;
}

export interface ReportGroupsResult {
  groups: ReportCourtGroup[];
  error: boolean;
}

export interface DedupResult {
  items: DedupCandidateItem[];
  error: boolean;
}

/** Coda proposte: pending più vecchie prima (FIFO). */
export async function fetchPendingCourts(
  supabase: ModerationClient,
  now: Date = new Date(),
): Promise<QueueResult> {
  try {
    const { data, error } = await supabase
      .from("courts")
      .select(PENDING_COURTS_SELECT)
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: true })
      // Tetto di sicurezza: il pannello e' una coda di lavoro, non un archivio.
      .limit(PENDING_COURTS_LIMIT);
    if (error) return { items: [], error: true };
    const rows = (data ?? []) as unknown as PendingCourtRow[];
    return { items: rows.map((row) => mapPendingCourt(row, now)), error: false };
  } catch {
    return { items: [], error: true };
  }
}

/** Segnalazioni attive raggruppate per campo, più recenti prima. */
export async function fetchActiveReportGroups(
  supabase: ModerationClient,
  now: Date = new Date(),
): Promise<ReportGroupsResult> {
  try {
    const { data, error } = await supabase
      .from("court_reports")
      .select(REPORTS_SELECT)
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(REPORTS_LIMIT);
    if (error) return { groups: [], error: true };
    const rows = (data ?? []) as unknown as ReportCourtRow[];
    return { groups: toReportCourtGroups(rows, now), error: false };
  } catch {
    return { groups: [], error: true };
  }
}

/** Possibili duplicati entro il raggio default della RPC (100 m). */
export async function fetchDedupCandidates(
  supabase: ModerationClient,
  lat: number,
  lng: number,
): Promise<DedupResult> {
  try {
    const { data, error } = await supabase.rpc("dedup_candidates", {
      p_lat: lat,
      p_lng: lng,
    });
    if (error) return { items: [], error: true };
    const rows = (data ?? []) as unknown as DedupCandidateRow[];
    return { items: rows.map(mapDedupCandidate), error: false };
  } catch {
    return { items: [], error: true };
  }
}
