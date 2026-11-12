"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CourtPhotoThumb } from "@/components/court/court-photo-thumb";
import { NextHighlight } from "@/components/motion/next-highlight";
import { Users, Clock } from "lucide-react";
import { formatDistanceM } from "@/lib/lobbies/nearby";
import type { LobbySummary } from "./types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Card lobby presentazionale (prototipo d12, lista): tutta la card è un link
 * al dettaglio `/lobbies/[id]` — join ed esci vivono lì, mai qui.
 * Badge di stato + "Sei dentro" (NextHighlight) o "Unisciti" come nel prototipo.
 */
export function LobbyCard({ lobby }: { lobby: LobbySummary }) {
  const isFull = lobby.participants_count >= lobby.max_players;
  const statusLabel =
    lobby.status === "open"
      ? isFull
        ? "Al completo"
        : "Aperta"
      : lobby.status === "in_progress"
        ? "In corso"
        : "Chiusa";
  const statusVariant =
    lobby.status === "open" && !isFull
      ? "accent"
      : lobby.status === "in_progress"
        ? "warning"
        : "default";
  const stateLabel = lobby.is_joined
    ? "sei dentro"
    : isFull
      ? "al completo"
      : lobby.status;
  // Nome accessibile completo: campo, sport, orario, posti, distanza, stato.
  const ariaLabel = [
    `Lobby al ${lobby.court_name}`,
    lobby.court_sport ?? undefined,
    `ore ${formatTime(lobby.start_time)}`,
    `${lobby.participants_count} su ${lobby.max_players}`,
    lobby.distance_m != null ? `a ${formatDistanceM(lobby.distance_m)}` : undefined,
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
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatTime(lobby.start_time)}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {lobby.participants_count}/{lobby.max_players}
            </span>
            {lobby.distance_m != null && (
              <span className="whitespace-nowrap">{formatDistanceM(lobby.distance_m)}</span>
            )}
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
          lobby.status === "open" &&
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
