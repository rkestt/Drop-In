import { cssTokenColor } from "./icons";
import type { CourtPalette } from "./court-features";

/**
 * MapLibre non risolve le CSS custom property: i layer ricevono valori
 * concreti. La palette si legge una volta dal tema (tema unico, mai toggle)
 * e si passa a `buildCourtLayers`. Fallback a nomi di colore CSS, mai hex:
 * `lint:design` scansiona lib/ e components/.
 */
export function readCourtPalette(): CourtPalette {
  return {
    accent: cssTokenColor("--accent", "green"),
    accentHover: cssTokenColor("--accent-hover", "limegreen"),
    accentForeground: cssTokenColor("--accent-foreground", "black"),
    danger: cssTokenColor("--danger", "red"),
    dangerForeground: cssTokenColor("--danger-foreground", "black"),
    bgElevated: cssTokenColor("--bg-elevated", "dimgray"),
    textPrimary: cssTokenColor("--text-primary", "white"),
  };
}
