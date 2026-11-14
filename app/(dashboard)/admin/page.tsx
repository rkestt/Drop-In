import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { ModerationPanel } from "@/components/moderation/moderation-panel";
import { ModerationBlocked } from "@/components/moderation/moderation-blocked";
import {
  fetchActiveReportGroups,
  fetchPendingCourts,
} from "@/lib/moderation/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Moderazione",
};

/**
 * /admin (#33) — coda proposte e segnalazioni attive.
 *
 * Gate in due passi, entrambi server-side: senza sessione si torna al login
 * (stesso fail-open delle altre pagine dashboard), con sessione ma senza
 * `profiles.is_moderator` si vede lo stato "Non hai i permessi". Le RPC di
 * moderazione si autoproteggono comunque (42501) e il pannello mostra il
 * messaggio del server senza ritentare.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect(loginRedirectUrl("/admin", ""));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_moderator")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return (
      <ModerationBlocked
        title="Permessi non verificabili"
        body="Non riusciamo a controllare il tuo ruolo in questo momento. Riprova tra poco."
        actionHref="/admin"
        actionLabel="Riprova"
      />
    );
  }

  if (profile?.is_moderator !== true) {
    return (
      <ModerationBlocked
        title="Non hai i permessi"
        body="Questa pagina è riservata ai moderatori. Il tuo account non ha ancora l'accesso."
      />
    );
  }

  const [queue, reports] = await Promise.all([
    fetchPendingCourts(supabase),
    fetchActiveReportGroups(supabase),
  ]);

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="mx-auto w-full max-w-[720px] flex-1 space-y-5 p-4 pb-8"
    >
      <header className="space-y-1">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)]">
          Moderazione
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Approva o rifiuta le proposte di campi. Le segnalazioni restano in
          sola lettura.
        </p>
      </header>
      <ModerationPanel
        initialCourts={queue.items}
        initialQueueError={queue.error}
        initialReportGroups={reports.groups}
        initialReportsError={reports.error}
      />
    </main>
  );
}
