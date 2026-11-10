---
id: d11
type: design
hitl: true
claimed: true
blocked_by: []
status: closed
closed_at: 2026-11-10
---
## Question

**Obiettivo.** Prototipare il profilo: chi sono, come sto (karma), cosa ho fatto, dove vado (impostazioni/notifiche). Deve reggere anche lo stato bannato senza diventare una pagina di errore.

**File coinvolti.** `docs/design/prototypes/profile.html` (nuovo). Usa `proto.css` e `proto.js`; non modificarli. Aggiorna la tua riga in `docs/design/prototypes/README.md`.

**Struttura.**

- **Header profilo**: avatar con iniziali (niente upload foto: non esiste lo storage), nickname, email attenuata, bottone "Modifica" che apre il drawer.
- **Karma**: numero grande in Syne (`display-lg`), etichetta "Karma", barra o indicatore verso 100, una riga che spiega come si guadagna/perde ("+1 check-in, −3 no-show"). Se bannato: banner `--danger` con scadenza e cosa fare.
- **Statistiche reali** (dalle tabelle esistenti): check-in totali, lobby create/giocate. Niente storico karma: la tabella non esiste.
- **Scorciatoie**: "Le tue lobby", "Notifiche", "Impostazioni" come righe con chevron, non tre CTA accent.
- **Drawer modifica nickname**: campo, errore inline (vuoto/troppo lungo), "Salva" primaria, "Annulla" secondaria.

**Stati da includere (toolbar).**

`default`, `loading` (skeleton), `banned`, `nickname-mancante`, `edit-drawer`, `edit-error`, `stats-vuote`, `toast-salvato`.

**Regole di design.**

- Una sola CTA primaria: "Modifica" (o "Imposta nickname" nello stato vuoto). Le scorciatoie sono righe, non bottoni accent.
- Il numero di karma è il dato hero: non compete con altri numeri grandi.
- Il banner ban dice **fino a quando** e **cosa fare** ("Puoi partecipare di nuovo dal 16 nov").
- Il drawer non copre l'header; safe-area rispettata; `Esc`/backdrop chiudono.
- Niente grafici: non ci sono dati storici.

**Accessibilità.**

- Avatar decorativo (`aria-hidden`) se il nome è già testo; in caso contrario `aria-label` con il nickname.
- Karma annunciato come testo ("Karma 87 su 100"), non solo barra.
- Errore nickname con `aria-invalid` + `aria-describedby`; focus sul campo.
- Righe scorciatoia come link veri, target ≥ 44px, focus visibile.

**Acceptance.**

- Il file apre a 360px e 768px; gli 8 stati si cambiano dalla toolbar.
- Nessun dato inventato: statistiche solo da `check_ins` / `lobbies`; nessuno storico karma.
- Solo token di `proto.css`; nessun hex nell'HTML; nessun import dall'app.
- Checklist di `prototypes/README.md` compilata; review HITL con esito in Resolution.
- `prototypes/README.md`: riga `profile.html` aggiornata.

**Comandi di verifica.**

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4173/profile.html /tmp/opencode/profile-360.png
grep -L 'proto.css' docs/design/prototypes/*.html
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/profile.html
```

**Riferimenti.** `app/(dashboard)/profile/page.tsx` (stato attuale), `docs/roadmap.md` (profilo parziale, niente avatar/storico), `docs/design/patterns/states.md`.

## Resolution

**Stato:** in review HITL (2026-11-09). Nessuno stato tagliato.

**File:** `docs/design/prototypes/profile.html` (nuovo). `proto.css` e `proto.js` non modificati. `README.md` non toccato in questa lane: la riga `profile.html` va aggiornata a parte.

**Stati implementati (toolbar, 8/8):** `default`, `loading`, `banned`, `nickname-mancante`, `edit-drawer`, `edit-error`, `stats-vuote`, `toast-salvato`. In più `profile.html?state=<id>` apre direttamente uno stato per gli screenshot.

**Screenshot:**
- `/tmp/opencode/profile-360.png` (360×780) e `/tmp/opencode/profile-768.png` (768×900)
- full page: `/tmp/opencode/profile-360-full.png`, `/tmp/opencode/profile-768-full.png`
- per stato: `/tmp/opencode/profile-<stato>-360.png` (banned, nickname-mancante, edit-drawer, edit-error, stats-vuote, toast-salvato, loading)

**Check eseguiti (verdi):**
- `grep -L 'proto.css' docs/design/prototypes/profile.html` → nessun output.
- `grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/profile.html` → nessun output.
- Playwright 360/768: un solo stato visibile per volta, nessuno scroll orizzontale su pagina e telefono in tutti gli 8 stati; target ≥44px su schermata default e drawer; zero errori console.
- Font Syne e Source Sans 3 caricati da `proto.css` (data URI nella base condivisa, nessun font-face duplicato nel prototipo); apertura `file://` verificata.
- Drawer: focus sul campo all'apertura; `Esc` e tap sul backdrop chiudono e riportano il focus a "Modifica"; submit valido → `toast-salvato`; submit invalido resta su `edit-error` e rifocalizza il campo (`aria-invalid`, `aria-describedby`).
- `banned`: banner `role="status"`, scadenza 16 novembre 2026; karma 43, barra `--danger`.
- `loading`: skeleton con la stessa struttura del contenuto, `aria-busy` e status solo screen reader.

**Da guardare in review:** gerarchia nome/karma (87 hero, statistiche 22px), copy del banner ("puoi partecipare di nuovo dal 16 novembre 2026" + cosa fare nel frattempo), drawer che lascia visibili header e karma, toast sopra la bottom nav, una sola CTA accent per stato. Nel prototipo l'errore inline mostra il caso vuoto; il limite di 30 caratteri è nel hint e va validato anche in implementazione.

**Esito review HITL (2026-11-10):** approvato da Andrea senza modifiche richieste. Le scelte del prototipo sono vincolanti per l'implementazione (copy, gerarchia, stati); i punti aperti segnalati dai designer restano quelli scritti nella Resolution e si chiudono nel ticket di implementazione corrispondente.
