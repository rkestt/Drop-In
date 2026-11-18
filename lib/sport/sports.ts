export type Sport = "basketball" | "soccer" | "tennis" | "padel" | "futsal" | "volleyball" | "beach_volleyball" | "multi";
export type SportFilter = Sport | null; // null = "Tutti"

export const SPORTS: { value: Sport; label: string }[] = [
  { value: "basketball", label: "Basket" },
  { value: "soccer", label: "Calcio" },
  { value: "tennis", label: "Tennis" },
  { value: "padel", label: "Padel" },
  { value: "futsal", label: "Calcio a 5" },
  { value: "volleyball", label: "Pallavolo" },
  { value: "beach_volleyball", label: "Beach volley" },
  { value: "multi", label: "Polivalente" },
];

export const SPORT_STORAGE_KEY = "sport";

/**
 * Durata di default di una lobby per sport, in minuti (#96). Vive in
 * costante applicativa — non in un CHECK/enum/DB — perche' i valori si
 * ritoccano con i dati della beta senza migrazioni. Sport non elencato
 * (o ignoto) = 30', stessa semantica del DEFAULT del DB.
 */
export const DEFAULT_LOBBY_DURATION_MINUTES = 30;

const SPORT_DEFAULT_DURATION_MINUTES: Record<string, number> = {
  volleyball: 90,
  padel: 90,
  futsal: 60,
};

/** Durata di default (minuti) per lo sport della Lobby (`null` = 30'). */
export function defaultDurationForSport(sport: string | null): number {
  if (sport === null) return DEFAULT_LOBBY_DURATION_MINUTES;
  return SPORT_DEFAULT_DURATION_MINUTES[sport] ?? DEFAULT_LOBBY_DURATION_MINUTES;
}

/**
 * Sport del Campo se univoco (#96): un solo valore concreto, non `multi`,
 * non multi-valore (`;`), non NULL. Altrimenti `null` = lo sport della
 * Lobby va scelto nel drawer.
 */
export function uniqueCourtSport(courtSport: string | null): string | null {
  if (courtSport === null || courtSport === "multi") return null;
  const parts = courtSport
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length !== 1) return null;
  return parts[0];
}

/**
 * True quando la corte passa il filtro sport attivo.
 *
 * Semantica #71/#72: `sport IS NULL` significa "sport non specificato" ed e'
 * visibile con QUALUNQUE filtro (come `multi`). Default temporaneo in attesa
 * del backfill sport (#63); la UI lo dichiara con "Sport non specificato".
 */
export function sportMatches(courtSport: string | null, active: SportFilter): boolean {
  if (active === null) return true;
  if (courtSport === null) return true;
  if (courtSport === "multi") return true;
  return courtSport
    .split(";")
    .map((s) => s.trim())
    .includes(active);
}

export function toRpcSport(active: SportFilter): SportFilter {
  return active;
}

export function fromStorage(raw: string | null): SportFilter {
  if (raw === null) return "basketball";
  if (raw === "all" || raw === "null" || raw === "") return null;
  if (SPORTS.some((o) => o.value === raw)) return raw as Sport;
  return "basketball";
}

export function sportLabel(active: SportFilter): string {
  if (active === null) return "Tutti";
  const opt = SPORTS.find((o) => o.value === active);
  return opt ? opt.label : active;
}

/**
 * Frase per gli empty state di campi e lobby: "di basket", "da basket".
 * `multi` è un aggettivo ("polivalente"): senza preposizione, così la stessa
 * frase regge sia "Nessuna lobby polivalente" sia "Nessun campo polivalente"
 * (bug #65: "Nessuna lobby di polivalente").
 */
export function sportEmptyPhrase(
  active: Sport,
  prep: "di" | "da" = "di"
): string {
  if (active === "multi") return "polivalente";
  return `${prep} ${sportLabel(active).toLowerCase()}`;
}
