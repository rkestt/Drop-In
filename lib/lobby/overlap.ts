/**
 * Doppioni di lobby (#96): pre-check applicativo prima dell'INSERT.
 *
 * Nessun vincolo nel DB (la decisione del ticket scarta l'exclusion
 * constraint: bloccherebbe il "Crea comunque" richiesto). Il client legge le
 * lobby aperte (`status = 'open'`, #91: niente più `in_progress`) sullo
 * stesso Campo e sovrapposte nel tempo, e avvisa. Modulo puro: nessuna I/O,
 * così la semantica è testabile.
 *
 * Intervalli semiaperti `[inizio, fine)`, come `tstzrange`: una lobby che
 * finisce alle 20:00 e una che inizia alle 20:00 non si sovrappongono.
 */

const MINUTE_MS = 60_000;

/** Riga minima per il confronto: `open_lobbies`/select la espongono così. */
export interface LobbyOccupancy {
  start_time: string;
  /** Colonna generata `ends_at`: nei tipi generati è `string | null`. */
  ends_at: string | null;
  sport: string | null;
}

export interface LobbyCandidate {
  startTime: string | Date;
  durationMinutes: number;
  sport: string | null;
}

/**
 * Fine prevista (ISO) della lobby candidata.
 *
 * Solo anteprima e pre-check: `ends_at` nasce nel DB come colonna generata
 * (`036_lobby_duration_ends_at.sql`) e resta l'unica fonte per un salvataggio
 * già avvenuto. Qui serve perché la lobby non esiste ancora.
 */
export function lobbyEndsAtIso(
  startTime: string | Date,
  durationMinutes: number,
): string {
  return new Date(
    new Date(startTime).getTime() + durationMinutes * MINUTE_MS,
  ).toISOString();
}

/**
 * Sport compatibili per l'avviso: stesso sport, oppure ignoto da almeno un
 * lato. `lobbies.sport = NULL` significa "sport non specificato" (stessa
 * prudenza di #71): non si può escludere che le due partite siano lo stesso
 * gioco, quindi si avvisa. Sport diverso e noto da entrambi i lati: nessun
 * avviso (è la richiesta del ticket).
 */
export function lobbySportCompatible(
  candidate: string | null,
  existing: string | null,
): boolean {
  return candidate === null || existing === null || candidate === existing;
}

/**
 * Prima lobby sovrapposta (per `start_time`) compatibile per sport, o `null`.
 * Le righe con `ends_at` nullo sono ignorate: senza fine non c'è intervallo
 * da confrontare, e non deve scattare un avviso su un dato incompleto.
 */
export function findOverlappingLobby<T extends LobbyOccupancy>(
  lobbies: readonly T[],
  candidate: LobbyCandidate,
): T | null {
  const startMs = new Date(candidate.startTime).getTime();
  const endMs = startMs + candidate.durationMinutes * MINUTE_MS;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  let first: T | null = null;
  let firstMs = Number.POSITIVE_INFINITY;

  for (const lobby of lobbies) {
    if (lobby.ends_at === null) continue;
    if (!lobbySportCompatible(candidate.sport, lobby.sport)) continue;

    const lobbyStart = new Date(lobby.start_time).getTime();
    const lobbyEnd = new Date(lobby.ends_at).getTime();
    if (!Number.isFinite(lobbyStart) || !Number.isFinite(lobbyEnd)) continue;
    if (lobbyStart >= endMs || lobbyEnd <= startMs) continue;

    if (lobbyStart < firstMs) {
      first = lobby;
      firstMs = lobbyStart;
    }
  }

  return first;
}
