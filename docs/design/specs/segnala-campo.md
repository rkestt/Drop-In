# Spec — Segnala un campo

## Obiettivo

Segnalare un problema temporaneo di un campo (canestro rotto, campo bagnato…)
in modo che resti visibile 48 ore e non sia confuso con una recensione.

## Stati

- **Form.** Titolo "Segnala un campo", nome campo, lead "Vale per le prossime
  48 ore: non è una recensione del campo." Chip categoria (una sola scelta),
  textarea "Dettagli (facoltativo)" con contatore N/280. CTA "Invia
  segnalazione" **sempre attiva anche a form vuoto** (scelta approvata
  2026-11-10); "Annulla" chiude. Drawer: backdrop, Esc, Annulla = chiudi.
- **Errore di validazione.** Senza categoria: "Scegli cosa non va" (`role=alert`,
  focus sul gruppo). Testo > 280: "Accorcia il testo a 280 caratteri."
  (`role=alert`). CTA resta attiva.
- **Invio.** Chip disabilitate, textarea readonly, CTA disabilitata con spinner
  e "Invio…", `aria-busy` sul contenuto.
- **Inviato.** Drawer chiuso, toast Sonner "Segnalazione inviata" con
  descrizione "Resta attiva fino al {data/ora reale}."; la scheda campo mostra
  la nuova riga in "Segnalazioni attive". Nessuna chiusura a tempo, nessun
  messaggio generico.
- **Già segnalato.** Se l'utente ha una segnalazione attiva sullo stesso campo,
  il drawer mostra la lista delle attive (la propria con badge "Tua" + scadenza
  reale) e il notice "Hai già segnalato questo campo / Puoi inviarne un'altra
  quando la tua scade."; solo "Chiudi", nessun secondo invio. Due report attivi
  di utenti diversi restano possibili (come nel prototipo).
- **Errore rete.** Banner `role=alert` "Non siamo riusciti a inviare la
  segnalazione. / Categoria e dettagli sono ancora qui." CTA diventa "Riprova",
  valori conservati.
- **Non loggato.** Il pulsante "Segnala" resta visibile e apre il login (gate
  d'ingresso, non a metà form); hint screen-reader "Accedi per segnalare".

## Regole

- Categorie = CHECK DB (`court_reports.category`): `broken_hoop` Canestro
  rotto · `wet_court` Campo bagnato · `lighting` Illuminazione · `occupied`
  Occupato · `other` Altro. Mai inventarne.
- Validazione = `reportSchema` (`lib/validation/schemas.ts`), unica fonte;
  descrizione max 280 (`REPORT_DESCRIPTION_MAX`). Nessuna regola duplicata.
- Doppio invio bloccato su due livelli: ricontrollo pre-insert (l'unica attiva
  per utente/campo, il DB non ha vincolo di unicità) + guardia anti-doppio
  submit. `expires_at` = ora + 48h (`reportExpiryFromNow`).
- `Drawer` Base UI, esiti Sonner. Nessuna foto (no storage segnalazioni).
- Token solo (`lint:design` verde), un solo tema dark, nessun colore hardcoded.

## Copy (vincolante, da prototipo approvato d15)

- Lead: "Vale per le prossime 48 ore: non è una recensione del campo."
- Successo (toast): "Segnalazione inviata" / "Resta attiva fino al {…}."
- Già segnalato: "Hai già segnalato questo campo" /
  "Puoi inviarne un'altra quando la tua scade."
- Rete: "Non siamo riusciti a inviare la segnalazione." /
  "Categoria e dettagli sono ancora qui." / CTA "Riprova".

## A11y

- Gruppo categoria `role=group` con label "Cosa non va", `tabindex=-1` per il
  focus sull'errore; errore categoria `role=alert`.
- Textarea con `aria-describedby` → contatore (visivo N/280 + sr-only "N
  caratteri su 280") ed errore `role=alert` quando presente.
- Chip ≥ 44px (`min-h-[44px]`), pallino di stato oltre il colore; focus visibile.
- Icone decorative `aria-hidden`; banner rete `role=alert`; loading `aria-busy`.
- Reduced motion: nessuna info affidata al movimento (override globale in
  `globals.css`); lo spinner resta "Invio…".

## Screenshot

- `/tmp/opencode/d23-shots/court-360.png` — scheda campo loggata.
- `/tmp/opencode/d23-shots/drawer-empty-360.png` — drawer form vuoto.
- `/tmp/opencode/d23-shots/drawer-error-360.png` — errore "Seleziona una categoria." a submit vuoto.
- `/tmp/opencode/d23-shots/court-360-reported.png` — toast "Segnalazione inviata / Resta attiva fino al…" + riga in "Segnalazioni attive".
- `/tmp/opencode/d23-shots/drawer-reported-360.png` — "già segnalato" con badge "Tua".
- `/tmp/opencode/d23-shots/court-768.png` — scheda campo a 768px.
