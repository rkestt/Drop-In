"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CourtPhotoThumb } from "@/components/court/court-photo-thumb";
import { RecurringChip } from "./recurring-chip";
import { NextHighlight } from "@/components/motion/next-highlight";
import { Users, Clock } from "lucide-react";
import { formatDistanceM } from "@/lib/lobbies/nearby";
import { formatAppDateTime } from "@/lib/datetime";
import { lobbyPhase, lobbyPhaseLabel, type LobbyPhase } from "@/lib/lobby/phase";
import { sportDisplayLabel } from "@/lib/courts/search";
import type { LobbySummary } from "./types";

/**
 * Card lobby presentazionale (prototipo d12, lista): tutta la card è un link
 * al dettaglio `/lobbies/[id]` — join ed esci vivono lì, mai qui.
 * Badge di stato + "Sei dentro" (NextHighlight) o "Unisciti" come nel prototipo.
 *
 * "In corso" è derivato (#91): `status` ha solo `open`/`closed`, la fase
 * arriva da `lobbyPhase` con l'orologio. L'orologio entra solo dopo il mount:
 * server e client possono cadere ai due lati di `start_time` e cambiare il
 * badge (mismatch di idratazione), come in `lobby-detail`.
 */
export function LobbyCard({ lobby }: { lobby: LobbySummary }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isFull = lobby.participants_count >= lobby.max_players;
  const phase: LobbyPhase = mounted
    ? lobbyPhase(lobby)
    : lobby.status === "open"
      ? "open"
      : "closed";
  const statusLabel =
    phase === "open" && isFull
      ? "Al completo"
      : lobbyPhaseLabel(phase);
  const statusVariant =
    phase === "open" && !isFull
      ? "accent"
      : phase === "in_progress"
        ? "warning"
        : "default";
  const stateLabel = lobby.is_joined
    ? "sei dentro"
    : isFull
      ? "al completo"
      : lobbyPhaseLabel(phase).toLowerCase();
  // "ricorrente" in coda quando l'occorrenza viene da una serie (#92).
  const recurringLabel = lobby.series ? "ricorrente" : undefined;
  // Nome accessibile completo: campo, sport, orario, posti, distanza, stato.
  // Lo sport usa l'etichetta UI ("Sport non specificato" quando NULL, #71).
  const ariaLabel = [
    `Lobby al ${lobby.court_name}`,
    sportDisplayLabel(lobby.court_sport),
    `ore ${formatAppDateTime(lobby.start_time)}`,
    `${lobby.participants_count} su ${lobby.max_players}`,
    lobby.distance_m != null ? `a ${formatDistanceM(lobby.distance_m)}` : undefined,
    recurringLabel,
    stateLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/lobbies/${lobby.id}`}
      aria-label={ariaLabel}
      className="block rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    >
      <span className="flex items-start gap-3">
        <CourtPhotoThumb
          photoPath={lobby.court_photo_path}
          className="h-14 w-14"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[var(--text-primary)]">
            {lobby.court_name}
          </span>
          {/* #92: chip di provenienza su riga propria, sopra la meta. La card
              non ricorrente resta identica, senza spazio vuoto. */}
          {lobby.series ? (
            <span className="mt-1 flex">
              <RecurringChip
                weekday={lobby.series.weekday}
                timeOfDay={lobby.series.timeOfDay}
              />
            </span>
          ) : null}
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatAppDateTime(lobby.start_time)}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {lobby.participants_count}/{lobby.max_players}
            </span>
            {lobby.distance_m != null && (
              <span className="whitespace-nowrap">{formatDistanceM(lobby.distance_m)}</span>
            )}
            {/* #71: lo sport e' sempre mostrato; NULL → "Sport non specificato". */}
            <span>{sportDisplayLabel(lobby.court_sport)}</span>
          </span>
        </span>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Badge variant={statusVariant as any}>{statusLabel}</Badge>
      </span>
      <span className="mt-2 flex items-center">
        {lobby.is_joined ? (
          <NextHighlight className="ms-auto">
            <span className="rounded-chip bg-[var(--accent-subtle)] px-2 py-0.5 text-label font-semibold text-[var(--text-primary)]">
              Sei dentro
            </span>
          </NextHighlight>
        ) : (
          phase === "open" &&
          !isFull && (
            <span className="ms-auto inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
              Unisciti
              <span aria-hidden="true">›</span>
            </span>
          )
        )}
      </span>
    </Link>
  );
}
