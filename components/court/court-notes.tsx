"use client";

import { Fragment, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { queueDateLabel } from "@/lib/moderation/queue";
import {
  COURT_NOTES_VISIBLE_MAX,
  courtNoteSeparatorBefore,
  courtNotesHeadline,
  noteKindLabel,
  splitCourtNotes,
  type CourtNoteItem,
} from "@/lib/court/notes";
import { AddNoteSheet, type AddedCourtNote } from "./add-note-sheet";

/**
 * Card delle note di campo (superficie 1, #90): un fatto datato, mai un
 * verdetto. Titolo in label 11px (non un titolo Syne da sezione), righe con
 * tipo, età e data esatta, fold numerato oltre tre righe. Nessun colore, né
 * icona per tipo, né accent: il tipo è testo.
 *
 * Le età arrivano già formattate dal server (niente calcoli nel browser, che
 * al primo render sarebbero un mismatch di idratazione). Solo la nota appena
 * aggiunta dice `adesso`, in locale: al reload vale la verità del DB.
 */

interface CourtNotesProps {
  courtId: string;
  courtName: string;
  notes: CourtNoteItem[];
  /** La query note ha fallito: riga neutra, il resto della scheda resta. */
  notesError: boolean;
  /** Solo chi modera vede il bottone — per gli altri non esiste nel DOM. */
  isModerator: boolean;
}

function NoteRow({ note }: { note: CourtNoteItem }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-sm font-semibold",
            note.fresh
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-secondary)]",
          )}
        >
          {note.kindLabel}
        </span>
        <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
          {note.ageLabel}
        </span>
      </div>
      {note.body && (
        <p
          className={cn(
            "mt-0.5 text-sm leading-[1.45]",
            note.fresh
              ? "text-[var(--text-secondary)]"
              : "text-[var(--text-muted)]",
          )}
        >
          {note.body}
        </p>
      )}
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        <time dateTime={note.dateTime}>{note.dateLabel}</time> · di chi modera
      </p>
    </li>
  );
}

export function CourtNotes({
  courtId,
  courtName,
  notes,
  notesError,
  isModerator,
}: CourtNotesProps) {
  const titleId = useId();
  const foldId = useId();
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // La nota appena aggiunta vive in cima in stato locale, con età `adesso`:
  // al reload la rilettura dal DB la sostituisce con la verità del server.
  const [justAdded, setJustAdded] = useState<CourtNoteItem | null>(null);

  const handleAdded = (note: AddedCourtNote) => {
    setJustAdded({
      id: note.id,
      kind: note.kind,
      kindLabel: noteKindLabel(note.kind),
      body: note.body,
      ageLabel: "adesso",
      dateLabel: queueDateLabel(new Date()),
      dateTime: new Date().toISOString(),
      fresh: true,
    });
  };

  const all = justAdded
    ? [justAdded, ...notes.filter((note) => note.id !== justAdded.id)]
    : notes;
  const split = splitCourtNotes(all, COURT_NOTES_VISIBLE_MAX);
  const headline = courtNotesHeadline(all);
  const shown = expanded ? all : split.visible;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id={titleId}
          className="text-label font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          Note di campo
        </h2>
        {isModerator && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex min-h-[44px] items-center rounded-control-sm px-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            + Aggiungi nota
          </button>
        )}
      </div>

      {notesError ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Non riusciamo a mostrare le note di campo.
        </p>
      ) : all.length === 0 ? (
        <div className="mt-2 space-y-0.5">
          <p className="text-sm text-[var(--text-secondary)]">
            Nessuna nota di campo.
          </p>
          <p className="text-[13px] text-[var(--text-muted)]">
            Le note raccontano com&apos;è il posto in un giorno preciso.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          {headline && (
            <p className="mb-3 text-sm text-[var(--text-secondary)]">
              {headline}
            </p>
          )}
          <ul id={foldId} className="space-y-3">
            {shown.map((note, index) => {
              // Il confine è temporale: la prima vecchia dopo una fresca,
              // sia a fold chiuso (nel visibile convivono) che aperto.
              const boundary = courtNoteSeparatorBefore(shown, index);
              return (
                <Fragment key={note.id}>
                  {boundary && (
                    <li className="list-none">
                      <span className="flex items-center gap-2">
                        <span className="text-label font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Precedenti
                        </span>
                        <span
                          className="h-px flex-1 bg-[var(--border)]"
                          aria-hidden="true"
                        />
                      </span>
                    </li>
                  )}
                  <NoteRow note={note} />
                </Fragment>
              );
            })}
          </ul>
          {split.hiddenCount > 0 && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={foldId}
              onClick={() => setExpanded((value) => !value)}
              className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              {expanded
                ? "Mostra meno"
                : split.hiddenCount === 1
                  ? "Mostra l'altra nota"
                  : `Mostra le altre ${split.hiddenCount} note`}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[var(--text-muted)] transition-transform",
                  expanded && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      )}

      {isModerator && (
        <AddNoteSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          courtId={courtId}
          courtName={courtName}
          onAdded={handleAdded}
        />
      )}
    </section>
  );
}
