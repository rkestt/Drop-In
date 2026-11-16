import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Cookie e memorizzazione locale",
};

const UPDATED = "16 novembre 2026";

/**
 * Cookie policy: oggi l'app non usa cookie di tracciamento, quindi non c'è
 * banner. La pagina elenca i cookie tecnici reali (Supabase auth) e le chiavi
 * localStorage (onboarding, coach, outbox) — che non sono cookie ma vanno
 * spiegati. Se arriva un analytics, questa pagina e il banner diventano
 * obbligatori: il punto di aggancio è documentato in docs/legal/README.md.
 */
export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie e memorizzazione locale"
      updated={UPDATED}
      intro="Drop-In usa solo cookie tecnici necessari all'accesso e alla memoria offline. Nessun cookie pubblicitario, nessun tracciamento tra siti: per questo non vedi un banner di consenso."
    >
      <LegalSection title="Cookie tecnici">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-[var(--text-primary)]">
              Sessione di autenticazione
            </strong>{" "}
            (Supabase Auth, `sb-…-auth-token`): conserva la sessione dopo il
            login, cookie httpOnly con durata della sessione/refresh token.
            Senza, l&apos;accesso non funziona.
          </li>
        </ul>
        <p>
          I cookie tecnici non richiedono consenso (art. 122 Codice privacy,
          linee guida Garante). Non ne impostiamo altri.
        </p>
      </LegalSection>

      <LegalSection title="Memorizzazione locale (non cookie)">
        <p>
          Alcune preferenze restano nel `localStorage` del browser e non vengono
          inviate ai server finché non usi la funzione corrispondente:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>`dropin:onboarded:v1` — hai già visto il primo avvio.</li>
          <li>`dropin:coach:*` — suggerimenti già chiusi.</li>
          <li>
            `dropin:outbox:v1` — azioni fatte offline (check-in, join a lobby) in
            attesa di connessione; scadono dopo 2 ore e vengono inviate a
            `online`.
          </li>
          <li>
            Preferenze di notifiche/push e stato dell&apos;installazione PWA.
          </li>
        </ul>
        <p>
          Puoi cancellarle in ogni momento dalle impostazioni del browser: la
          app funziona lo stesso, perdi solo le preferenze e le azioni in coda.
        </p>
      </LegalSection>

      <LegalSection title="Terze parti">
        <p>
          La mappa carica tile da OpenFreeMap (o OpenStreetMap in fallback): il
          browser invia a quei server l&apos;IP e l&apos;area visualizzata, come
          per qualunque immagine esterna. Non incorporiamo pulsanti social,
          pixel di tracciamento o iframe pubblicitari.
        </p>
      </LegalSection>

      <LegalSection title="Se un giorno aggiungiamo analytics">
        <p>
          Servirà un tuo consenso preventivo (banner con rifiuto facile quanto
          l&apos;accettazione) e questa pagina andrà aggiornata prima del
          rilascio. La decisione sullo stack analytics è tracciata in
          `docs/observability.md` (#9) e al momento esclude qualunque
          tracciamento.
        </p>
      </LegalSection>

      <LegalSection title="Domande">
        <p>
          Scrivici a{" "}
          <a href="mailto:privacy@drop-in.app">privacy@drop-in.app</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
