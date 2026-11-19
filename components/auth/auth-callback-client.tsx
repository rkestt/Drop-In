"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/routes";
import { NEW_PASSWORD_PATH } from "@/components/auth/new-password";
import { parseHashTokens } from "@/components/auth/hash-session";

/**
 * Ricevitore client del fragment `#access_token=...` (ticket 109).
 *
 * Solo i link NON-PKCE (inviti, `generateLink`) arrivano qui: il recupero
 * reale via `resetPasswordForEmail` usa il flusso code e resta sulla API
 * route. Entrambi atterrano poi su `/auth/nuova-password` con sessione.
 * Qualunque fallimento rimanda lì: senza sessione il gate mostra login +
 * avviso link scaduto. `next` passa da `safeNext`: niente open redirect.
 */
export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = safeNext(searchParams.get("next") ?? "/");
    const supabase = createClient();

    const done = (ok: boolean) => {
      router.replace(ok ? next : NEW_PASSWORD_PATH);
    };

    const run = async () => {
      try {
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          done(!error);
          return;
        }
        const tokens = parseHashTokens(window.location.hash);
        if (tokens) {
          // Il fragment non deve restare nella barra né in history: i token
          // si leggono prima di ripulire, poi parte la round-trip.
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
          const { error } = await supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });
          done(!error);
          return;
        }
        done(false);
      } catch {
        done(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
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
  );
}
