/**
 * Fase di una Lobby vista dal client (#91): `status` ha due soli valori,
 * `open` e `closed`, e "in corso" non si scrive più da nessuna parte — si
 * deriva dall'orologio e da `ends_at` (colonna generata dalla 036).
 *
 * Modulo puro, `now` iniettabile: i test non dipendono dall'ora reale.
 */

/** Le tre fasi che la UI mostra: due di stato, una derivata dal tempo. */
export type LobbyPhase = "open" | "in_progress" | "closed";

export interface LobbyPhaseInput {
  /** `lobbies.status`: `open` | `closed` (`null` = riga malformata). */
  status: string | null;
  start_time: string;
  /** Colonna generata: nei tipi è `string | null`, alla UI arriva valorizzata. */
  ends_at: string | null;
}

/**
 * `in_progress` = `status = 'open'` e `now` dentro `[start_time, ends_at)`.
 *
 * Intervallo semiaperto come `tstzrange` e come l'avviso doppioni: alle
 * 20:00 in punto una lobby che finisce alle 20:00 non è più "in corso".
 *
 * Oltre la fine, con `status` ancora `open` (il cron `auto_close_lobbies`
 * non è ancora passato), la fase resta `open`: la UI dice lo stato che il DB
 * ha davvero, senza anticipare una chiusura che non è ancora avvenuta.
 * Dati incompleti (`ends_at` nullo, date invalide) → solo lo stato del DB.
 */
export function lobbyPhase(
  lobby: LobbyPhaseInput,
  now: Date | number | string = Date.now(),
): LobbyPhase {
  if (lobby.status !== "open") return "closed";

  const start = new Date(lobby.start_time).getTime();
  const end = lobby.ends_at === null ? Number.NaN : new Date(lobby.ends_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "open";

  const at = typeof now === "number" ? now : new Date(now).getTime();
  if (!Number.isFinite(at)) return "open";
  if (at < start || at >= end) return "open";
  return "in_progress";
}
