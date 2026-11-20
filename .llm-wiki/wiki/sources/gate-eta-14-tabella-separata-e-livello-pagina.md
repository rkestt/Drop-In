---
type: source
title: "Età minima 14 anni: tabella separata e gate a livello pagina"
slug: gate-eta-14-tabella-separata-e-livello-pagina
status: insight
category: "source"
created: 2026-11-20
updated: 2026-11-20
---

# Età minima 14 anni: tabella separata e gate a livello pagina

# Età minima 14 anni: tabella separata e gate a livello pagina

## Perché una tabella e non una colonna di `profiles`

`profiles` ha `SELECT` pubblica (nickname, avatar, karma leggibili da chiunque) e RLS è row-level: non si nasconde una colonna. La data di nascita vive in `profile_age(user_id, birth_date, created_at)`, RLS own-row, nessun grant ad `anon`. Assenza di riga = non verificato: nessun backfill con date finte, gli utenti esistenti passano dalla verifica al primo accesso.

## Perché un gate dopo l'autenticazione

Il campo nel form di registrazione coprirebbe solo email: con Google OAuth non c'è un pre-signup intercettabile senza Auth Hooks, e gli invitati della beta non sono maggiorenni per costruzione. Un solo code path post-auth (layout dei due gruppi → redirect a `/verifica-eta`) copre email, OAuth e inviti.

## Il minore non lascia dati

La data sotto i 14 anni **non arriva mai al database**: il form nega prima dell'INSERT, e il `CHECK (birth_date <= (now() AT TIME ZONE 'Europe/Rome')::date - INTERVAL '14 years')` è il backstop per chi chiama PostgREST direttamente. L'utente vede una schermata neutra con due uscite: correggere la data o eliminare l'account (riusa `POST /api/account/delete`, idempotente).

## Due trappole pagate

1. **Fuso nel CHECK**: `CURRENT_DATE` è la data della *sessione* (UTC nel container Supabase), il predicato dell'app usa `Europe/Rome`. Nelle ore notturne in cui Roma è già al giorno dopo, chi compie 14 anni proprio quel giorno veniva accettato dal form e rifiutato dal DB con `23514`. Il vincolo va scritto con `now() AT TIME ZONE 'Europe/Rome'`, non con `CURRENT_DATE`.
2. **Guard `pending` su prop stale**: `setPending(true)` non aggiorna sincronicamente la prop del figlio, quindi due tap nello stesso frame invocano `onSubmit` due volte; il secondo INSERT torna `23505`, che senza mappatura diventa "errore" **dopo** una verifica riuscita. La cura è `upsert(..., { onConflict: "user_id" })`, non un debounce.

## Residuo dichiarato

Il gate è a livello **pagina**: un utente autenticato non verificato può ancora scrivere via PostgREST diretto (lobby, join, check-in). Per una beta a inviti è accettato e scritto in `docs/security.md`; chiuderlo richiede `profile_age` nelle policy di scrittura, cioè una condizione in ogni policy di INSERT — lavoro per l'apertura pubblica.

## Test che valgono

- unit sul predicato con fuso esplicito e 29/02;
- blocco RLS con un istante congelato (23:30Z = 01:30 a Roma) per inchiodare il boundary;
- e2e sul percorso vero: redirect, blocco senza riga, correzione, eliminazione, doppio invio, 409;
- test iPhone/WebKit: WebKit abortisce la promise di `goto` sul redirect server (Chromium no) e la corsa login→refresh→redirect sporca la console — si asserisce il redirect, si ricarica pulito, si filtra solo l'HMR.

## Related

- [e2e: una route con service-role vuole la chiave nel dev server](e2e-service-role-key-nel-dev-server.md)
