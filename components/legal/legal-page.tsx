import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Impaginazione comune delle pagine legali (#83).
 *
 * Un solo punto per tipografia, spaziature e link "indietro": le pagine
 * contengono solo il testo. I titoli interni usano `<h2>` (l'`h1` è il titolo
 * della pagina), i paragrafi stanno a `text-sm` con `leading-relaxed` per la
 * lettura lunga su 360px.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6 pb-24"
    >
      <Link
        href="/legal"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control-sm text-sm font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Documenti legali
      </Link>

      <h1 className="mt-2 text-3xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
        {title}
      </h1>
      <p className="mt-1 text-xs uppercase tracking-wider text-[var(--text-muted)]">
        Ultimo aggiornamento: {updated}
      </p>

      {intro && (
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          {intro}
        </p>
      )}

      <div className="mt-6 space-y-8">{children}</div>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`sezione-${slug(title)}`}>
      <h2
        id={`sezione-${slug(title)}`}
        className="text-lg font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)]"
      >
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        {children}
      </div>
    </section>
  );
}

/** Slug stabile per gli id di sezione (titoli italiani, niente accenti). */
export function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Link legali riusati in Impostazioni e nell'indice. */
export const LEGAL_DOCUMENTS = [
  {
    href: "/legal/privacy",
    title: "Informativa privacy",
    description: "Quali dati trattiamo, perché, per quanto tempo e i tuoi diritti.",
  },
  {
    href: "/legal/terms",
    title: "Termini di servizio",
    description: "Regole d'uso di Drop-In: account, contenuti, moderazione, responsabilità.",
  },
  {
    href: "/legal/cookies",
    title: "Cookie e memorizzazione locale",
    description: "Cosa salviamo nel browser: solo cookie tecnici, nessun tracciamento.",
  },
] as const;
