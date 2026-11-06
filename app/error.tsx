"use client";
import { useEffect } from "react";
import { createLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
const log = createLogger("error-boundary");
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { try { log.error(error); } catch {} }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Si è verificato un errore</h2>
      <p className="text-sm text-[var(--text-secondary)]">Riprova o ricarica la pagina.</p>
      <Button variant="primary" onClick={reset}>Riprova</Button>
    </div>
  );
}
