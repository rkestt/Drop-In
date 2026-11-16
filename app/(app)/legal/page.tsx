import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LEGAL_DOCUMENTS } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Documenti legali",
};

export default function LegalIndexPage() {
  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6 pb-24"
    >
      <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
        Documenti legali
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
        Drop-In è un progetto indipendente: qui trovi le regole d&apos;uso e come
        trattiamo i dati. Il testo è in bozza e sarà rivisto prima
        dell&apos;apertura al pubblico.
      </p>

      <div className="mt-6 overflow-hidden rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
        {LEGAL_DOCUMENTS.map((doc, index) => (
          <div key={doc.href}>
            {index > 0 && (
              <div aria-hidden="true" className="mx-4 h-px bg-[var(--border)]" />
            )}
            <Link
              href={doc.href}
              className="flex min-h-[56px] items-start gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-semibold text-[var(--text-primary)]">
                  {doc.title}
                </span>
                <span className="text-sm text-[var(--text-secondary)]">
                  {doc.description}
                </span>
              </span>
              <ChevronRight
                className="mt-1 h-4 w-4 flex-none text-[var(--text-muted)]"
                aria-hidden="true"
              />
            </Link>
          </div>
        ))}
      </div>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
          I tuoi diritti, in pratica
        </h2>
        <p>
          Per accedere ai tuoi dati, correggerli, esportarli o cancellare
          l&apos;account scrivi a{" "}
          <a
            className="text-[var(--accent)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            href="mailto:privacy@drop-in.app"
          >
            privacy@drop-in.app
          </a>
          . Rispondiamo entro 30 giorni. L&apos;export e la cancellazione
          self-service sono in arrivo: fino ad allora la richiesta è gestita a
          mano, con verifica dell&apos;identità.
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Titolare del trattamento: [DA COMPILARE: nome e cognome / ragione
          sociale, indirizzo, P. IVA se applicabile]. Contatto privacy: [DA
          CONFERMARE] privacy@drop-in.app.
        </p>
      </section>
    </main>
  );
}
