"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourtPhotoThumb } from "@/components/court/court-photo-thumb";
import type {
  DedupCandidateItem,
  ModerationQueueItem,
} from "@/lib/moderation/queue";
import { cn } from "@/lib/utils";

type DedupState =
  | { status: "idle"; items: DedupCandidateItem[] }
  | { status: "loading"; items: DedupCandidateItem[] }
  | { status: "ready"; items: DedupCandidateItem[] }
  | { status: "error"; items: DedupCandidateItem[] };

interface PendingCourtCardProps {
  court: ModerationQueueItem;
  /** Un'azione di questa riga è in corso: cambia la label dei bottoni. */
  busy: boolean;
  /** Un'azione è in corso su una riga qualsiasi: blocca ogni controllo. */
  disabled: boolean;
  /** Errore dell'ultima azione su questa riga, da mostrare in loco. */
  errorText: string | null;
  onApprove: (court: ModerationQueueItem) => void;
  onReject: (court: ModerationQueueItem, note: string) => void;
  onDuplicate: (
    court: ModerationQueueItem,
    original: DedupCandidateItem,
  ) => void;
  loadCandidates: (
    court: ModerationQueueItem,
  ) => Promise<{ items: DedupCandidateItem[]; error: boolean }>;
}

function courtMeta(court: ModerationQueueItem): string {
  return [court.sportLabel, court.surfaceLabel, court.address]
    .filter((value): value is string => Boolean(value))
    .join("\u00A0· ");
}

/**
 * Riga della coda proposte (#33). Il riepilogo è un bottone che espande il
 * dettaglio (44px, `aria-expanded`); le azioni vivono solo nel dettaglio.
 * I duplicati si caricano alla prima apertura: le righe mascherate dalla RPC
 * restano "Proposta in attesa" e non producono alcuna azione.
 */
export function PendingCourtCard({
  court,
  busy,
  disabled,
  errorText,
  onApprove,
  onReject,
  onDuplicate,
  loadCandidates,
}: PendingCourtCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [dedup, setDedup] = useState<DedupState>({
    status: "idle",
    items: [],
  });
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [choosingDuplicate, setChoosingDuplicate] = useState(false);

  const detailId = `court-detail-${court.id}`;
  const rejectId = `court-reject-${court.id}`;
  const duplicateId = `court-duplicate-${court.id}`;
  const noteId = `court-note-${court.id}`;

  const loadDedup = async () => {
    if (court.lat === null || court.lng === null) {
      setDedup({ status: "ready", items: [] });
      return;
    }
    setDedup({ status: "loading", items: [] });
    const { items, error } = await loadCandidates(court);
    setDedup(error ? { status: "error", items: [] } : { status: "ready", items });
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) {
      setRejecting(false);
      setChoosingDuplicate(false);
      return;
    }
    if (dedup.status === "idle") void loadDedup();
  };

  const selectable = dedup.items.filter((item) => item.selectable);

  return (
    <li className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={toggle}
        className="flex w-full min-h-[44px] items-start gap-3 rounded-card p-4 text-start transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <CourtPhotoThumb photoPath={court.photoPath} className="h-14 w-14" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[var(--text-primary)] line-clamp-2">
            {court.name}
          </span>
          <span className="mt-1 block text-sm text-[var(--text-secondary)] line-clamp-2">
            {courtMeta(court)}
          </span>
          <span className="mt-1 block text-xs text-[var(--text-muted)]">
            {court.submittedAgo || "Data non disponibile"}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform duration-150",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div
          id={detailId}
          className="space-y-3 border-t border-[var(--border)] px-4 pb-4 pt-3"
        >
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="shrink-0 text-[var(--text-muted)]">Posizione</dt>
              <dd className="min-w-0 text-[var(--text-secondary)]">
                {court.coordinates}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[var(--text-muted)]">Inviata</dt>
              <dd className="min-w-0 text-[var(--text-secondary)]">
                {court.submittedOn || "Data non disponibile"}
              </dd>
            </div>
          </dl>

          {errorText && (
            <p
              role="alert"
              className="rounded-control-sm bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger-dark)]"
            >
              {errorText}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onApprove(court)}
              disabled={disabled}
              className="min-w-[120px] flex-1"
            >
              {busy ? "Invio…" : "Approva"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setRejecting((value) => !value);
                setChoosingDuplicate(false);
              }}
              disabled={disabled}
              aria-expanded={rejecting}
              className="min-w-[120px] flex-1 text-[var(--danger)]"
            >
              Rifiuta
            </Button>
          </div>

          {rejecting && (
            <form
              id={rejectId}
              onSubmit={(event) => {
                event.preventDefault();
                onReject(court, note);
              }}
              className="space-y-2 rounded-control-sm border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-3"
            >
              <label
                htmlFor={noteId}
                className="block text-sm font-semibold text-[var(--text-primary)]"
              >
                Motivo del rifiuto (facoltativo)
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Es. La posizione non corrisponde a un campo."
                className="flex min-h-[96px] w-full resize-none rounded-control border border-transparent bg-[var(--bg-surface)] px-4 py-3.5 text-base text-[var(--text-primary)] transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              />
              <p className="text-xs text-[var(--text-muted)]">
                Lo vedrà chi ha inviato la proposta. Vuoto = nessun motivo.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setRejecting(false)}
                  disabled={disabled}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="danger"
                  disabled={disabled}
                  className="flex-1"
                >
                  {busy ? "Invio…" : "Conferma rifiuto"}
                </Button>
              </div>
            </form>
          )}

          <div className="rounded-control-sm border border-[var(--border)] p-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Possibili duplicati
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Campi entro 100 metri.
            </p>

            {dedup.status === "loading" && (
              <div className="mt-2 space-y-2" aria-hidden="true">
                <div className="h-9 animate-shimmer rounded-control-sm bg-[var(--bg-elevated)]" />
                <div className="h-9 animate-shimmer rounded-control-sm bg-[var(--bg-elevated)]" />
              </div>
            )}

            {dedup.status === "error" && (
              <p role="alert" className="mt-2 text-sm text-[var(--danger-dark)]">
                Non riusciamo a cercare i duplicati. Puoi comunque approvare o
                rifiutare.
              </p>
            )}

            {dedup.status === "ready" && dedup.items.length === 0 && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Nessun campo simile entro 100 m.
              </p>
            )}

            {dedup.status === "ready" && dedup.items.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {dedup.items.map((candidate) => (
                  <li
                    key={candidate.key}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        candidate.selectable
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-muted)]",
                      )}
                    >
                      {candidate.name}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">
                      {candidate.distanceLabel ?? "Posizione non condivisa"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {selectable.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setChoosingDuplicate((value) => !value);
                  setRejecting(false);
                }}
                disabled={disabled}
                aria-expanded={choosingDuplicate}
                className="mt-3 w-full"
              >
                Duplicato di…
              </Button>
            )}

            {choosingDuplicate && (
              <div
                id={duplicateId}
                className="mt-2 rounded-control-sm border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3"
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Quale campo è l&apos;originale?
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  La proposta viene archiviata come duplicato.
                </p>
                <ul className="mt-2 space-y-2">
                  {selectable.map((candidate) => (
                    <li key={candidate.key}>
                      <button
                        type="button"
                        onClick={() => onDuplicate(court, candidate)}
                        disabled={disabled}
                        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-control-sm border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-start text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                      >
                        <span className="min-w-0 truncate">
                          {candidate.name}
                        </span>
                        {candidate.distanceLabel && (
                          <span className="shrink-0 text-xs text-[var(--text-muted)]">
                            {candidate.distanceLabel}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setChoosingDuplicate(false)}
                  disabled={disabled}
                  className="mt-2 w-full"
                >
                  Annulla
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
