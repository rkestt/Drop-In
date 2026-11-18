"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  COURT_NAME_MAX,
  proposeNameSchema,
  type ProposeNameValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import {
  isSameCourtName,
  mapProposeNameError,
} from "@/lib/court/name-proposals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";

interface ProposeNameSheetProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  /** Nome della proposta già aperta dell'utente (fallback anti-stale). */
  ownPendingName: string | null;
  /** Chiamato dopo l'invio riuscito, con il nome proposto. */
  onProposed: (name: string) => void;
}

/**
 * Form proposta nome (ticket 106, superficie 2): bottom sheet con riepilogo
 * "adesso → proposto", contatore 120 e stati inline da spec. Il Drawer di
 * progetto fornisce dialog/trap/Escape/backdrop; la validazione zod copre
 * vuoto e tetto, i controlli anti-duplicato (uguale all'attuale, proposta
 * già aperta) sono client prima della RPC.
 */
export function ProposeNameSheet({
  open,
  onClose,
  courtId,
  courtName,
  ownPendingName,
  onProposed,
}: ProposeNameSheetProps) {
  const supabase = createClient();
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [sentName, setSentName] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const countId = useId();
  const hintId = useId();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<ProposeNameValues>({
    resolver: zodResolver(proposeNameSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "" },
  });

  const typed = watch("name") ?? "";
  const trimmed = typed.trim();
  // Contatore sui caratteri digitati (non trimmato): il tetto è validato,
  // non troncato a metà digitazione.
  const overLimit = typed.length > COURT_NAME_MAX;

  // Apertura pulita: valori, errore ed esito non sopravvivono alla chiusura.
  useEffect(() => {
    if (open) {
      reset({ name: "" });
      setSubmitError(null);
      setCanRetry(false);
      setSentName(null);
    }
  }, [open, reset]);

  const close = () => {
    if (sendingRef.current) return;
    onClose();
  };

  const onValidSubmit = async (values: ProposeNameValues) => {
    if (sendingRef.current) return;
    // Anti-duplicato client (spec): prima della RPC.
    if (isSameCourtName(values.name, courtName)) {
      setSubmitError("È già il nome di questo campo.");
      setCanRetry(false);
      setFocus("name");
      return;
    }
    if (ownPendingName != null) {
      setSubmitError(
        "Hai già una proposta in attesa su questo campo: la trovi in «Le tue proposte»."
      );
      setCanRetry(false);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSubmitError(null);
    setCanRetry(false);
    try {
      const { error } = await supabase.rpc("propose_court_name", {
        p_court_id: courtId,
        p_name: values.name.trim(),
      });
      if (error) {
        const mapped = mapProposeNameError(error);
        setSubmitError(mapped.message);
        setCanRetry(mapped.canRetry);
        setFocus("name");
        return;
      }
      setSentName(values.name.trim());
      onProposed(values.name.trim());
    } catch {
      setSubmitError("Non siamo riusciti a inviare la proposta.");
      setCanRetry(false);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const describedBy = [countId, hintId, submitError ? "propose-name-error" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Drawer
      open={open}
      onClose={close}
      title={sentName == null ? "Proponi il nome" : undefined}
      description={
        sentName == null
          ? "Questo nome l'ha messo il sistema. Se sai come lo chiamano lì, scrivilo: lo rivede chi modera."
          : undefined
      }
    >
      {sentName == null ? (
        <form
          onSubmit={handleSubmit(onValidSubmit)}
          className="flex flex-col gap-4"
          noValidate
          aria-busy={sending}
        >
          <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 rounded-control border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <dt className="text-[var(--text-label)] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
              Adesso
            </dt>
            <dd className="min-w-0 text-sm text-[var(--text-secondary)] leading-relaxed break-words">
              {courtName}
            </dd>
            <dt className="text-[var(--text-label)] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
              Proposto
            </dt>
            <dd className="min-w-0 text-sm font-semibold text-[var(--text-primary)] leading-relaxed line-clamp-2 break-words">
              {trimmed === "" ? (
                <span className="font-normal text-[var(--text-muted)]">—</span>
              ) : (
                trimmed
              )}
            </dd>
          </dl>

          <div>
            <label
              htmlFor="propose-name-input"
              className="mb-1.5 block text-sm font-semibold text-[var(--text-primary)]"
            >
              Nome del campo
            </label>
            <Input
              id="propose-name-input"
              {...register("name")}
              placeholder="Es. Campetto dell'Arte"
              readOnly={sending}
              aria-invalid={errors.name || overLimit ? "true" : undefined}
              aria-describedby={describedBy}
              className={
                overLimit
                  ? "border-[var(--danger)] focus:border-[var(--danger)]"
                  : undefined
              }
            />
            <p className="mt-1 flex justify-end">
              <span
                id={countId}
                className={
                  overLimit
                    ? "text-[13px] font-semibold tabular-nums text-[var(--danger-dark)]"
                    : "text-[13px] tabular-nums text-[var(--text-muted)]"
                }
              >
                <span aria-hidden="true">
                  {typed.length}/{COURT_NAME_MAX}
                </span>
                <span className="sr-only">
                  {typed.length} caratteri su {COURT_NAME_MAX}
                </span>
              </span>
            </p>
            <p id={hintId} className="mt-1 text-[13px] text-[var(--text-muted)]">
              Un nome di luogo, non una descrizione: «Campetto
              dell&apos;Arte», non «campo di basket».
            </p>
            {(errors.name || overLimit) && (
              <p
                id="propose-name-error"
                role="alert"
                className="mt-1.5 text-sm text-[var(--danger-dark)]"
              >
                {errors.name?.message ??
                  `Il nome può avere al massimo ${COURT_NAME_MAX} caratteri.`}
              </p>
            )}
            {submitError && (
              <p role="alert" className="mt-1.5 text-sm text-[var(--danger-dark)]">
                {submitError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={sending}
              className="w-full min-h-[48px]"
            >
              {sending ? "Invio…" : canRetry ? "Riprova" : "Invia proposta"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={sending}
              className="w-full min-h-[44px]"
            >
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            Proposta inviata.
          </p>
          <p className="text-[var(--text-secondary)]">
            «{sentName}» è in revisione.
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Lo rivede chi modera. La trovi in «Le tue proposte»: da lì puoi
            ritirarla.
          </p>
          <div className="mt-1 flex flex-col gap-2">
            <Link
              href="/submit-court#nomi"
              onClick={close}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-control bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)] transition-all duration-150 hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 active:scale-[0.97]"
            >
              Le tue proposte
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              className="w-full min-h-[44px]"
            >
              Chiudi
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
