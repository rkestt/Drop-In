/**
 * Durate e curve del motion per le pipeline, in unità JS.
 *
 * I valori rispecchiano i token CSS in `app/globals.css`: le durate vivono in
 * `:root` (`--motion-*`, millisecondi), le curve in `@theme` (`--ease-*`,
 * `cubic-bezier(...)`). Il test `tests/unit/motion-tokens.test.ts` fallisce se
 * i due mondi divergono: per cambiare un ritmo si cambia il token CSS e poi
 * questo file, mai un numero sparso nei componenti.
 *
 * Le durate sono in secondi perché Motion (`motion/react`) ragiona in secondi;
 * le curve sono array `[x1, y1, x2, y2]` passabili a `transition.ease`.
 */

// prettier-ignore
export const MOTION = {
  /** Press / hover / cambio di colore — `--motion-fast: 150ms`. */
  fast: 0.15,
  /** Cambio di stato, comparsa breve, uscita di uno step — `--motion-base: 200ms`. */
  base: 0.2,
  /** Ingresso di uno step — `--motion-slow: 250ms`. */
  slow: 0.25,
  /** Pop di conferma — `--motion-success: 400ms`. */
  success: 0.4,
} as const;

export type MotionDuration = (typeof MOTION)[keyof typeof MOTION];

type Bezier = readonly [number, number, number, number];

// prettier-ignore
export const EASE = {
  /** Fade, slide, press: la curva normale — `--ease-standard`. */
  standard: [0.25, 1, 0.5, 1] as Bezier,
  /** Solo pop e scale — `--ease-elastic`. */
  elastic: [0.34, 1.56, 0.64, 1] as Bezier,
} as const;
