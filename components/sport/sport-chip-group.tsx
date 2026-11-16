"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { useSport } from "@/lib/sport/sport-context";
import {
  SPORT_CHIP_OPTIONS as OPTIONS,
  nextChipIndex,
} from "@/lib/sport/chip-options";
import { cn } from "@/lib/utils";

export interface SportChipGroupProps {
  /** Id del titolo che nomina il gruppo (senza, si usa `aria-label="Sport"`). */
  labelledBy?: string;
  className?: string;
}

/**
 * Scelta dello sport attivo a chip, single-select.
 *
 * Scrive subito in `SportContext` (che persiste la chiave `sport`): non c'è un
 * bottone "Salva" e non esiste stato locale, quindi onboarding e impostazioni
 * restano sincronizzati con la mappa. `null` = "Tutti" viene serializzato come
 * `"all"` dal provider.
 *
 * Semantica: `radiogroup` + `radio` + `aria-checked` (una scelta sola), con
 * roving tabindex — il gruppo è **una** tab stop, le frecce spostano selezione
 * e fuoco in ciclo. Lo stato non è solo colore: bordo `--accent`, fondo
 * `--accent-subtle` e spunta visibile.
 */
export function SportChipGroup({ labelledBy, className }: SportChipGroupProps) {
  const { sport, setSport } = useSport();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = OPTIONS.findIndex((option) => option.value === sport);
  // Con un valore inatteso nessuna opzione sarebbe tabbabile: la prima fa da
  // fallback (il provider normalizza già con `fromStorage`).
  const focusableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const select = React.useCallback(
    (index: number, moveFocus = false) => {
      const option = OPTIONS[index];
      if (!option) return;
      // Riscrivere lo stesso valore materializzerebbe la chiave `sport` dove
      // non esisteva: `fromStorage(null)` è già "basketball".
      if (option.value !== sport) setSport(option.value);
      if (moveFocus) refs.current[index]?.focus();
    },
    [setSport, sport]
  );

  // Frecce tutte sullo stesso passo: la griglia passa da 2 a 4 colonne col
  // breakpoint, quindi un ±2 "per colonna" mentirebbe a una delle due
  // larghezze. Il ciclo rende raggiungibile ogni opzione da qualsiasi punto.
  // Home/End come nel pattern radio WAI-APG.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(event.key === "Home" ? 0 : OPTIONS.length - 1, true);
      return;
    }
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !backward) return;
    event.preventDefault();
    const dir = forward ? 1 : -1;
    const from = selectedIndex === -1 ? 0 : selectedIndex;
    select(nextChipIndex(from, dir, OPTIONS.length), true);
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Sport"}
      onKeyDown={handleKeyDown}
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}
    >
      {OPTIONS.map((option, index) => {
        const selected = option.value === sport;
        return (
          <button
            key={option.label}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === focusableIndex ? 0 : -1}
            onClick={() => select(index, true)}
            className={cn(
              "relative flex min-h-[44px] w-full items-center justify-center rounded-chip border px-4 text-sm font-medium active:scale-[0.98] motion-safe:transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                : "border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            {/* Spunta assoluta: la label resta centrata sia scelta sia no,
                senza salti di larghezza al cambio di stato. */}
            {selected && (
              <Check
                aria-hidden="true"
                strokeWidth={3}
                className="absolute start-2 h-4 w-4 text-[var(--accent)]"
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
