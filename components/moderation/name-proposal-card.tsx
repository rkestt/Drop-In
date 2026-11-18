"use client";

import { useEffect, useRef, useState } from "react";
import { COURT_NAME_MAX } from "@/lib/validation/schemas";
import type { NameProposalItem } from "@/lib/moderation/queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NameProposalCardProps {
  item: NameProposalItem;
  /** Un'azione di questa riga è in corso: cambia la label dei bottoni. */
  busy: boolean;
  /** Un'azione è in corso su una riga qualsiasi: blocca ogni controllo. */
  disabled: boolean;
  /** Errore dell'ultima azione su questa riga, da mostrare in loco. */
  errorText: string | null;
  onApprove: (item: NameProposalItem) => void;
  onApproveEdited: (item: NameProposalItem, name: string) => void;
  onReject: (item: NameProposalItem, note: string) => void;
}

/**
 * Riga della coda nomi (ticket 106): coppia adesso/proposto, autore ed età, tre
 * azioni (Approva / Modifica / Rifiuta) con editor inline. Stesso
 * `busy`/`disabled`/`errorText` di PendingCourtCard: dopo un'azione la coda
 * si rilegge dal DB, niente optimistic update.
 */
export function NameProposalCard({
  item,
  busy,
  disabled,
  errorText,
  onApprove,
  onApproveEdited,
  onReject,
}: NameProposalCardProps) {
  const [editor, setEditor] = useState<"edit" | "reject" | null>(null);
  const [editedName, setEditedName] = useState(item.proposedName);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState(false);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rejectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const rejectTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const restoreFocusRef = useRef<"edit" | "reject" | null>(null);

  // Apertura editor: il focus va al primo campo. Chiusura via "Annulla":
  // torna al trigger che l'ha aperto.
  useEffect(() => {
    if (editor === "edit") {
      setEditedName(item.proposedName);
      editInputRef.current?.focus();
    } else if (editor === "reject") {
      setRejectNote("");
      setRejectError(false);
      rejectTextareaRef.current?.focus();
    } else if (restoreFocusRef.current === "edit") {
      restoreFocusRef.current = null;
      editTriggerRef.current?.focus();
    } else if (restoreFocusRef.current === "reject") {
      restoreFocusRef.current = null;
      rejectTriggerRef.current?.focus();
    }
  }, [editor, item.proposedName]);

  const closeEditor = (trigger: "edit" | "reject") => {
    restoreFocusRef.current = trigger;
    setEditor(null);
  };

  const toggleEditor = (next: "edit" | "reject") => {
    restoreFocusRef.current = null;
    // Un solo editor aperto per riga: aprire l'uno chiude l'altro.
    setEditor((current) => (current === next ? null : next));
  };

  const meta = [item.address, `di ${item.proposerLabel}`, item.submittedAgo]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  const editedTrimmed = editedName.trim();
  // Niente `maxLength`: la convenzione è valida-non-troncare (stessa dello
  // sheet proposta) — il tetto si mostra inline e blocca il submit.
  const editedOverLimit = editedName.length > COURT_NAME_MAX;
  const editorId = `name-editor-${item.id}`;
  const editInputId = `name-edit-${item.id}`;
  const rejectNoteId = `name-reject-${item.id}`;
  const rejectErrorId = `name-reject-error-${item.id}`;

  return (
    <li className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-3.5">
      <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2.5 gap-y-1">
        <dt className="text-[var(--text-label)] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
          {item.isAutoName ? "Adesso · automatico" : "Adesso"}
        </dt>
        <dd className="min-w-0 text-sm text-[var(--text-secondary)] leading-relaxed break-words">
          {item.currentName}
        </dd>
        <dt className="text-[var(--text-label)] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
          Proposto
        </dt>
        <dd className="min-w-0 text-base font-semibold text-[var(--text-primary)] leading-snug break-words">
          {item.proposedName}
        </dd>
      </dl>
      <p className="mt-1.5 text-[13px] text-[var(--text-muted)]">{meta}</p>

      {errorText && (
        <p
          role="alert"
          className="mt-2 rounded-control-sm bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger-dark)]"
        >
          {errorText}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onApprove(item)}
          disabled={disabled}
          className="min-w-[84px] flex-1"
        >
          {busy ? "Invio…" : "Approva"}
        </Button>
        <Button
          ref={editTriggerRef}
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => toggleEditor("edit")}
          disabled={disabled}
          aria-expanded={editor === "edit"}
          aria-controls={editorId}
          className="min-w-[84px] flex-1"
        >
          Modifica
        </Button>
        <Button
          ref={rejectTriggerRef}
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => toggleEditor("reject")}
          disabled={disabled}
          aria-expanded={editor === "reject"}
          aria-controls={editorId}
          className={cn("min-w-[84px] flex-1 text-[var(--danger)]")}
        >
          Rifiuta
        </Button>
      </div>

      {editor === "edit" && (
        <form
          id={editorId}
          onSubmit={(event) => {
            event.preventDefault();
            if (editedTrimmed === "" || editedOverLimit) return;
            onApproveEdited(item, editedTrimmed);
          }}
          className="mt-2.5 flex flex-col gap-2 rounded-control border border-[var(--border-strong)] bg-[var(--bg-base)] p-3"
        >
          <label
            htmlFor={editInputId}
            className="block text-sm font-semibold text-[var(--text-primary)]"
          >
            Nome che approvi
          </label>
          <Input
            ref={editInputRef}
            id={editInputId}
            value={editedName}
            onChange={(event) => setEditedName(event.target.value)}
            placeholder={item.proposedName}
            aria-invalid={editedOverLimit ? "true" : undefined}
            aria-describedby={
              editedOverLimit ? `${editInputId}-error` : `${editInputId}-hint`
            }
            className={
              editedOverLimit
                ? "border-[var(--danger)] focus:border-[var(--danger)]"
                : undefined
            }
          />
          <p id={`${editInputId}-hint`} className="text-xs text-[var(--text-muted)]">
            Puoi correggerlo prima di approvare.
          </p>
          {editedOverLimit && (
            <p
              id={`${editInputId}-error`}
              role="alert"
              className="text-sm text-[var(--danger-dark)]"
            >
              Il nome può avere al massimo {COURT_NAME_MAX} caratteri.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => closeEditor("edit")}
              disabled={disabled}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={disabled || editedTrimmed === "" || editedOverLimit}
              className="flex-1"
            >
              {busy ? "Invio…" : "Approva con questo nome"}
            </Button>
          </div>
        </form>
      )}

      {editor === "reject" && (
        <form
          id={editorId}
          onSubmit={(event) => {
            event.preventDefault();
            if (rejectNote.trim() === "") {
              setRejectError(true);
              rejectTextareaRef.current?.focus();
              return;
            }
            onReject(item, rejectNote.trim());
          }}
          className="mt-2.5 flex flex-col gap-2 rounded-control border border-[var(--border-strong)] bg-[var(--bg-base)] p-3"
          noValidate
        >
          <label
            htmlFor={rejectNoteId}
            className="block text-sm font-semibold text-[var(--text-primary)]"
          >
            Motivo del rifiuto
          </label>
          <textarea
            ref={rejectTextareaRef}
            id={rejectNoteId}
            value={rejectNote}
            onChange={(event) => {
              setRejectNote(event.target.value);
              if (rejectError && event.target.value.trim() !== "") {
                setRejectError(false);
              }
            }}
            rows={3}
            placeholder="Es. Il nome non è quello usato da chi ci gioca."
            aria-invalid={rejectError ? "true" : undefined}
            aria-describedby={
              rejectError ? rejectErrorId : `${rejectNoteId}-hint`
            }
            className="flex min-h-[96px] w-full resize-none rounded-control border border-transparent bg-[var(--bg-elevated)] px-4 py-3.5 text-base text-[var(--text-primary)] transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          />
          <p id={`${rejectNoteId}-hint`} className="text-xs text-[var(--text-muted)]">
            Lo vedrà chi ha proposto: senza motivo non si rifiuta.
          </p>
          {rejectError && (
            <p id={rejectErrorId} role="alert" className="text-sm text-[var(--danger-dark)]">
              Scrivi il motivo del rifiuto.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => closeEditor("reject")}
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
    </li>
  );
}
