import { Repeat } from "lucide-react";
import { seriesWeekdayLabel } from "@/lib/series/next-occurrence";

/**
 * Chip "Ricorrente · giovedì 20:00" (#92, superficie 3): informativo, non un
 * bottone né un `Badge` (la ricorrenza è un dato, non uno stato; il maiuscolo
 * del Badge occuperebbe ~180px e competerebbe col badge di stato).
 *
 * Modulo senza direttiva: lo importano sia Client Component (card, dettaglio)
 * sia, in futuro, Server Component.
 */
export interface RecurringChipSeries {
  /** Giorno ISO 1–7 (`null` = illeggibile: chip ridotto a "Ricorrente"). */
  weekday: number | null;
  /** `time_of_day` del DB (`HH:MM:SS`); `null` = chip ridotto. */
  timeOfDay: string | null;
}

/**
 * `HH:MM:SS` (o `HH:MM`) → `HH:MM` per pura manipolazione di stringa: l'ora
 * della serie è già parete di Roma, nessun `Date` e nessun fuso del device.
 */
function seriesTimeHHMM(raw: string | null): string | null {
  if (!raw) return null;
  const match = /^(\d{2}):(\d{2})/.exec(raw.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

export function RecurringChip({ weekday, timeOfDay }: RecurringChipSeries) {
  const day = weekday !== null ? seriesWeekdayLabel(weekday) : null;
  const time = seriesTimeHHMM(timeOfDay);
  const label =
    day !== null && time !== null
      ? `Ricorrente · ${day} ${time}`
      : "Ricorrente";
  return (
    <span className="inline-flex items-center gap-1 self-start whitespace-nowrap rounded-chip border border-[var(--border-strong)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
      <Repeat className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
