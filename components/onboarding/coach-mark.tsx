"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coachKey, hasSeen, markSeen } from "@/lib/onboarding/storage";

/**
 * Coach mark contestuale: una volta sola per feature, sopra il contenuto che
 * spiega senza coprirlo (sta nel flusso, prima dei children). Si chiude con
 * «Ho capito», con la X o con Esc; chiuso non torna. Copy vincolato dal
 * prototipo approvato d9.
 */

// Come in FirstRun: se localStorage non scrive (Safari privato) la chiusura
// resta valida per la sessione, così il coach non riappare a ogni scheda.
const dismissedThisSession = new Set<string>();
export function CoachMark({
  feature,
  children,
}: {
  feature: string;
  children: React.ReactNode;
}) {
  const key = coachKey(feature);
  const [visible, setVisible] = useState(false);
  const titleRef = useRef<HTMLParagraphElement | null>(null);
  const childRef = useRef<HTMLDivElement | null>(null);

  // Dopo il primo render: solo la prima volta per questa feature.
  useEffect(() => {
    if (dismissedThisSession.has(key)) return;
    if (!hasSeen(key)) setVisible(true);
  }, [key]);

  useEffect(() => {
    if (visible) titleRef.current?.focus({ preventScroll: true });
  }, [visible]);

  const dismiss = useCallback(() => {
    dismissedThisSession.add(key);
    markSeen(key);
    setVisible(false);
    // Il focus torna sul controllo spiegato, non si perde nella pagina.
    childRef.current
      ?.querySelector<HTMLElement>("button, a[href]")
      ?.focus({ preventScroll: true });
  }, [key]);

  const titleId = `coach-${feature}-title`;

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape" && visible) {
          e.stopPropagation();
          dismiss();
        }
      }}
    >
      {visible && (
        <div
          role="note"
          aria-labelledby={titleId}
          className="flex flex-col gap-1.5 mb-3 p-3.5 pb-2.5 border border-[var(--border-strong)] rounded-card bg-[var(--bg-surface)]"
        >
          <p className="m-0 text-label font-bold uppercase tracking-widest text-[var(--accent)]">
            Suggerimento
          </p>
          <p
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="m-0 text-base font-semibold leading-snug text-[var(--text-primary)] focus:outline-none"
          >
            Fai check-in qui quando arrivi
          </p>
          <p className="m-0 text-sm leading-normal text-[var(--text-secondary)]">
            Il GPS ti conferma a meno di 50&nbsp;m.
          </p>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <Button size="sm" variant="secondary" onClick={dismiss}>
              Ho capito
            </Button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Chiudi il suggerimento"
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-0 border-0 rounded-control bg-transparent text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              <X className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      <div ref={childRef}>{children}</div>
    </div>
  );
}
