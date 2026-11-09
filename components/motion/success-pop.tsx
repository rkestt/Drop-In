"use client";

import { motion } from "motion/react";
import { useStableReducedMotion } from "@/lib/motion/use-reduced-motion";
import { Check } from "lucide-react";
import { EASE, MOTION } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

interface SuccessPopProps {
  /** Cosa è successo, con l'effetto ("Check-in attivo fino alle 19:40"). */
  title: string;
  /** Dettaglio opzionale (scadenza, posti liberi, cosa succede ora). */
  description?: string;
  className?: string;
}

/**
 * Esito di successo di una pipeline: check + testo, colore `--success`.
 *
 * Una sola animazione, una sola volta al mount: il check scala in
 * `MOTION.success` (400ms) con curva elastica. Il testo è fermo e presente da
 * subito, anche con reduced motion (dove non si muove nulla): l'esito non è
 * mai affidato al solo movimento. `role="status"` lo annuncia agli screen
 * reader in entrambi i casi.
 */
export function SuccessPop({ title, description, className }: SuccessPopProps) {
  const reduceMotion = useStableReducedMotion();

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-control border border-[var(--success)]/30 bg-[var(--success)]/10 p-3",
        className
      )}
    >
      {reduceMotion ? (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-[var(--bg-base)]"
        >
          <Check className="h-5 w-5" />
        </span>
      ) : (
        <motion.span
          aria-hidden="true"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: MOTION.success, ease: [...EASE.elastic] }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-[var(--bg-base)]"
        >
          <Check className="h-5 w-5" />
        </motion.span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
    </div>
  );
}
