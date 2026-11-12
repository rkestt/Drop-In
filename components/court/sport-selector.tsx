"use client";

import * as React from "react";
import { Dumbbell } from "lucide-react";
import { useSport } from "@/lib/sport/sport-context";
import { SPORTS, fromStorage } from "@/lib/sport/sports";
import { cn } from "@/lib/utils";

export interface SportSelectorProps {
  className?: string;
  /** Override dell'id del select (default: generato con useId). */
  id?: string;
}

export function SportSelector({ className, id }: SportSelectorProps) {
  const { sport, setSport } = useSport();
  const autoId = React.useId();
  const selectId = id ?? autoId;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSport(fromStorage(e.target.value));
  };

  return (
    <div className={cn("inline-flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--cool-muted)]/40 rounded-full px-3 py-2 shadow-md min-h-[44px]", className)}>
      <Dumbbell className="w-4 h-4 text-[var(--accent)] shrink-0" aria-hidden="true" />
      <label htmlFor={selectId} className="sr-only">
        Sport attivo
      </label>
      <select
        id={selectId}
        aria-label="Sport attivo"
        value={sport === null ? "all" : sport}
        onChange={handleChange}
        className="min-h-[44px] bg-transparent text-[var(--text-primary)] text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-full"
      >
        {SPORTS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        <option value="all">Tutti</option>
      </select>
    </div>
  );
}
