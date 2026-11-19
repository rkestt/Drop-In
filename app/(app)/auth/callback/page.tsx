import { Suspense } from "react";
import { AuthCallbackClient } from "@/components/auth/auth-callback-client";

export const dynamic = "force-dynamic";

/**
 * Ricevitore del fragment di sessione (ticket 109): i link email NON-PKCE
 * (inviti via Admin API, `generateLink`) tornano da verify con
 * `#access_token=...`, leggibile solo nel browser. Il client imposta la
 * sessione e rimbalza al `next`; il recupero PKCE resta sulla API route.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main
          id="contenuto"
          tabIndex={-1}
          className="flex-1 w-full max-w-[720px] mx-auto p-4 flex flex-col items-center justify-center gap-3"
          role="status"
          aria-live="polite"
        >
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            Accesso in corso…
          </p>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
