// Logica testabile della cancellazione account (#94, Lane B).
//
// `findBlockingLobbies` decide il 409 della route: blocca solo le lobby
// `open` non finite create da me con almeno un altro iscritto. "Non
// finita" = `ends_at > now` (038: in corso = start <= now <= ends):
// abbandonare una partita iniziata danneggia chi gioca. Finite, chiuse,
// in corso senza altri iscritti passano (la cascata le gestisce o restano
// congelate con creator NULL dalla 041). Se `ends_at` non e' leggibile
// si ripiega su `start_time > now`; se anche quello manca, passa.

export interface OwnedLobbyRow {
  id: string;
  start_time: string;
  ends_at: string | null;
  status: string | null;
}

export interface ParticipantRow {
  lobby_id: string;
  user_id: string;
}

// `isAlreadyDeletedError` decide il replay idempotente: se `deleteUser`
// fallisce perche' l'utente non esiste piu' (doppio invio concorrente: il
// secondo getUser passa prima della revoca, il secondo deleteUser no), la
// route risponde 200 invece di 500.

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
    const endMs = Date.parse(l.ends_at ?? "");
    let notFinished: boolean;
    if (Number.isFinite(endMs)) {
      notFinished = endMs > nowMs;
    } else {
      // Ripiego: `ends_at` e' generata (036) e non dovrebbe mai mancare.
      const startMs = Date.parse(l.start_time ?? "");
      notFinished = Number.isFinite(startMs) && startMs > nowMs;
    }
    if (!notFinished) return false;
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
