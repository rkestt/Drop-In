"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  NOTE_BODY_MAX,
  NOTE_KINDS,
  mapAddNoteError,
  noteKindLabel,
  type CourtNoteKind,
} from "@/lib/court/notes";

/**
 * Form di inserimento nota (superficie 2, solo moderatori): due campi in un
 * Drawer Base UI. Si apre dalla card della scheda, non è una pagina né una
 * tab di moderazione. La data la mette il server, mai un campo a mano.
 */

const KIND_PLACEHOLDERS: Record<CourtNoteKind, string> = {
  broken_hoop: "Es. «Il canestro di destra è senza rete.»",
  closed: "Es. «Il cancello è chiuso per lavori.»",
  private_area: "Es. «Si entra solo con la società sportiva.»",
  no_lighting: "Es. «Le luci non si accendono dalle 21.»",
  surface: "Es. «Buche al centro del campo.»",
  other: "Es. «Cantiere a bordo campo fino a venerdì.»",
};

const HINT_DEFAULT = "Facoltativo: una riga basta. La data la mette l'app.";
const HINT_OTHER =
  "Con «Altro» il testo serve: altrimenti la nota non dice niente.";

export interface AddedCourtNote {
  id: string;
  kind: CourtNoteKind;
  body: string | null;
}

interface AddNoteSheetProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  /** La card mette la riga nuova in cima senza refetch né pop. */
  onAdded: (note: AddedCourtNote) => void;
}

export function AddNoteSheet({
  open,
  onClose,
  courtId,
  courtName,
  onAdded,
}: AddNoteSheetProps) {
  const router = useRouter();
  const [kind, setKind] = useState<CourtNoteKind | null>(null);
  const [body, setBody] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<AddedCourtNote | null>(null);
  // Guardia anti-doppio-invio (il disabled non copre due submit ravvicinati).
  const sendingRef = useRef(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();
  const log = createLogger("court-note");

  // Bozza azzerata a ogni apertura: i valori si conservano solo dentro il
  // ramo errore di rete (drawer mai chiuso).
  useEffect(() => {
    if (open) {
      setKind(null);
      setBody("");
      setFieldError(null);
      setSubmitError(null);
      setCanRetry(false);
      setSending(false);
      setDone(null);
    }
  }, [open ]);

  const overLimit = body.length > NOTE_BODY_MAX;
  // La CTA resta disabilitata solo finché manca il tipo (decisione 12): gli
  // errori sul testo (oltre 200, Altro vuoto) compaiono al submit, con
  // role=alert e focus sulla textarea.
  const canSubmit = kind !== null && !sending;

  const submit = async () => {
    if (kind === null || sendingRef.current) return;
    if (overLimit) {
      setFieldError(`La nota può avere al massimo ${NOTE_BODY_MAX} caratteri.`);
      bodyRef.current?.focus();
      return;
    }
    if (body.trim() === "" && kind === "other") {
      setFieldError("Scrivi cosa hai visto.");
      bodyRef.current?.focus();
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setFieldError(null);
    setSubmitError(null);

    try {
      const trimmed = body.trim() === "" ? undefined : body.trim();
      const { data, error } = await supabase.rpc("add_court_note", {
        p_court_id: courtId,
        p_kind: kind,
        p_body: trimmed,
      });
      if (error) throw error;
      const note: AddedCourtNote = { id: data, kind, body: trimmed ?? null };
      setDone(note);
      onAdded(note);
      router.refresh();
    } catch (err) {
      // Il tecnico va nel log, mai in UI (#77).
      log.warn("aggiunta nota fallita", {
        courtId,
        message: err instanceof Error ? err.message : String(err),
      });
      const info = mapAddNoteError(err);
      setSubmitError(info.message);
      setCanRetry(info.canRetry);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const placeholder = kind ? KIND_PLACEHOLDERS[kind] : "Aggiungi un dettaglio, se serve.";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Aggiungi una nota"
      description={courtName}
    >
      {done ? (
        <div role="status" className="space-y-3">
          <p className="text-base font-semibold text-[var(--text-primary)]">
            Nota aggiunta.
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {noteKindLabel(done.kind)} · adesso
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            È già nella scheda del campo.
          </p>
          <Button type="button" className="w-full" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      ) : (
        <form
          aria-busy={sending || undefined}
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="text-[13px] leading-snug text-[var(--text-muted)]">
            Dice com&apos;è il campo oggi. La vedono tutti: scrivi un fatto,
            non un giudizio.
          </p>

          {submitError && (
            <div
              role="alert"
              className="rounded-control border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-3"
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {submitError}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                Il testo è ancora qui.
              </p>
            </div>
          )}

          <fieldset>
            <legend className="mb-2 block text-label font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Tipo
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {NOTE_KINDS.map((value) => {
                const selected = kind === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-chip border px-3 text-center text-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)]",
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)] font-semibold text-[var(--text-primary)]"
                        : "border-[var(--border-strong)] font-medium text-[var(--text-secondary)]",
                    )}
                  >
                    <input
                      type="radio"
                      name="note-kind"
                      value={value}
                      checked={selected}
                      disabled={sending}
                      onChange={() => {
                        setKind(value);
                        setFieldError(null);
                      }}
                      className="sr-only"
                    />
                    {noteKindLabel(value)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="note-body"
              className="mb-1.5 block text-label font-semibold uppercase tracking-wider text-[var(--text-muted)]"
            >
              Testo
            </label>
            <textarea
              id="note-body"
              ref={bodyRef}
              value={body}
              readOnly={sending}
              onChange={(event) => {
                setBody(event.target.value);
                setFieldError(null);
              }}
              rows={3}
              placeholder={placeholder}
              aria-invalid={fieldError ? "true" : undefined}
              aria-describedby={
                fieldError
                  ? "note-body-count note-body-hint note-body-error"
                  : "note-body-count note-body-hint"
              }
              className={cn(
                "flex min-h-24 w-full resize-none rounded-control border bg-[var(--bg-surface)] px-4 py-3.5 text-base text-[var(--text-primary)] transition-colors placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
                overLimit
                  ? "border-[var(--danger)]"
                  : "border-transparent focus:border-[var(--accent)]",
              )}
            />
            <p className="mt-1 flex items-baseline justify-between gap-2">
              <span
                id="note-body-hint"
                className="text-[13px] text-[var(--text-muted)]"
              >
                {kind === "other" ? HINT_OTHER : HINT_DEFAULT}
              </span>
              <span
                id="note-body-count"
                className={cn(
                  "shrink-0 text-[13px] tabular-nums",
                  overLimit
                    ? "font-semibold text-[var(--danger-dark)]"
                    : "text-[var(--text-muted)]",
                )}
              >
                <span aria-hidden="true">
                  {body.length}/{NOTE_BODY_MAX}
                </span>
                <span className="sr-only">
                  {body.length} caratteri su {NOTE_BODY_MAX}
                </span>
              </span>
            </p>
            {fieldError && (
              <p
                id="note-body-error"
                role="alert"
                className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--danger)]"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {fieldError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit}
            >
              {sending && (
                <Loader2
                  className="me-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {sending ? "Aggiungo…" : submitError && canRetry ? "Riprova" : "Aggiungi nota"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onClose}
              disabled={sending}
            >
              Annulla
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
