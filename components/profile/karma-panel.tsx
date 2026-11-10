import { cn } from "@/lib/utils";

interface KarmaPanelProps {
  score: number;
  /** Variante danger (banner + barra) quando il ban è attivo. */
  banned: boolean;
}

const KARMA_MAX = 100;
const BAN_THRESHOLD = 50;

/**
 * Karma hero: numero Syne, barra decorativa verso 100 con soglia al 50,
 * riga che spiega guadagno/perdita. Annuncio screen reader come testo.
 */
export function KarmaPanel({ score, banned }: KarmaPanelProps) {
  const clamped = Math.max(0, Math.min(KARMA_MAX, score));

  return (
    <section
      aria-label="Karma"
      className={
        banned
          ? "rounded-card border-t-[3px] border-t-[var(--danger)] bg-[var(--bg-surface)] p-5"
          : "rounded-card border-t-[3px] border-t-[var(--accent)] bg-[var(--bg-surface)] p-5"
      }
    >
      <div className="flex flex-col gap-2.5">
        <p aria-hidden="true" className="text-label uppercase tracking-wider font-semibold text-[var(--text-muted)]">
          Karma
        </p>
        <p className="flex items-baseline gap-2 m-0">
          <span aria-hidden="true" className="font-display text-display-lg font-bold tabular-nums leading-none">
            {clamped}
          </span>
          <span aria-hidden="true" className="font-display text-sm text-[var(--text-muted)] tabular-nums">
            / {KARMA_MAX}
          </span>
          <span className="sr-only">Karma: {clamped} su {KARMA_MAX}.</span>
        </p>
        <div
          aria-hidden="true"
          className="relative h-[10px] overflow-hidden rounded-chip bg-[var(--bg-elevated)]"
        >
          <span
            className={cn(
              "block h-full rounded-[inherit]",
              banned ? "bg-[var(--danger)]" : "bg-[var(--accent)]"
            )}
            style={{ width: `${clamped}%` }}
          />
          <span className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-[var(--bg-base)]" />
        </div>
        <p className="m-0 text-[13px] leading-snug text-[var(--text-muted)]">
          +1 a ogni check-in, −3 se salti una lobby. Sotto {BAN_THRESHOLD} la
          partecipazione si sospende per 7 giorni.
        </p>
      </div>
    </section>
  );
}
