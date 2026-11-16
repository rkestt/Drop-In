import { SPORTS, type SportFilter } from "@/lib/sport/sports";

/**
 * Le 7 discipline più "Tutti" (`null`), nello stesso ordine del
 * `SportSelector`: "Tutti" resta l'ultima opzione, come nel select.
 */
export const SPORT_CHIP_OPTIONS: { value: SportFilter; label: string }[] = [
  ...SPORTS,
  { value: null, label: "Tutti" },
];

/** Passo ciclico ±1 dentro la griglia (le frecce avvolgono ai bordi). */
export function nextChipIndex(
  current: number,
  dir: 1 | -1,
  length: number
): number {
  return (current + dir + length) % length;
}

/** `null` = "Tutti" viene serializzato come `"all"`. */
export function sportToStorage(sport: SportFilter): string {
  return sport === null ? "all" : sport;
}
