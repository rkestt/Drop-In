---
id: d21
type: impl
hitl: false
claimed: false
blocked_by: [d13, d5, d6]
---
## Question

**Obiettivo.** Implementare il check-in approvato in `d13`: un passo, tutti gli errori veri con recovery, successo che dice fino a quando vale. Nessun finto successo, nessun mock in produzione.

**Prerequisiti.** Prototipo `docs/design/prototypes/checkin.html` approvato (leggi la Resolution di `d13`). `Drawer` (`d5`) e Sonner (`d6`) disponibili. Se `d7` è chiuso, usa `success-pop`; altrimenti il pop CSS esistente.

**File coinvolti.**

- `components/check-in/check-in-sheet.tsx`: riscrittura degli stati; resta il nome del file per non rompere gli import.
- `components/check-in/check-in-button.tsx`, `checkout-button.tsx`: stati coerenti con la scheda campo.
- `app/(app)/courts/[id]/page.tsx`: passa `courtLat`/`courtLng` (già presenti) e lo stato del check-in attivo.
- `lib/checkin/errors.ts` (nuovo, puro): mappa errori geolocalizzazione (`code` 1/2/3), accuratezza > 20 m, messaggio DB "troppo lontano (N m)", già dentro/cooldown; testi in italiano con recovery.
- `tests/unit/checkin-errors.test.ts` (nuovo).
- `docs/design/specs/check-in.md` (nuovo).

**Stati (tutti raggiungibili in sviluppo).**

1. **Idle**: nome campo, finestra, spiegazione GPS 50 m, CTA "Fai check-in".
2. **Loading**: "Verifica posizione…", bottone disabilitato, `aria-busy`.
3. **Permesso negato** (`code === 1`): causa + "Abilita la posizione e riprova" + "Riprova".
4. **Posizione non disponibile** (`code === 2`) e **timeout** (`code === 3`): messaggi distinti + "Riprova".
5. **Accuratezza insufficiente** (`accuracy > 20 m`): "Segnale GPS debole (±45 m). Esci all'aperto e riprova." + "Riprova".
6. **Fuori raggio**: usa il messaggio del trigger (`Sei troppo lontano dal campo (N m).`) e mostra "Aggiorna posizione"; nessun calcolo duplicato client.
7. **Già dentro / cooldown**: stato "Sei qui dalle HH:MM, check-in attivo fino alle HH:MM" + "Fai check-out" secondaria; nessun secondo check-in.
8. **Successo**: pop, "Check-in attivo fino alle HH:MM", chiusura esplicita.
9. **Errore server generico**: messaggio + "Riprova", dati conservati.

**Mock GPS.**

- Riusa `NEXT_PUBLIC_ALLOW_MOCK_GPS` se `t10` l'ha già introdotta; **non creare una seconda variabile**.
- Attiva solo se `process.env.NEXT_PUBLIC_ALLOW_MOCK_GPS === "true"` **e** `process.env.NODE_ENV !== "production"`. In produzione il ramo è dead code e non deve comparire nel bundle finale (verifica con grep sul build).
- Quando il mock è attivo, la UI lo dichiara ("Posizione simulata", `--warning`) e non è mai raggiungibile con l'env assente.
- Il check-in reale resta validato dal trigger DB a 50 m: il client non è la difesa.

**Regole.**

- Nessun successo ottimistico: il check-in è confermato solo dopo l'insert riuscito.
- Il bottone non è tappabile due volte (`disabled` durante la richiesta).
- La scadenza si calcola da `checked_in_at + 2h` (auto-checkout) e si formatta `it-IT`.
- Reduced motion: niente pop, il testo "Check-in attivo…" resta.
- Errori di campo/rete inline; il toast Sonner è solo per l'esito non bloccante.

**Acceptance.**

- `tests/unit/checkin-errors.test.ts` copre i codici 1/2/3, accuratezza, messaggio distanza, già dentro.
- Ogni stato è raggiungibile con DevTools → Sensors (location) + permessi sito; il flusso reale funziona con GPS vero.
- Dopo un check-in riuscito il record `check_ins` ha `status='active'` e la UI mostra la scadenza; il reload mantiene lo stato.
- Con mock disattivo nessun percorso usa `courtLat/courtLng` al posto del GPS.
- `npm run build` non contiene la stringa del mock se l'env è assente (grep).
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi; `@tester` live 360/768 con screenshot.

**Comandi di verifica.**

```bash
npx vitest run tests/unit/checkin-errors.test.ts
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
grep -r "ALLOW_MOCK_GPS" .next/static 2>/dev/null | head
# manuale: DevTools → Sensors per permesso/posizione; poi check-in reale
```

**Riferimenti.** `docs/design/patterns/onboarding.md` (Check-in), `supabase/migrations/001_initial_schema.sql` (`enforce_check_in_distance`), `docs/design/prototypes/checkin.html`.

## Resolution

(TBD — chiudere con: stati verificati, gestione mock, esito build, screenshot, spec.)
