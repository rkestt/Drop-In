/**
 * Tipi condivisi della lane server Serie (#92), per la lane UI.
 *
 * Modulo puro: solo tipi, nessuna I/O, nessuna direttiva (importabile sia
 * dai Server Component che dai Client Component).
 */

import type { Database } from "@/lib/supabase/database.types";

/** Riga `lobby_series` così come la genera `npm run types` (044). */
export type SeriesRow = Database["public"]["Tables"]["lobby_series"]["Row"];

/** Riga `lobbies` (le Occorrenze sono lobby normali con `series_id`). */
export type LobbyRow = Database["public"]["Tables"]["lobbies"]["Row"];

/**
 * Serie con la prossima Occorrenza già letta dalle righe `lobbies` reali:
 * la lista "le mie serie" la mostra senza ricalcoli in UI. `null` solo
 * quando non c'è nessuna occorrenza `open` futura (serie in pausa, campo
 * non attivo, cron non ancora passato); `confirmedCount` 0 è il caso
 * normale di un'occorrenza appena generata, non un errore.
 */
export interface SeriesWithNextOccurrence extends SeriesRow {
  nextOccurrence: string | null;
  /** Id dell'occorrenza di `nextOccurrence`: il link "Apri la partita". */
  nextOccurrenceId: string | null;
  /** Conferme sull'occorrenza (`lobby_participants` di quella lobby). */
  confirmedCount: number;
}

/** Prossima occorrenza come la legge `fetchNextOccurrenceMap` (una riga). */
export interface NextOccurrenceInfo {
  id: string;
  startTime: string;
  confirmedCount: number;
}

/**
 * Riga + prossima occorrenza → forma per la UI (unico punto di forma,
 * modulo puro e testabile).
 */
export function toSeriesWithNextOccurrence(
  row: SeriesRow,
  next: NextOccurrenceInfo | null | undefined,
): SeriesWithNextOccurrence {
  return {
    ...row,
    nextOccurrence: next?.startTime ?? null,
    nextOccurrenceId: next?.id ?? null,
    confirmedCount: next?.confirmedCount ?? 0,
  };
}

/**
 * Occorrenza come la mostra la UI: sottoinsieme stabile della riga `lobbies`
 * (niente `creator_id`/`created_at`: alla UI non servono).
 */
export interface SeriesOccurrence {
  id: string;
  seriesId: string;
  courtId: string;
  startTime: string;
  /** Colonna generata (036): nei tipi è `string | null`. */
  endsAt: string | null;
  status: string | null;
  maxPlayers: number;
  sport: string | null;
  durationMinutes: number;
}

/** Proiezione riga `lobbies` → `SeriesOccurrence` (unico punto di forma). */
export function toSeriesOccurrence(row: LobbyRow): SeriesOccurrence {
  return {
    id: row.id,
    seriesId: row.series_id ?? "",
    courtId: row.court_id,
    startTime: row.start_time,
    endsAt: row.ends_at,
    status: row.status,
    maxPlayers: row.max_players,
    sport: row.sport,
    durationMinutes: row.duration_minutes,
  };
}
