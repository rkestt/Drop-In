"use client";

import { useEffect, useState } from "react";

/**
 * `prefers-reduced-motion: reduce` stabile per le primitive di pipeline.
 *
 * Perché non `useReducedMotion()` di Motion: quell'hook fotografa il valore al
 * primo render (in SSR è sempre `false`) e non si aggiorna mai più — la pagina
 * idratata resterebbe sul ramo animato anche con reduced motion, e Motion
 * congela i transform a metà (il check del SuccessPop resta a `scale(0)`).
 *
 * Qui invece: primo render sempre statico (nessun mismatch di idratazione,
 * nessun flash animato), poi `matchMedia` reale + listener sul cambio.
 */
export function useStableReducedMotion(): boolean {
  // SSR e prima hydration: ramo statico. L'effetto corregge subito dopo.
  const [reduce, setReduce] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduce(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduce;
}
