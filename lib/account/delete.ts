// Logica testabile della cancellazione account (#94, Lane B).
//
// `findBlockingLobbies` decide il 409 della route: blocca solo le lobby
// future `open` create da me con almeno un altro iscritto. Passate, chiuse,
// in corso e future senza altri iscritti passano (la cascata le gestisce:
// le passate spariscono con me, le future senza iscritti restano congelate
// con creator NULL dalla 041).
//
// `isAlreadyDeletedError` decide il replay idempotente: se `deleteUser`
// fallisce perche' l'utente non esiste piu' (doppio invio concorrente: il
// secondo getUser passa prima della revoca, il secondo deleteUser no), la
// route risponde 200 invece di 500.

export interface OwnedLobbyRow {
  id: string;
  start_time: string;
  status: string | null;
}

export interface ParticipantRow {
  lobby_id: string;
  user_id: string;
}

export function findBlockingLobbies(
  lobbies: OwnedLobbyRow[],
  participants: ParticipantRow[],
  selfId: string,
  now: Date = new Date()
): OwnedLobbyRow[] {
  const nowMs = now.getTime();
  const withOthers = new Set<string>();
  for (const p of participants) {
    if (p.user_id !== selfId) withOthers.add(p.lobby_id);
  }
  return lobbies.filter((l) => {
    if (l.status !== "open") return false;
    const startMs = Date.parse(l.start_time);
    if (!Number.isFinite(startMs) || startMs <= nowMs) return false;
    return withOthers.has(l.id);
  });
}

export function isAlreadyDeletedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  if (e["status"] === 404) return true;
  const code = e["code"];
  return (
    typeof code === "string" && code.toLowerCase().includes("not_found")
  );
}
