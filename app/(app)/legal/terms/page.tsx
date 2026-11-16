import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Termini di servizio",
};

const UPDATED = "16 novembre 2026";

export default function TermsPage() {
  return (
    <LegalPage
      title="Termini di servizio"
      updated={UPDATED}
      intro="Regole d'uso di Drop-In, un'app per trovare campetti da strada, organizzare partite e condividere informazioni sui campi. Bozza tecnica: i punti [DA COMPILARE] vanno completati e validati prima della pubblicazione."
    >
      <LegalSection title="Chi siamo e cosa offriamo">
        <p>
          Drop-In è un servizio gratuito che mostra una mappa di campi sportivi
          (dati OpenStreetMap e proposte della community), permette di
          organizzare lobby, fare check-in sul posto e lasciare recensioni.
        </p>
        <p>
          Il servizio è offerto da [DA COMPILARE: titolare/gestore, indirizzo,
          contatti]. Fornendo il servizio tramite queste pagine, [DA COMPILARE:
          nome] accetta di essere il soggetto che conclude il contratto con
          l&apos;utente.
        </p>
      </LegalSection>

      <LegalSection title="Account">
        <p>
          Per le funzioni che richiedono un account servono un&apos;email valida
          e un nickname. Sei responsabile della riservatezza delle credenziali e
          di ciò che accade con il tuo account. Un account per persona: i
          duplicati possono essere rimossi.
        </p>
        <p>
          Puoi cancellare l&apos;account in ogni momento scrivendo a{" "}
          <a href="mailto:privacy@drop-in.app">privacy@drop-in.app</a>; la
          cancellazione self-service è in sviluppo. La cancellazione elimina
          profilo, check-in, recensioni, preferiti, notifiche e subscription
          push.
        </p>
      </LegalSection>

      <LegalSection title="Uso consentito">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Non usare il servizio per spam, pubblicità, contenuti illeciti,
            offensivi o che violino diritti altrui.
          </li>
          <li>
            Non caricare foto di persone identificabili senza il loro consenso,
            né foto non tue senza autorizzazione.
          </li>
          <li>
            Non automatizzare scritture (bot, script) per gonfiare karma,
            lobby, recensioni o proposte: il rate limit è tecnico, l&apos;abuso
            è una violazione contrattuale.
          </li>
          <li>
            Non tentare di aggirare i controlli di sicurezza, né accedere a dati
            di altri utenti.
          </li>
          <li>
            Rispetta i luoghi: i campi sono spazi pubblici o privati con regole
            proprie. Non invitiamo a entrare in proprietà private.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Contenuti che pubblichi">
        <p>
          Restano tuoi. Con la pubblicazione concedi a Drop-In una licenza non
          esclusiva, gratuita e limitata alla visualizzazione del contenuto
          nell&apos;app (mappa, schede campo, recensioni) e alle finalità di
          moderazione. Possiamo rimuovere contenuti che violano questi termini.
        </p>
        <p>
          Le foto dei campi e le proposte passano da una moderazione prima di
          essere visibili a tutti; dopo l&apos;approvazione la foto è congelata
          (non modificabile) salvo intervento della moderazione.
        </p>
      </LegalSection>

      <LegalSection title="Check-in, karma e lobby">
        <p>
          Il check-in richiede di essere fisicamente entro 50 metri dal campo
          (verifica GPS) e ha un cooldown di 5 minuti per campo. Se ti iscrivi a
          una lobby e non ti presenti al check-in, il karma scende (-3). Sotto
          50 punti l&apos;account è sospeso per 7 giorni. Queste regole servono a
          rendere affidabili le informazioni per tutti.
        </p>
        <p>
          Lobby e check-in sono strumenti organizzativi: non garantiscono la
          presenza di altri giocatori né la disponibilità del campo.
        </p>
      </LegalSection>

      <LegalSection title="Attività sportiva e responsabilità">
        <p>
          Drop-In non organizza eventi sportivi e non è un circolo: fornisce
          informazioni e strumenti. L&apos;attività sportiva comporta rischi
          (infortuni, danni a cose o persone) che restano a carico di chi la
          pratica. Nella misura consentita dalla legge, Drop-In non risponde di
          danni derivanti dall&apos;uso dei campi, da informazioni errate fornite
          dalla community o da comportamenti di altri utenti.
        </p>
        <p>
          Le informazioni sui campi (posizione, stato, sport) possono essere
          imprecise: verifica sul posto prima di spostarti.
        </p>
      </LegalSection>

      <LegalSection title="Sospensione e chiusura">
        <p>
          Possiamo sospendere o chiudere un account che viola questi termini, in
          particolare per spam, contenuti illeciti, abuso dei limiti tecnici o
          comportamenti che mettono a rischio altri utenti. Possiamo modificare
          o chiudere il servizio dandone avviso nell&apos;app quando possibile.
        </p>
      </LegalSection>

      <LegalSection title="Legge applicabile e foro">
        <p>
          Si applica la legge italiana. Per i consumatori il foro è quello del
          luogo di residenza o domicilio, se in Italia; negli altri casi
          [DA COMPILARE: foro competente]. Prima di procedere, scrivi a{" "}
          <a href="mailto:hello@drop-in.app">hello@drop-in.app</a>: quasi tutto
          si risolve parlando.
        </p>
      </LegalSection>

      <LegalSection title="Modifiche">
        <p>
          Possiamo aggiornare questi termini: la data in alto indica la versione
          vigente. Per modifiche sostanziali avvisiamo nell&apos;app con
          ragionevole anticipo.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
