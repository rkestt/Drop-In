"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CourtSearchProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  totalCount?: number;
  placeholder?: string;
  className?: string;
}

export function CourtSearch({
  value,
  onChange,
  resultCount,
  totalCount,
  placeholder = "Cerca un campo per nome...",
  className,
}: CourtSearchProps) {
  const hasQuery = value.trim().length > 0;
  const empty = hasQuery && (resultCount ?? 0) === 0;

  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor="court-search" className="sr-only">
        Cerca campi per nome
      </label>
      <Input
        id="court-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Cerca campi per nome"
      />
      <div aria-live="polite" aria-atomic="true" className="text-xs text-[var(--text-muted)] min-h-[1rem]">
        {hasQuery ? (
          empty ? (
            <span>
              Nessun campo per «{value.trim()}»
            </span>
          ) : (
            <span>
              {resultCount} di {totalCount ?? resultCount} campi
            </span>
          )
        ) : (
          <span>
            {totalCount !== undefined ? `${totalCount} campi nell’area visibile` : ""}
          </span>
        )}
      </div>
      {empty && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="inline-flex min-h-[44px] items-center justify-center rounded-control bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)]"
        >
          Cancella ricerca
        </button>
      )}
    </div>
  );
}
