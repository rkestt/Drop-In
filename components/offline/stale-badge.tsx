"use client";

import { formatCacheAge } from "@/lib/offline/cache";

/**
 * Stale badge (d24): "Dati di 12 min fa". --warning, non invadente.
 * Ritorna null senza savedAt. L'offline non è un errore: mai --danger.
 */
export function StaleBadge({ savedAt }: { savedAt: number | null }) {
  const label = savedAt == null ? null : formatCacheAge(Date.now() - savedAt);
  if (label == null) return null;
  return (
    <span className="inline-flex items-center rounded-chip border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--warning-dark)]">
      Dati di {label}
    </span>
  );
}
