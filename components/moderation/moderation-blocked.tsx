import Link from "next/link";
import { ShieldOff } from "lucide-react";

interface ModerationBlockedProps {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}

/**
 * Stato senza permessi della pagina /admin (#33): un moderatore mancante o
 * un controllo permessi fallito non devono mai produrre una pagina rotta.
 * Nessuna CTA accent: qui non c'è nulla da confermare, solo da tornare.
 */
export function ModerationBlocked({
  title,
  body,
  actionHref = "/",
  actionLabel = "Torna alla mappa",
}: ModerationBlockedProps) {
  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <ShieldOff
        className="h-8 w-8 text-[var(--text-muted)]"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-bold font-[family-name:var(--font-syne)]">
        {title}
      </h1>
      <p className="max-w-[46ch] text-sm text-[var(--text-secondary)]">
        {body}
      </p>
      <Link
        href={actionHref}
        className="mt-1 inline-flex min-h-[44px] items-center font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        {actionLabel}
      </Link>
    </main>
  );
}
