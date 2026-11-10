/**
 * Skip link "Vai al contenuto": nascosto finché non prende focus da tastiera.
 * Punta a `#contenuto` (il `main` di ogni pagina nei gruppi con nav).
 * Vedi `docs/design/accessibility.md` (Navigazione tastiera).
 */
export function SkipLink() {
  return (
    <a
      href="#contenuto"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control-sm focus:bg-[var(--accent)] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[var(--accent-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
    >
      Vai al contenuto
    </a>
  );
}
