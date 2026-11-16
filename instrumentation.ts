/**
 * Hook di startup del server Next (#32/#88).
 *
 * `register()` gira una volta per processo, prima che l'app serva richieste:
 * e' il posto giusto per una riga di boot strutturata (env, release, host
 * backend) e per validare l'ambiente senza far esplodere il server.
 *
 * Non inizializza Sentry di proposito: decisione tracciata in
 * `docs/observability.md` (bundle, costo, PII). Error boundary + log
 * strutturati coprono il bisogno attuale.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { logEvent } = await import("@/lib/observability/structured");
    const { supabaseUrlHost } = await import("@/lib/logger");
    const { APP_VERSION } = await import("@/lib/app-info");

    logEvent({
      level: "info",
      event: "server.boot",
      fields: {
        version: APP_VERSION,
        node_env: process.env.NODE_ENV ?? "unknown",
        vercel_env: process.env.VERCEL_ENV ?? "local",
        // Mai la chiave: solo host/ref.
        supabase: supabaseUrlHost(process.env.NEXT_PUBLIC_SUPABASE_URL),
        log_level: process.env.LOG_LEVEL ?? "default",
      },
    });
  } catch (error) {
    // Un log di boot non deve impedire l'avvio del server.
    console.warn(
      "[observability] boot log non emesso:",
      error instanceof Error ? error.message : "errore sconosciuto"
    );
  }
}
