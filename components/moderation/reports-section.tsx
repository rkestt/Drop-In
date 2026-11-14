import Link from "next/link";
import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReportCourtGroup } from "@/lib/moderation/queue";

interface ReportsSectionProps {
  groups: ReportCourtGroup[];
  error: boolean;
  loading: boolean;
  onRetry: () => void;
}

/**
 * Segnalazioni attive raggruppate per campo (#33). Sola lettura per scelta:
 * nessuna azione di chiusura, scadono da sole dopo 48 ore. Riga intera con
 * nome-link al campo, badge col conteggio e categorie distinte.
 */
export function ReportsSection({
  groups,
  error,
  loading,
  onRetry,
}: ReportsSectionProps) {
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-card border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4"
      >
        <p className="text-sm font-semibold text-[var(--danger-dark)]">
          Non riusciamo a caricare le segnalazioni.
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Controlla la connessione e riprova.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRetry}
          disabled={loading}
          className="mt-3"
        >
          {loading ? "Caricamento…" : "Riprova"}
        </Button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
        <Flag
          className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--text-secondary)]">
          Nessuna segnalazione attiva.
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Compaiono qui quando qualcuno segnala un campo e scadono da sole
          dopo 48 ore.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        Sola lettura: ogni segnalazione scade da sola dopo 48 ore.
      </p>
      <ul className="space-y-2">
        {groups.map((group) => (
          <li
            key={group.courtId}
            className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              {group.courtHref ? (
                <Link
                  href={group.courtHref}
                  className="min-w-0 flex-1 font-semibold text-[var(--text-primary)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  {group.courtName}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 font-semibold text-[var(--text-primary)]">
                  {group.courtName}
                </span>
              )}
              <Badge variant="warning" className="shrink-0">
                {group.count === 1 ? "1 segnalazione" : `${group.count} segnalazioni`}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              {group.categories.join(" · ")}
            </p>
            {group.latestExpiryLabel && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Si svuota entro il {group.latestExpiryLabel}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
