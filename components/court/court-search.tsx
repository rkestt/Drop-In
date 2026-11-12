"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SEARCH_RADIUS_M } from "@/lib/courts/search";

const RADIUS_KM = SEARCH_RADIUS_M / 1000;

export interface CourtSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** La query è in attesa del debounce o della risposta del server. */
  searching?: boolean;
  /** La ricerca è fallita: il contatore non deve mostrare un conteggio. */
  error?: boolean;
  resultCount?: number;
  totalCount?: number;
  radiusKm?: number;
  placeholder?: string;
  className?: string;
}

/**
 * Box di ricerca campi, solo presentazione: il debounce e la fetch vivono
 * nella home. Il contatore dice sempre la verità del livello corrente:
 * - senza query: campi nel viewport;
 * - con query: risultati server entro il raggio (mai "N di M" locale).
 */
export function CourtSearch({
  value,
  onChange,
  searching = false,
  error = false,
  resultCount,
  totalCount,
  radiusKm = RADIUS_KM,
  placeholder = "Cerca un campo per nome...",
  className,
}: CourtSearchProps) {
  const trimmed = value.trim();
  const hasQuery = trimmed.length > 0;
  const count = resultCount ?? 0;

  let status: React.ReactNode = "";
  if (!hasQuery) {
    status =
      totalCount !== undefined ? `${totalCount} campi nell’area visibile` : "";
  } else if (searching) {
    status = `Cerco «${trimmed}» entro ${radiusKm} km…`;
  } else if (error) {
    status = `Ricerca non riuscita per «${trimmed}».`;
  } else if (count === 0) {
    status = `Nessun campo per «${trimmed}» entro ${radiusKm} km`;
  } else {
    status = `${count} ${count === 1 ? "campo" : "campi"} per «${trimmed}» entro ${radiusKm} km`;
  }

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
      <div
        aria-live="polite"
        aria-atomic="true"
        className="text-xs text-[var(--text-muted)] min-h-[1rem]"
      >
        {status}
      </div>
    </div>
  );
}
