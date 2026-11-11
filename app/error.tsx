"use client";
import { useEffect } from "react";
import Link from "next/link";
import { createLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";

const log = createLogger("error-boundary");

// d24, stato 07 del prototipo: gerarchia e copy approvati.
// L'offline non è un errore di rete gestito qui: stesso schermo,
// un solo next step primario (Riprova).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { try { log.error(error); } catch {} }, [error]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div role="alert" className="flex w-full max-w-md flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--danger)] text-xl font-bold text-[var(--danger-dark)]"
        >
          !
        </span>
        <h1 className="text-display-sm font-bold text-[var(--text-primary)]">
          Non riusciamo a caricare questa pagina.
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          La connessione è caduta mentre caricavamo i campi. Quelli che hai
          già aperto restano sul telefono.
        </p>
        <Button variant="primary" className="w-full" onClick={reset}>
          Riprova
        </Button>
        <Link href="/" className="w-full">
          <Button variant="secondary" className="w-full">
            Torna alla mappa
          </Button>
        </Link>
        {error.digest && (
          <p className="text-xs text-[var(--text-muted)]">
            Errore {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
