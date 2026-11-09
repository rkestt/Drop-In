---
id: d14
type: design
hitl: true
claimed: true
blocked_by: []
---
## Question

**Obiettivo.** Prototipare il centro notifiche: permesso push, lista letta/non letta, stato vuoto e arrivo in tempo reale. I dati esistono già (`push_notifications`: `title`, `body`, `sent_at`, `read_at`); il delivery push lato server no.

**File coinvolti.** `docs/design/prototypes/notifications.html` (nuovo). Usa `proto.css` e `proto.js`; non modificarli. Aggiorna la tua riga in `docs/design/prototypes/README.md`.

**Frame da includere (toolbar).**

1. **Permesso push — da chiedere** *(frame di esplorazione: non si implementa finché non esiste il delivery lato server)*: spiegazione in una riga ("Ti avvisiamo 30 minuti prima della lobby e quando il karma cambia"), CTA primaria "Attiva notifiche", secondaria "Non ora".
2. **Permesso negato** *(stessa nota)*: "Le notifiche sono bloccate dal browser" + istruzioni per riattivarle; CTA "Riprova" solo se il browser lo consente, altrimenti testo.
   - Nel prototipo i frame 1–2 sono marcati **"futuro"**; il centro notifiche funziona anche senza permesso push.
3. **Lista con notifiche**: 4 tipi reali — calo karma, ban, promemoria lobby, check-in. Ogni riga: icona, titolo, corpo, ora relativa ("12 min fa"), pallino non letto. Tap → deep link (campo o lobby).
4. **Tutto letto**: nessun pallino; "Segna tutte come lette" disabilitato o assente.
5. **Vuoto**: icona, "Nessuna notifica. Ti avvisiamo qui quando cambia qualcosa." + CTA secondaria "Attiva le notifiche" (se non attive).
6. **Loading**: 4 skeleton riga.
7. **Errore**: "Non riusciamo a caricare le notifiche." + "Riprova".
8. **Arrivo realtime**: toast Sonner in cima alla lista + riga nuova in evidenza per 2s (poi torna normale).
9. **Offline**: banner "Dati di 12 min fa" + lista in cache; nessun segna-come-letto (richiede rete), con spiegazione.

**Regole di design.**

- Il centro notifiche è una **pagina** dentro `(dashboard)` (header "Indietro", niente bottom nav) raggiungibile da profilo e da campanella nella mappa.
- Una sola CTA primaria per frame ("Attiva notifiche" oppure "Riprova"); "Segna tutte come lette" è un'azione testuale secondaria.
- Non promettere push che non arrivano: se il delivery non c'è, il copy dice "Qui vedi gli avvisi dell'app", non "ricevi notifiche sul telefono".
- Letto/non letto non è solo colore: pallino + peso del titolo + `aria-label`.
- Il toast non sostituisce la riga: l'evento resta nella lista.

**Accessibilità.**

- Lista come `ul`/`li` con link; ogni riga ha un nome accessibile completo.
- `aria-live="polite"` sull'arrivo di una nuova notifica.
- Pallino non letto con testo nascosto ("Non letta").
- Target ≥ 44px, focus visibile.

**Acceptance.**

- Il file apre a 360px e 768px; i 9 stati si cambiano dalla toolbar.
- I 4 tipi di notifica sono coerenti con `push_notifications`; nessun tipo inventato.
- I frame 1–2 sono marcati "futuro" e non vengono implementati in `d22`.
- Solo token di `proto.css`; nessun hex nell'HTML; nessun import dall'app.
- Checklist di `prototypes/README.md` compilata; review HITL con esito in Resolution.
- `prototypes/README.md`: riga `notifications.html` aggiornata.

**Comandi di verifica.**

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4173/notifications.html /tmp/opencode/notifications-360.png
grep -L 'proto.css' docs/design/prototypes/*.html
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/notifications.html
```

**Riferimenti.** `supabase/migrations/001_initial_schema.sql` (`push_notifications`), `components/notifications/notification-toast.tsx` (tipi esistenti), `docs/roadmap.md` (push parziale).

## Resolution

**Stato: in review HITL** — 2026-11-09.

Prototipo: `docs/design/prototypes/notifications.html` (unico file creato). `proto.css`, `proto.js` e la tabella di `prototypes/README.md` non sono stati modificati (vincolo di task: la riga `notifications.html` resta "da fare" e va aggiornata in review). Nessuna modifica in `app/`, `components/`, `lib/`.

### Stati implementati (9/9, dalla toolbar)

Permesso (futuro), Negato (futuro), Lista, Lette, Vuoto, Caricamento, Errore, Arrivo, Offline.

### Scelte da approvare

- **Tipi in lista:** promemoria lobby, calo karma, check-in, meteo campo (campo allagato), ban. I quattro tipi del ticket ci sono tutti; il meteo è un avviso di campo, non un `data.kind` nuovo: se il delivery non può generarlo, si sostituisce con un secondo promemoria lobby.
- **Non letta:** pallino accent + titolo 700 + barra sinistra 3px + `sr-only` "Non letta." (non solo colore). Il frame Lette toglie pallino, barra e peso e non mostra l'azione.
- **Badge campanella:** numero (3) su accent, mostrato come specimen fuori dal telefono; il nome accessibile è «Notifiche, 3 non lette». La schermata non ha bottom nav, solo "Indietro".
- **"Segna tutte come lette":** azione testuale secondaria (44px), assente nel frame Lette. Nel prototipo cambia stato e annuncia l'esito nella live region.
- **Permesso 1–2:** marcati "Futuro" con strip warning; nessun `Notification.requestPermission()`, nessuna fetch, nessun import dall'app. Il centro funziona anche senza permesso. Copy permesso: "Ti avvisiamo 30 minuti prima della lobby e quando il karma cambia."
- **Negato:** "Riprova" è presente nel frame; in d22 va mostrato solo se il browser lo consente, altrimenti resta il testo (già previsto sotto il pulsante).
- **Vuoto:** CTA secondaria "Attiva le notifiche" che apre il frame Permesso. **Errore:** "Riprova" torna alla lista. **Non ora:** torna alla lista.
- **Arrivo:** toast in cima alla lista + riga con ring accent per 2s (poi torna una normale riga non letta). Il toast è `aria-hidden`: l'annuncio passa dalla live region `aria-live="polite"`. L'evento resta nella lista.
- **Offline:** banner "Dati di 12 min fa" + spiegazione; righe in cache senza link e senza segna-come-letto.
- **Nessun tipo/colore inventato:** tinte derivate con `color-mix` dai token di `proto.css`; font Syne/Source Sans 3.

### Checklist README

- [x] Pipeline, passo e prossimo passo (commento in testa + meta).
- [x] Tutti i 9 stati presenti e raggiungibili dalla toolbar.
- [x] Copy italiano, concreto, senza gergo.
- [x] Una CTA primaria per frame; target ≥ 44px; focus visibile.
- [x] Contrasto AA: axe 4.14 (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) 0 violazioni sui 9 stati a 360.
- [x] `prefers-reduced-motion`: proto.css globale; il flash è decorativo, l'informazione resta in pallino, peso, "Adesso" e live region.
- [x] Screenshot 360 e 768 allegati.
- [x] Nessun colore fuori da `proto.css`; nessun font diverso da Syne/Source Sans 3.

### Verifica eseguita

```bash
grep -L 'proto.css' docs/design/prototypes/notifications.html   # nessun output
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/notifications.html   # nessun output
python3 -m http.server 4179 --directory docs/design/prototypes
npx playwright screenshot --viewport-size="360,780" http://localhost:4179/notifications.html /tmp/opencode/notifications-360.png
npx playwright screenshot --viewport-size="768,900" http://localhost:4179/notifications.html /tmp/opencode/notifications-768.png
```

- **Overflow orizzontale:** `document.scrollWidth === clientWidth` a 360 e 768 su tutti i 9 stati; phone 326/358 px senza overflow.
- **Console:** 0 errori. **`file://`:** apre, stato iniziale `lista`, 5 righe.
- **Interazioni:** "Segna tutte" → Lette + live region; "Riprova" errore → Lista; "Non ora" → Lista; CTA vuoto → Permesso; focus post-cambio sulla prima riga; focus ring 2px accent sulle righe.
- **Screenshot:** `/tmp/opencode/notifications-360.png`, `/tmp/opencode/notifications-768.png`, `/tmp/opencode/notifications-360-full.png`.

### Aperto / fuori scope

- Delivery push lato server: i frame Permesso/Negato restano **futuro** e non si implementano in `d22`.
- `prototypes/README.md`: riga `notifications.html` ancora "da fare" per vincolo di task; va portata a "in review" in review.
- Meteo campo: nessun evento sorgente nel DB; se non si vuole, si taglia la riga.

