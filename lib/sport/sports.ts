export type Sport = "basketball" | "soccer" | "tennis" | "padel" | "futsal" | "volleyball" | "multi";
export type SportFilter = Sport | null; // null = "Tutti"

export const SPORTS: { value: Sport; label: string }[] = [
  { value: "basketball", label: "Basket" },
  { value: "soccer", label: "Calcio" },
  { value: "tennis", label: "Tennis" },
  { value: "padel", label: "Padel" },
  { value: "futsal", label: "Calcio a 5" },
  { value: "volleyball", label: "Pallavolo" },
  { value: "multi", label: "Polivalente" },
];

export const SPORT_STORAGE_KEY = "sport";

export function sportMatches(courtSport: string | null, active: SportFilter): boolean {
  if (active === null) return true;
  if (courtSport === null) return false;
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
