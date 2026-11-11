"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useStableReducedMotion } from "@/lib/motion/use-reduced-motion";
import { EASE, MOTION } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

interface NextHighlightProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Highlight del prossimo controllo (o dello stato appena conquistato): un ring
 * accent persistente che sfuma alla prima interazione.
 *
 * Il ring è solo CSS (token `--accent`, mai `--danger`/`--success`: non è un
 * errore né una conferma); a sparire è l'opacità di un velo dedicato, in
 * `MOTION.base` (200ms). Il contenuto sotto non si muove mai. Alla prima
 * interazione — tap, click o focus — l'highlight si spegne e resta spento
 * (stato locale, non un loop).
 *
 * Con reduced motion il velo è statico: appare e sparisce di colpo, e
 * l'informazione resta nel testo e nel colore del contenuto.
 */
export function NextHighlight({ children, className }: NextHighlightProps) {
  const reduceMotion = useStableReducedMotion();
  const [dismissed, setDismissed] = React.useState(false);
  const dismiss = React.useCallback(() => setDismissed(true), []);

  const ringClassName =
    "pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-base)]";

  return (
    <div
      data-highlight={dismissed ? "off" : "on"}
      onPointerDown={dismiss}
      onClick={dismiss}
      onFocusCapture={dismiss}
      className={cn("relative", className)}
    >
      {children}
      {reduceMotion ? (
        !dismissed && <span aria-hidden="true" className={ringClassName} />
      ) : (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ opacity: dismissed ? 0 : 1 }}
          transition={{ duration: MOTION.base, ease: [...EASE.standard] }}
          className={ringClassName}
        />
      )}
    </div>
  );
}
