---
id: d19
type: impl
hitl: false
claimed: false
blocked_by: [d11, d5, d6]
---
## Question

**Obiettivo.** Implementare il profilo approvato in `d11`: identità, karma leggibile, statistiche reali, scorciatoie a lobby/notifiche/impostazioni. Niente avatar upload e niente storico karma (non esistono).

**Prerequisiti.** Prototipo `docs/design/prototypes/profile.html` approvato (leggi la Resolution di `d11`). `Drawer` (`d5`) e Sonner (`d6`) disponibili.

**File coinvolti.**

- `app/(dashboard)/profile/page.tsx`: fetch profilo + conteggi reali.
- `components/profile/profile-header.tsx` (nuovo): iniziali, nickname, email, CTA "Modifica"/"Imposta nickname".
- `components/profile/karma-panel.tsx` (nuovo): numero Syne, etichetta, regola "+1 check-in, −3 no-show", banner ban con data.
- `components/profile/stats-row.tsx` (nuovo): check-in totali, lobby create, lobby giocate.
- `components/profile/settings-links.tsx` (nuovo): righe verso `/lobbies`, `/notifications`, `/settings`.
- `components/profile/edit-profile-sheet.tsx`: migra a Drawer e a RHF+zod se `d8` è chiuso (altrimenti resta il form attuale).
- `app/(dashboard)/profile/loading.tsx` (nuovo): skeleton coerente.
- `docs/design/specs/profilo.md` (nuovo).

**Dati (query reali, nessun numero inventato).**

- Profilo: `profiles` per `user_id` (nickname, karma_score, banned_until).
- Check-in totali: `check_ins` con `count: "exact", head: true` e `user_id`.
- Lobby create: `lobbies` con `count` e `creator_id`.
- Lobby giocate: `lobby_participants` con `count` e `user_id` (se il conteggio include duplicati, distinct per lobby).
- Se una query fallisce, la statistica mostra "—" e un tooltip "Non disponibile", non 0.

**Comportamento.**

- Ban attivo: banner `--danger` con "Puoi partecipare di nuovo dal <data>" e link a "Cosa succede ora" (testo, non una pagina nuova).
- Nickname assente: stato vuoto con CTA "Imposta nickname" (una sola CTA primaria).
- Drawer modifica: campo, errore inline (vuoto / > 30 caratteri), "Salva" primaria, "Annulla" secondaria; al successo toast Sonner + refresh dei dati.
- Le scorciatoie sono link, non bottoni accent; una sola CTA primaria nella pagina.
- Loading: skeleton con la stessa altezza del contenuto per evitare layout shift.

**Accessibilità.**

- Karma annunciato come testo ("Karma 87 su 100"); la barra è decorativa (`aria-hidden`).
- Iniziali avatar `aria-hidden` perché il nickname è già testo.
- Banner ban `role="status"` (non `alert`: non è un errore nuovo a ogni render).
- Focus visibile, target ≥ 44px, contrasto AA.

**Acceptance.**

- I conteggi corrispondono a query dirette sul DB per lo stesso utente.
- Stato bannato e stato senza nickname verificati con dati reali (o seed locale), non con mock nel componente.
- Il drawer valida e salva; errore inline con `aria-invalid`; toast una volta.
- Nessun upload avatar, nessuno storico karma, nessun grafico.
- `/profile` protetta e raggiungibile dalla bottom nav; link a `/settings` e `/notifications` funzionanti.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi; `@tester` live 360/768 con screenshot.

**Comandi di verifica.**

```bash
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
# manuale: /profile con utente normale, con nickname assente, con banned_until futuro
```

**Riferimenti.** `supabase/migrations/001_initial_schema.sql` (`profiles`, `check_ins`, `lobbies`), `docs/design/prototypes/profile.html`, `docs/design/1.5.md` (F3).

## Resolution

(TBD — chiudere con: query usate, stati verificati, screenshot, spec.)
