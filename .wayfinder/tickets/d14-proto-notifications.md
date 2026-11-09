---
id: d14
type: design
hitl: true
claimed: false
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

(TBD — esito review, copy permessi, tipi notifica approvati, screenshot.)
