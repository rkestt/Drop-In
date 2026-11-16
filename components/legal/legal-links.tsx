import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { LEGAL_DOCUMENTS } from "@/components/legal/legal-page";

/** Riga "Documenti legali" per Impostazioni, con i tre documenti. */
export function LegalLinks() {
  return (
    <section aria-labelledby="settings-legal">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
        <h2
          id="settings-legal"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          Legale
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="mt-2 overflow-hidden rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
        {LEGAL_DOCUMENTS.map((doc, index) => (
          <div key={doc.href}>
            {index > 0 && <div aria-hidden="true" className="mx-4 h-px bg-[var(--border)]" />}
            <Link
              href={doc.href}
              className="flex min-h-[56px] items-center gap-3 px-4 py-3 text-base font-semibold text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="flex-1">{doc.title}</span>
              <ChevronRight
                className="h-4 w-4 flex-none text-[var(--text-muted)]"
                aria-hidden="true"
              />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
