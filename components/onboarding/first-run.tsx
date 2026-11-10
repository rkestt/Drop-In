"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { StepTransition } from "@/components/motion/step-transition";
import { ONBOARDED_KEY, hasSeen, markSeen } from "@/lib/onboarding/storage";
import { cn } from "@/lib/utils";

/**
 * Primo avvio: drawer a 3 passi sopra la mappa, una volta sola, skippabile.
 * Copy, passi e gerarchia vincolati dal prototipo approvato d9
 * (`docs/design/prototypes/onboarding.html`). Nessuna route, nessun blocco:
 * chi chiude usa subito la mappa.
 *
 * Apertura: solo al primo mount se `dropin:onboarded:v1` non è impostata e il
 * drawer non è già stato chiuso in questa sessione. «Salta», l'ultimo passo,
 * Esc e tap fuori scrivono la chiave e chiudono (tutto passa da `onClose`).
 * Il cambio passo è uno swap di contenuto via `StepTransition`: istantaneo
 * con reduced motion, senza pop (l'informazione resta in testo e focus).
 *
 * Login (passo 3): «Accedi per salvare i progressi» chiude l'onboarding
 * (segnandolo come visto: l'utente ha letto i 3 passi) e apre il login in un
 * microtask. Niente modali a catena: due dialog modali impilati rubano il
 * focus e rompono il restore; il login apre da solo a drawer chiuso.
 *
 * Chiusura: il focus torna a `returnFocusRef` (il FAB "Aggiungi un campo")
 * invece che al `body` — al primo avvio niente aveva il focus e il restore di
 * default lo lascerebbe lì. Punta un controllo foglia stabile, non il
 * contenitore mappa: Base UI risolve un contenitore al primo figlio tabbabile
 * (canvas o select a seconda del caricamento: non deterministico). Il drawer
 * è modale, quindi alla chiusura l'utente non sta interagendo altrove:
 * nessun furto di focus.
 */

// Chiusura valida per la sessione anche quando localStorage non scrive
// (Safari privato): in quel caso il drawer si chiude e non blocca l'app.
let dismissedThisSession = false;

const STEPS = [
  {
    title: "Trova il campo più vicino",
    body: ["La mappa è il navigatore.", "Tocca un campo e vedi chi gioca."],
    cta: "Inizia",
  },
  {
    title: "Fai check-in quando arrivi",
    body: [
      "Check-in valido entro 50 m.",
      "Se non ti presenti a una lobby, perdi 3 punti karma.",
    ],
    cta: "Avanti",
  },
  {
    title: "Entra in una lobby o creane una",
    body: ["C'è già una partita? Entra.", "Non c'è? Aprine una."],
    cta: "Cerca un campo",
  },
] as const;

function stepSrLabel(index: number, current: number): string {
  const title = STEPS[index].title;
  if (index < current) return `Passo ${index + 1}, completato: ${title}`;
  if (index === current) return `Passo ${index + 1}, corrente: ${title}`;
  return `Passo ${index + 1}: ${title}`;
}

export function FirstRun({
  onLogin,
  returnFocusRef,
}: {
  /** Apre il login (es. il `LoginModal` della pagina): l'onboarding si chiude prima. */
  onLogin?: () => void;
  /** Controllo a cui restituire il focus alla chiusura (foglia stabile, es. FAB). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (dismissedThisSession) return;
    if (hasSeen(ONBOARDED_KEY)) return;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    dismissedThisSession = true;
    markSeen(ONBOARDED_KEY);
    setOpen(false);
  }, []);

  const goTo = useCallback((next: number) => {
    setStep(next);
  }, []);

  const handleLogin = useCallback(() => {
    if (!onLogin) return;
    close();
    // Il login apre a drawer chiuso, non sopra: niente modali a catena.
    queueMicrotask(() => onLogin());
  }, [close, onLogin]);

  // Il titolo riceve il focus a ogni apertura e cambio passo (screen reader);
  // non è un controllo: niente anello visivo (solo `outline-none` sul focus
  // programmatico, gli altri controlli mantengono il ring).
  useEffect(() => {
    if (open) titleRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  const current = STEPS[step];
  const titleId = `onb-title-${step}`;
  const bodyId = `onb-body-${step}`;

  return (
    <Drawer
      open={open}
      onClose={close}
      labelledBy={titleId}
      describedBy={bodyId}
      initialFocus={titleRef}
      finalFocus={returnFocusRef}
      className="max-h-[70dvh] overflow-y-auto"
    >
      <div className="flex items-center gap-2 min-h-[44px]">
        {step > 0 && (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            aria-label="Passo precedente"
            className="inline-flex items-center -ml-1.5 pr-1.5 min-h-[44px] text-sm text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            Indietro
          </button>
        )}
        <p className="text-[13px] font-semibold tracking-wide text-[var(--text-muted)]">
          Passo {step + 1} di 3
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Salta il primo avvio"
          className="ml-auto min-w-[44px] min-h-[44px] px-1 text-sm text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          Salta
        </button>
      </div>

      <ol className="flex gap-1.5 my-2 mb-4 p-0 list-none" aria-label="Passi del primo avvio">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex-1 h-1 rounded-chip",
              i < step && "bg-[var(--text-secondary)]",
              i === step && "bg-[var(--text-primary)]",
              i > step && "bg-[var(--border)]"
            )}
          >
            <span className="sr-only">{stepSrLabel(i, step)}</span>
          </li>
        ))}
      </ol>

      {/* Cambio passo istantaneo con reduced motion via StepTransition. */}
      <StepTransition stepKey={`step-${step}`}>
        <h2
          ref={titleRef}
          id={titleId}
          tabIndex={-1}
          className="m-0 mb-2 font-display text-display-sm font-bold leading-tight text-[var(--text-primary)] focus:outline-none"
        >
          {current.title}
        </h2>
        <div id={bodyId} className="flex flex-col gap-0.5 mb-5 text-base leading-normal text-[var(--text-secondary)]">
          {current.body.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => {
              if (step < STEPS.length - 1) goTo(step + 1);
              else close();
            }}
          >
            {current.cta}
          </Button>
          {step === STEPS.length - 1 && onLogin && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleLogin}
            >
              Accedi per salvare i progressi
            </Button>
          )}
        </div>
      </StepTransition>
    </Drawer>
  );
}
