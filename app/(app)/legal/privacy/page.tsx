import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Informativa privacy",
};

const UPDATED = "16 novembre 2026";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Informativa privacy"
      updated={UPDATED}
      intro="Questa informativa descrive come Drop-In raccoglie e usa i dati personali, ai sensi degli articoli 13 e 14 del Regolamento UE 2016/679 (GDPR). È una bozza tecnica: i punti segnati [DA COMPILARE] vanno completati e validati prima della pubblicazione."
    >
      <LegalSection title="Titolare del trattamento">
        <p>
          [DA COMPILARE: nome e cognome o ragione sociale del titolare,
          indirizzo, codice fiscale/P. IVA, email di contatto]. Per qualsiasi
          richiesta:{" "}
          <a href="mailto:privacy@drop-in.app">privacy@drop-in.app</a>.
        </p>
        <p>
          Non è nominato un Responsabile della protezione dei dati (DPO): la
          valutazione va confermata dal legale in base ai criteri dell&apos;art.
          37 GDPR.
        </p>
      </LegalSection>

      <LegalSection title="Quali dati trattiamo">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-[var(--text-primary)]">Account:</strong>{" "}
            indirizzo email, password (salvata come hash da Supabase Auth),
            eventuale identità Google (nome, email, foto profilo forniti da
            Google), nickname e avatar scelti da te.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">
              Posizione (solo al check-in):
            </strong>{" "}
            latitudine, longitudine e precisione del GPS nel momento in cui premi
            &quot;Check-in&quot;. La posizione non è tracciata in continuo: viene
            letta dal browser solo su tua azione e serve a verificare che tu sia
            entro 50 metri dal campo.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Attività:</strong>{" "}
            check-in e storico, karma, partecipazione alle lobby, preferiti,
            segnalazioni sui campi, recensioni (stelle e testo), campi proposti
            (nome, coordinate, indirizzo, foto).
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Notifiche push:</strong>{" "}
            endpoint del browser e chiavi del dispositivo, solo se attivi le
            notifiche.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Dati tecnici:</strong>{" "}
            indirizzo IP e log di piattaforma gestiti dai fornitori (Vercel,
            Supabase) per sicurezza e diagnostica, conservati per il tempo
            minimo previsto dai piani.
          </li>
        </ul>
        <p>
          Non raccogliamo categorie particolari di dati (art. 9 GDPR), non
          facciamo profilazione pubblicitaria e non usiamo cookie di
          tracciamento.
        </p>
      </LegalSection>

      <LegalSection title="Finalità e basi giuridiche">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-[var(--text-primary)]">Erogare il servizio</strong>{" "}
            (account, mappa, check-in, lobby, recensioni, preferiti): art. 6.1.b
            GDPR, esecuzione del contratto.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">
              Sicurezza e anti-abuso
            </strong>{" "}
            (rate limit, karma, moderazione delle proposte e delle foto,
            segnalazioni): art. 6.1.f, legittimo interesse a mantenere il
            servizio utilizzabile e sicuro.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Notifiche push</strong>:
            art. 6.1.a, consenso, revocabile in ogni momento dalle impostazioni
            del browser o dell&apos;app.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Obblighi di legge</strong>{" "}
            (es. richieste dell&apos;autorità): art. 6.1.c.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Per quanto tempo">
        <ul className="list-disc space-y-2 pl-5">
          <li>Dati dell&apos;account: fino alla cancellazione dell&apos;account.</li>
          <li>
            Check-in e storico karma: fino alla cancellazione dell&apos;account
            (servono a calcolare il karma e a mostrare la tua attività). Il
            check-in attivo si chiude automaticamente dopo 2 ore.
          </li>
          <li>
            Segnalazioni sui campi: 48 ore, poi vengono eliminate
            automaticamente.
          </li>
          <li>
            Proposte di campi e recensioni: fino alla cancellazione
            dell&apos;account o alla rimozione da parte della moderazione.
          </li>
          <li>
            Log tecnici: secondo la retention dei fornitori (oggi circa 1 giorno
            sui piani free di Vercel e Supabase).
          </li>
          <li>
            Backup: i dump del database sono conservati al massimo 90 giorni e
            usati solo per ripristino.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="A chi sono comunicati">
        <p>
          I dati non sono venduti né ceduti per finalità di marketing. Sono
          trattati da fornitori che agiscono come responsabili del trattamento
          (art. 28 GDPR), con Data Processing Agreement:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-[var(--text-primary)]">Supabase</strong>:
            database, autenticazione, storage delle foto.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Vercel</strong>:
            hosting dell&apos;applicazione e log.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Provider email</strong>{" "}
            (per conferma account e reset password): [DA CONFERMARE: Resend /
            Brevo, con regione di trattamento].
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Google</strong>, solo
            se scegli di accedere con Google (autenticazione OAuth).
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">OpenFreeMap /
            OpenStreetMap</strong>: ricevono le richieste dei tile della mappa
            (IP e area visualizzata), non i tuoi dati di account.
          </li>
        </ul>
        <p>
          Eventuali trasferimenti fuori dallo Spazio Economico Europeo avvengono
          sulla base delle clausole contrattuali standard della Commissione UE
          (art. 46 GDPR). [DA CONFERMARE: regioni effettive dei progetti
          Supabase/Vercel.]
        </p>
      </LegalSection>

      <LegalSection title="I tuoi diritti">
        <p>
          Puoi chiedere accesso, rettifica, cancellazione, limitazione,
          portabilità e opposizione al trattamento (artt. 15–21 GDPR). Scrivi a{" "}
          <a href="mailto:privacy@drop-in.app">privacy@drop-in.app</a>: rispondiamo
          entro 30 giorni. Puoi proporre reclamo al Garante per la protezione
          dei dati personali (
          <a
            href="https://www.garanteprivacy.it"
            target="_blank"
            rel="noreferrer"
          >
            garanteprivacy.it
          </a>
          ).
        </p>
        <p>
          Oggi export e cancellazione sono gestiti manualmente: verificata
          l&apos;identità, esportiamo i dati in JSON e cancelliamo l&apos;account
          (che elimina a cascata profilo, check-in, recensioni, preferiti,
          notifiche e subscription push). L&apos;eliminazione self-service è in
          sviluppo.
        </p>
      </LegalSection>

      <LegalSection title="Età minima">
        <p>
          [DA COMPILARE: definire l&apos;età minima]. In Italia il consenso
          digitale autonomo parte dai 14 anni (art. 2-quinquies Codice
          privacy); sotto quella soglia serve il consenso di chi esercita la
          responsabilità genitoriale.
        </p>
      </LegalSection>

      <LegalSection title="Sicurezza">
        <p>
          Accesso ai dati tramite RLS su ogni tabella, grant minimi, rate limit
          per utente, foto e proposte visibili solo dopo moderazione, password
          gestite da Supabase Auth (hash), sessioni in cookie httpOnly. Nessun
          sistema è sicuro al 100%: per segnalare una vulnerabilità scrivi a{" "}
          <a href="mailto:security@drop-in.app">security@drop-in.app</a>.
        </p>
      </LegalSection>

      <LegalSection title="Modifiche">
        <p>
          Se cambiamo questa informativa aggiorniamo la data in alto e, per
          modifiche sostanziali, avvisiamo nell&apos;app. La versione vigente è
          sempre questa pagina.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
