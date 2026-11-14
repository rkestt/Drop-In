import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

/**
 * Riga d'ingresso alla moderazione (#33). Montata solo per i moderatori:
 * il gate vero resta in `/admin`, questa è solo la scorciatoia.
 */
export function ModerationSection() {
  return (
    <section aria-labelledby="settings-moderation">
      <div className="flex items-center gap-2">
        <ShieldCheck
          className="h-4 w-4 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <h2
          id="settings-moderation"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          Moderazione
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="mt-2 rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
        <Link
          href="/admin"
          className="flex min-h-[56px] items-center gap-3 rounded-card px-4 py-3 text-[var(--text-primary)] no-underline transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:-outline-offset-2"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-semibold">
              Coda di moderazione
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Proposte in attesa e segnalazioni attive.
            </span>
          </span>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-[var(--text-muted)]"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}
