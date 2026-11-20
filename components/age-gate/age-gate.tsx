"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const BIRTH_DATE_ID = "age-gate-birth-date";
const BIRTH_DATE_ERROR_ID = "age-gate-birth-date-error";

export interface AgeGateProps {
  /** Data di nascita già nota (`YYYY-MM-DD`): valore iniziale del campo. */
  birthDate?: string;
  /** Invio in corso (data o eliminazione account): disabilita i controlli. */
  pending?: boolean;
  /** Errore del form, mostrato sotto il campo. */
  error?: string | null;
  /** Errore dell'eliminazione, mostrato nel drawer di conferma. */
  deleteError?: string | null;
  /** `true` = età dichiarata sotto la soglia: mostra il blocco. */
  blocked?: boolean;
  /** Invio della data scelta (`YYYY-MM-DD`). */
  onSubmit: (date: string) => void;
  /** Conferma (secondo passo) dell'eliminazione account. */
  onDeleteAccount: () => void;
}

/**
 * Age gate di Drop-In (#97): chiede la data di nascita dopo l'accesso e
 * mostra lo stato di blocco per chi dichiara meno di 14 anni.
 *
 * Contratto con la lane server (questo file è solo presentazione: niente
 * `fetch`, niente Supabase, niente redirect, niente router):
 *
 * - `birthDate` è il valore *iniziale* del campo. Se la prop cambia dopo il
 *   mount non sovrascrive quello che l'utente ha digitato: le modifiche locali
 *   vincono.
 * - `pending` copre entrambe le azioni (invio data / eliminazione): i bottoni
 *   si disabilitano e cambiano etichetta. Va impostato in modo sincrono dentro
 *   `onSubmit`/`onDeleteAccount`, altrimenti resta la finestra per il doppio
 *   invio.
 * - `error` è l'errore del form (data mancante, data rifiutata, rete). Il
 *   genitore lo azzera quando l'utente modifica il campo o riprova.
 * - `deleteError` è l'errore della sola eliminazione e vive dentro il drawer
 *   di conferma. Il drawer resta aperto durante `pending`: al successo il
 *   genitore naviga via, al fallimento imposta `deleteError` e lo azzera alla
 *   chiusura o al tentativo successivo.
 * - `blocked` è lo stato deciso dal server. «Correggi la data» riapre il form
 *   in locale senza toccare la prop; «Indietro» nel form torna al blocco. Se
 *   `blocked` passa a `false` (età corretta) il form resta quello normale.
 * - `onSubmit(date)` riceve la data nel formato nativo `YYYY-MM-DD`.
 *   `onDeleteAccount()` è chiamato solo dal bottone di conferma del drawer,
 *   mai dal primo click.
 */
export function AgeGate({
  birthDate,
  pending = false,
  error = null,
  deleteError = null,
  blocked = false,
  onSubmit,
  onDeleteAccount,
}: AgeGateProps) {
  const [date, setDate] = useState(birthDate ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  // Uscita dal blocco: il form si riapre in locale, senza rimandare al server.
  const [correcting, setCorrecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const blockedHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const showBlocked = blocked && !correcting;
  const view = showBlocked ? "blocked" : "form";
  const shownError = localError ?? error;

  // Se il server sblocca, la correzione locale ha finito il suo lavoro.
  useEffect(() => {
    if (!blocked) setCorrecting(false);
  }, [blocked]);

  // Cambio di stato: il fuoco segue la nuova vista (il bottone premuto
  // sparisce). Alla prima apertura non si ruba il fuoco.
  const previousView = useRef(view);
  useEffect(() => {
    if (previousView.current === "form" && view === "blocked") {
      blockedHeadingRef.current?.focus();
    }
    if (previousView.current === "blocked" && view === "form") {
      inputRef.current?.focus();
    }
    previousView.current = view;
  }, [view]);

  const switchToForm = () => {
    setLocalError(null);
    setCorrecting(true);
  };

  const switchToBlocked = () => {
    setLocalError(null);
    setCorrecting(false);
  };

  const submitDate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const value = date.trim();
    if (!value) {
      setLocalError("Inserisci la tua data di nascita.");
      inputRef.current?.focus();
      return;
    }

    setLocalError(null);
    onSubmit(value);
  };

  const openConfirm = () => {
    if (pending) return;
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (pending) return;
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="mx-auto my-auto w-full max-w-[560px]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Età minima
        </p>

        <div
          key={view}
          className="mt-3 animate-[fadeInUp_var(--motion-slow)_var(--ease-standard)_both]"
        >
          {view === "blocked" ? (
            <section aria-labelledby="age-gate-blocked-title">
              <h1
                id="age-gate-blocked-title"
                ref={blockedHeadingRef}
                tabIndex={-1}
                className="text-display font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]"
              >
                Drop-In è per chi ha almeno 14 anni.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">
                Con la data inserita non possiamo farti entrare. Se hai
                sbagliato a scriverla, correggila qui sotto. Altrimenti puoi
                eliminare l&apos;account appena creato: non terremo nessun
                dato.
              </p>

              <div className="mt-8 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={switchToForm}
                  disabled={pending}
                  className="min-h-[48px] w-full"
                >
                  Correggi la data
                </Button>
                <button
                  type="button"
                  onClick={openConfirm}
                  disabled={pending}
                  aria-haspopup="dialog"
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-control text-base font-semibold text-[var(--danger)] transition-colors duration-150 hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Elimina il mio account
                </button>
              </div>
            </section>
          ) : (
            <section aria-labelledby="age-gate-title">
              <h1
                id="age-gate-title"
                className="text-display font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]"
              >
                La tua data di nascita
              </h1>
              <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">
                Per sapere chi può usare Drop-In: il servizio è per chi ha
                almeno 14 anni.
              </p>

              <form
                onSubmit={submitDate}
                noValidate
                aria-busy={pending}
                className="mt-8"
              >
                <label
                  htmlFor={BIRTH_DATE_ID}
                  className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]"
                >
                  Data di nascita
                </label>
                <Input
                  id={BIRTH_DATE_ID}
                  ref={inputRef}
                  type="date"
                  name="birthDate"
                  autoComplete="bday"
                  required
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setLocalError(null);
                  }}
                  disabled={pending}
                  aria-invalid={shownError ? "true" : undefined}
                  aria-describedby={shownError ? BIRTH_DATE_ERROR_ID : undefined}
                  className={cn(
                    "min-h-[52px] scheme-dark",
                    shownError && "border-[var(--danger)]"
                  )}
                />
                {shownError && (
                  <p
                    id={BIRTH_DATE_ERROR_ID}
                    role="alert"
                    className="mt-2 flex items-start gap-2 text-sm text-[var(--danger)]"
                  >
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 flex-none"
                      aria-hidden="true"
                    />
                    {shownError}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={pending}
                  className="mt-6 min-h-[48px] w-full"
                >
                  {pending ? "Verifica…" : "Continua"}
                </Button>

                {correcting && (
                  <button
                    type="button"
                    onClick={switchToBlocked}
                    disabled={pending}
                    className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-control text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    Indietro
                  </button>
                )}
              </form>
            </section>
          )}
        </div>
      </div>

      <Drawer
        open={confirmOpen}
        onClose={closeConfirm}
        title="Eliminare l'account?"
        description="L'account appena creato e i dati che hai inserito vengono cancellati per sempre. Non si può tornare indietro."
      >
        {deleteError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-control-sm bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger-dark)]"
          >
            {deleteError}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="danger"
            onClick={onDeleteAccount}
            disabled={pending}
            className="min-h-11 w-full"
          >
            {pending ? "Eliminazione…" : "Elimina account"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={closeConfirm}
            disabled={pending}
            className="min-h-11 w-full"
          >
            Annulla
          </Button>
        </div>
      </Drawer>
    </>
  );
}
