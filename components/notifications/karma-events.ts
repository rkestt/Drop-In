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

const DEFAULT_KARMA = 90;

/** Traduce un update della riga `profiles` in eventi toast. Puro: testabile. */
export function profileChangeEvents(
  oldProfile: ProfileKarmaState,
  newProfile: ProfileKarmaState
): KarmaEvent[] {
  const events: KarmaEvent[] = [];

  const oldKarma = oldProfile.karma_score ?? DEFAULT_KARMA;
  const newKarma = newProfile.karma_score ?? oldKarma;
  const oldBan = oldProfile.banned_until ?? null;
  const newBan = newProfile.banned_until ?? null;

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

  if (!oldBan && newBan) {
    events.push({
      id: `ban-${newBan}`,
      kind: "ban_applied",
      title: `Sei stato bannato fino al ${new Date(newBan).toLocaleString("it-IT")}`,
      description: "Fino a quella data non potrai unirti alle lobby.",
    });
  }

  return events;
}
