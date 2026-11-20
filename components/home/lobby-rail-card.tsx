"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Card compatta della striscia (V4, ticket 89): orario protagonista + barra di
 * riempimento. Il nome NON è visibile (128px non bastano, ticket 106): resta nel
 * nome accessibile completo e nella riga del foglio pieno.
 *
 * Scala di pienezza condivisa con le righe del foglio (cifre + barra):
 * verde = posti liberi, ambra = quasi piena (≥70%), grigio = al completo.
 * La lunghezza della barra dice la pienezza anche in scala di grigi.
 */
export function occupancyTone(participants: number, maxPlayers: number): string {
  if (!Number.isFinite(maxPlayers) || maxPlayers <= 0) return "var(--text-muted)";
  const ratio = participants / maxPlayers;
  if (ratio >= 1) return "var(--text-muted)";
  if (ratio >= 0.7) return "var(--warning)";
  return "var(--success)";
}

export function occupancyPercent(participants: number, maxPlayers: number): number {
  if (!Number.isFinite(maxPlayers) || maxPlayers <= 0) return 0;
  return Math.min(100, Math.max(0, (participants / maxPlayers) * 100));
}

export interface LobbyRailCardProps {
  lobbyId: string;
  courtId: string;
  /** Nome del campo: solo nel nome accessibile, mai troncato a schermo. */
  courtName: string;
  /** Ora "19:40" già formattata nel fuso dell'app. */
  time: string;
  participants: number;
  maxPlayers: number;
  /** Serie presente ma senza dettaglio: chip ridotto a "ricorrente". */
  recurring?: boolean;
}

/**
 * 128×52, tutta-link a `/courts/<id>` con chevron (approvato 17 nov: niente
 * bottone `Vedi` nel foglio). Mai un `role` o un tab stop interno: un solo
 * focus stop per card.
 */
export function LobbyRailCard({
  lobbyId,
  courtId,
  courtName,
  time,
  participants,
  maxPlayers,
  recurring = false,
}: LobbyRailCardProps) {
  const tone = occupancyTone(participants, maxPlayers);
  const percent = occupancyPercent(participants, maxPlayers);
  const full = maxPlayers > 0 && participants >= maxPlayers;
  const ariaLabel = [
    `${courtName}`,
    `ore ${time}`,
    `${participants} su ${maxPlayers} posti`,
    recurring ? "ricorrente" : undefined,
    full ? "al completo" : undefined,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      key={lobbyId}
      href={`/courts/${courtId}`}
      aria-label={ariaLabel}
      className="flex min-h-[52px] w-32 shrink-0 snap-start flex-col justify-between rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-2 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
    >
      <span className="flex items-center justify-between gap-1">
        <span className="font-[family-name:var(--font-syne)] text-lg font-semibold leading-none text-[var(--text-primary)]">
          {time}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </span>
      <span
        className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--border)]"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${percent}%`, background: tone }}
        />
      </span>
    </Link>
  );
}
