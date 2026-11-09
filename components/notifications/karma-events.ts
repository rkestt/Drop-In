export interface ProfileKarmaState {
  karma_score?: number;
  banned_until?: string | null;
}

export interface KarmaEvent {
  /** Id stabile: stesso evento → stesso id → Sonner sostituisce, non duplica. */
  id: string;
  kind: "karma_drop" | "karma_recovery" | "ban_applied";
  title: string;
  description: string;
}

/** Traduce un update della riga `profiles` in eventi toast. Puro: testabile. */
export function profileChangeEvents(
  oldProfile: ProfileKarmaState,
  newProfile: ProfileKarmaState
): KarmaEvent[] {
  const events: KarmaEvent[] = [];

  const oldKarma = oldProfile.karma_score;
  const newKarma = newProfile.karma_score;
  const oldBan = oldProfile.banned_until ?? null;
  const newBan = newProfile.banned_until ?? null;

  // Senza REPLICA IDENTITY FULL payload.old è vuoto (solo PK): senza il
  // valore precedente non si possono stabilire né direzione né delta, quindi
  // nessun evento karma — meglio il silenzio che un testo sbagliato.
  // Vedi migration 015_profiles_realtime_full.sql.
  if (typeof oldKarma === "number" && typeof newKarma === "number") {
    if (newKarma < oldKarma) {
      const diff = oldKarma - newKarma;
      events.push({
        id: `karma-${newKarma}`,
        kind: "karma_drop",
        title: `Hai perso ${diff} punto${diff > 1 ? "i" : ""} Karma (${newKarma})`,
        description: "Hai saltato una lobby. Partecipa alle prossime per recuperare.",
      });
    } else if (newKarma > oldKarma) {
      const diff = newKarma - oldKarma;
      events.push({
        id: `karma-${newKarma}`,
        kind: "karma_recovery",
        title: `Karma +${diff} (${newKarma})`,
        description: "Continua così: partecipa alle lobby per tenerlo alto.",
      });
    }
  }

  if (!oldBan && newBan) {
    events.push({
      id: `ban-${newBan}`,
      kind: "ban_applied",
      title: `Sei stato bannato fino al ${new Date(newBan).toLocaleString("it-IT")}`,
      description: "Fino a quella data non potrai unirti alle lobby.",
    });
  }

  // Ordine crescente di severità: con visibleToasts={1} l'ultimo toast
  // sostituisce il precedente, così il ban (più grave) resta visibile.
  return events;
}
