# Profilo

Schermata `/profile` (gruppo `(app)`: bottom nav con Mappa + Profilo).
Implementa il prototipo `docs/design/prototypes/profile.html` approvato da
Andrea il 2026-11-10 (d11): copy, gerarchia, stati e drawer modifica sono
vincolanti. Ticket: `.wayfinder/tickets/d19-impl-profile.md`.

## Obiettivo

Mostrare chi sono (nickname), come sto (karma), cosa ho fatto (numeri reali)
e dove andare (lobby, notifiche, impostazioni) — senza inventare dati.

## Layout

1. **Header identità** (`components/profile/profile-header.tsx`): avatar 72px
   con iniziali (decorativo), nickname Syne 24px o "Nessun nickname" +
   hint, email attenuata, CTA primaria full-width ("Modifica" /
   "Imposta nickname").
2. **Banner ban** (solo se `banned_until` futuro): `role="status"`, barra
   `--danger`, "Partecipazione sospesa" + "puoi partecipare di nuovo dal
   <data reale>" + hint. Niente link: "Cosa succede ora" è testo statico.
3. **Karma** (`karma-panel.tsx`): numero Syne 40px, "/ 100", sr-only
   "Karma: N su 100", barra decorativa (`aria-hidden`) con soglia al 50%,
   regola "+1 check-in, −3 no-show, sotto 50 sospensione 7 giorni".
   Variante `--danger` quando bannato.
4. **Numeri** (`stats-row.tsx`): check-in totali, lobby create, lobby
   giocate. Query fallita → "—" + `title="Non disponibile"`, mai 0.
   Tutti 0 reali → messaggio "Ancora nessun check-in…".
5. **Scorciatoie** (`settings-links.tsx`): "Le tue lobby" `/lobbies`,
   "Notifiche" `/notifications`, "Impostazioni" `/settings`. Righe-link
   56px, non bottoni accent. `/notifications` e `/settings` atterrano con
   d22 e d18 (path già allineati).

## Dati (query reali, `app/(app)/profile/page.tsx`)

- `profiles` per `user_id`: `nickname, karma_score, banned_until`.
- `check_ins`: `count exact head` per `user_id`.
- `lobbies`: `count` per `creator_id`.
- `lobby_participants`: `count` per `user_id` (UNIQUE su
  `(lobby_id, user_id)` → già distinct per lobby).

## Stati

- **default**: tutto popolato.
- **loading** (`loading.tsx`): skeleton con stesse altezze, `aria-busy` +
  status sr-only.
- **banned**: banner + karma danger (karma 43, scadenza reale).
- **nickname-mancante**: avatar neutro, CTA "Imposta nickname".
- **edit-drawer**: Drawer Base UI, focus sul campo, Esc/backdrop chiudono.
- **edit-error**: errore inline >30 caratteri (`aria-invalid`,
  `aria-describedby`); stringa vuota ammessa dallo schema = azzera nickname.
- **stats-vuote**: zeri reali + messaggio; niente grafici.
- **toast-salvato**: Sonner `toast.success("Nickname salvato.")` +
  `router.refresh()` (niente reload).

## Copy (italiano, dal prototipo)

"Modifica", "Imposta nickname", "Nessun nickname",
"Scegli come ti vedono gli altri in lobby.", "Partecipazione sospesa",
"Karma sotto 50: puoi partecipare di nuovo dal …",
"Nel frattempo puoi consultare i campi e le tue lobby.",
"I tuoi numeri", "Check-in", "Lobby create", "Lobby giocate",
"Ancora nessun check-in, nessuna lobby. Quando giochi, i numeri compaiono qui.",
"Modifica nickname", "Massimo 30 caratteri. Lo vedono gli altri giocatori.",
"Annulla", "Salva", "Salvataggio…", "Nickname salvato.",
"Il nickname non può superare i 30 caratteri." (da `editProfileSchema`).

## A11y

- Karma annunciato come testo; barra `aria-hidden`. Iniziali `aria-hidden`.
- Banner `role="status"` (non `alert`). Errori inline `role="alert"`.
- Focus visibile (ring `--accent`), target ≥ 44px (CTA 48px, righe 56px),
  contrasto AA su token `--text-muted` e superiori.
- Bottom nav: `aria-current="page"` sulla voce attiva.

## Tagli (niente dato in DB → niente funzione)

Niente upload avatar (nessuno storage), niente storico karma (tabella
inesistente), niente grafici. "Vuoto ammesso" segue `editProfileSchema`:
il drawer non blocca il salvataggio vuoto, lo azzera.

## Screenshot

Verifica @tester live 360/768 (stati: default, banned, senza nickname,
drawer, errore, skeleton). Da allegare qui.
