"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStableReducedMotion } from "@/lib/motion/use-reduced-motion";
import { EASE, MOTION } from "@/lib/motion/tokens";

interface StepTransitionProps {
  /** Identifica lo step visibile: al cambio, il vecchio esce e il nuovo entra. */
  stepKey: string;
  children: React.ReactNode;
  className?: string;
}

const standardEase = [...EASE.standard] as [number, number, number, number];

/**
 * Transizione di step per le pipeline (una sola animazione per cambio di stato).
 *
 * Il nuovo step entra in `MOTION.slow` (250ms), il precedente esce in
 * `MOTION.base` (200ms) fuori dal flusso (`popLayout`: nessun salto di layout
 * mentre i due coesistono). L'input non è mai bloccato: un tap durante
 * l'animazione vince perché niente disabilita i controlli.
 *
 * Con reduced motion non si muove nulla: stesso contenuto, nessun transform
 * inline (Motion scriverebbe `transform` anche con la media query CSS, quindi
 * il ramo statico qui non è ridondante; vedi `useStableReducedMotion`).
 */
export function StepTransition({ stepKey, children, className }: StepTransitionProps) {
  const reduceMotion = useStableReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={stepKey}
        className={className}
        initial="enter"
        animate="center"
        exit="exit"
        variants={{
          enter: {
            opacity: 0,
            y: 12,
            transition: { duration: MOTION.slow, ease: standardEase },
          },
          center: {
            opacity: 1,
            y: 0,
            transition: { duration: MOTION.slow, ease: standardEase },
          },
          exit: {
            opacity: 0,
            y: -8,
            transition: { duration: MOTION.base, ease: standardEase },
          },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
