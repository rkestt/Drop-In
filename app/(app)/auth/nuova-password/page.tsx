import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { NEW_PASSWORD_PATH } from "@/components/auth/new-password";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const dynamic = "force-dynamic";

/**
 * Schermata nuova password (ticket 109): atterraggio dalle email di
 * recupero e di invito, copy neutro per entrambi ("Scegli la password").
 *
 * Gate di sessione: senza sessione (link scaduto, già usato o URL digitato
 * a mano) niente form — redirect a `/` con apertura del login, da dove il
 * link "Password dimenticata?" emette un nuovo link. Con sessione normale
 * il form cambia solo la propria password via `updateUser`: nessun dato
 * altrui è raggiungibile, quindi nessun buco.
 */
export default async function NewPasswordPage() {
  const supabase = await createClient();
  // Fail open come il profilo: errore di rete = sessione ignota, quindi
  // rimando al login invece di un 500.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect(loginRedirectUrl(NEW_PASSWORD_PATH, ""));
  }

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="flex-1 w-full max-w-[720px] mx-auto p-4 flex flex-col gap-3.5"
    >
      <h1 className="font-display text-2xl font-bold m-0">
        Scegli la password
      </h1>
      <p className="m-0 text-sm leading-snug text-[var(--text-secondary)]">
        Imposta la password del tuo account Drop-In: vale sia se la stai
        cambiando sia se è la prima volta. Puoi farlo anche dopo, dalla
        schermata di accesso.
      </p>

      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <NewPasswordForm />
      </div>

      <Link
        href="/"
        className="inline-flex min-h-[44px] items-center justify-center rounded-control px-6 text-base font-semibold text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        Torna alla mappa
      </Link>
    </main>
  );
}
