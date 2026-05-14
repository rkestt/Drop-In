# MVP Blockers — Guida alla risoluzione

## Stato attuale

Dopo la rimozione della chat, rimangono **4 blocchi tecnici** prima di poter considerare l'app un MVP solido.

---

## 1. PWA: `manifest.json` — icone mancanti

### Problema

`public/manifest.json` ha `"icons": []` (array vuoto). Senza icone il prompt di install PWA non viene mai mostrato dal browser, e l'app non è installabile.

### Soluzione

Aggiungere almeno 2 icone (192×192 e 512×512) nel manifest. Puoi:

**Opzione A — Usare un'icona SVG esistente del progetto:**
Cerca se c'è già un logo/icona in `public/` (es. `favicon.svg`, `icon.svg`, logo).

**Opzione B — Generare icone con uno strumento online:**
- Vai su https://realfavicongenerator.net/ o https://www.pwabuilder.com/imageGenerator
- Carica un SVG/PNG del logo Drop-In
- Scarica il pacchetto con le icone 192×192 e 512×512 in formato PNG
- Metti i file in `public/icons/` o direttamente in `public/`

**Opzione C — Creare un'icona placeholder minima:**
Crea un SVG semplice in `public/icon.svg`, poi convertilo al volo con un tool online.

Dopo aver ottenuto i PNG, aggiorna `public/manifest.json`:

```json
{
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Verifica

1. Avvia `npm run dev`
2. Apri DevTools → Application → Manifest
3. Verifica che le icone appaiano e siano caricabili
4. Su Chrome, la barra di installazione dovrebbe apparire dopo qualche secondo di navigazione

---

## 2. Dashboard/lobbies — query sbagliata

### Problema

`app/dashboard/lobbies/page.tsx` fa una query che restituisce **tutte** le lobby attive invece di filtrare solo quelle dell'utente:

```typescript
// Attuale (SBAGLIATO) — mostra TUTTE le lobby a tutti
const { data: lobbies } = await supabase
  .from("lobbies")
  .select("*, courts(name)")
  .eq("status", "open")
  .gte("start_time", now)
  .order("start_time", { ascending: true });
```

### Soluzione

Filtrare le lobby a cui l'utente partecipa. Il modo più semplice è usare una query su `lobby_participants` invece di `lobbies`:

```typescript
const { data: lobbyParticipants } = await supabase
  .from("lobby_participants")
  .select("lobby_id, lobbies!inner(*, courts(name))")
  .eq("user_id", user.id);
```

**Attenzione:** `lobbies!inner` è una join forzata. Se la sintassi di Supabase/PostgREST dà problemi, usa invece due query separate:

```typescript
// 1. Ottieni gli ID delle lobby a cui partecipa
const { data: participations } = await supabase
  .from("lobby_participants")
  .select("lobby_id")
  .eq("user_id", user.id);

const lobbyIds = participations?.map(p => p.lobby_id) ?? [];

// 2. Recupera i dettagli delle lobby
const { data: lobbies } = await supabase
  .from("lobbies")
  .select("*, courts(name)")
  .in("id", lobbyIds)
  .eq("status", "open")
  .gte("start_time", now)
  .order("start_time", { ascending: true });
```

Quest'ultimo approccio è più verboso ma più facile da debuggare.

### Verifica

1. Entra in una lobby come utente
2. Vai su `/dashboard/lobbies`
3. Dovresti vedere solo le lobby a cui hai aderito

---

## 3. Pulsante "Abbandona lobby"

### Problema

Il DB supporta già l'abbandono con la policy RLS `Users can leave lobbies` (`DELETE USING (auth.uid() = user_id)` su `lobby_participants`), ma non c'è alcun pulsante nell'UI per uscire da una lobby.

### Soluzione

Aggiungere un pulsante "Abbandona" in `LobbyJoinCard` (`components/lobby/lobby-join-card.tsx`).

**Passi:**

1. Aggiungi uno stato `leaving` e una funzione `handleLeave` nel componente:

```typescript
const [leaving, setLeaving] = useState(false);

const handleLeave = async () => {
  if (!userId) return;
  setLeaving(true);
  setError(null);

  try {
    const { error: deleteError } = await supabase
      .from("lobby_participants")
      .delete()
      .eq("lobby_id", lobby.id)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    setAlreadyJoined(false);
    router.refresh();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore durante l'abbandono.";
    setError(msg);
  } finally {
    setLeaving(false);
  }
};
```

2. Modifica la sezione "alreadyJoined" per mostrare due pulsanti invece di uno:

```typescript
// Sostituisci il singolo button "Sei dentro" con:
{alreadyJoined && (
  <div className="flex gap-2">
    <Button
      variant="secondary"
      size="sm"
      className="flex-1"
      disabled
    >
      <CheckCircle2 className="w-4 h-4" />
      Sei dentro
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLeave}
      disabled={leaving}
      className="flex-shrink-0 text-[var(--danger)]"
    >
      {leaving ? "..." : "Abbandona"}
    </Button>
  </div>
)}
```

**Nota:** La policy RLS `Users can leave lobbies` usa `FOR DELETE USING (auth.uid() = user_id)`, quindi l'utente può eliminare solo la propria partecipazione. La query sopra è sicura perché filtra sia per `lobby_id` che per `user_id`.

### Verifica

1. Entra in una lobby dalla pagina del campo
2. Dovresti vedere il pulsante "Abbandona" accanto a "Sei dentro"
3. Cliccalo — la partecipazione viene rimossa, il pulsante torna a "Entra nella partita"

---

## 4. `QuickCreateSheet` nella home — codice morto

### Problema

In `app/(app)/page.tsx`, il componente `QuickCreateSheet` è renderizzato e importato, ma `showQuickCreate` non viene mai impostato a `true` da nessun flusso UI. Il FAB ora naviga direttamente alla pagina del campo, e il foglio di creazione rapida non ha modo di aprirsi dalla home.

### Soluzione

Puoi seguire **una** di queste strade:

#### Opzione A (consigliata) — Rimuovere il componente morto

Elimina il JSX di `QuickCreateSheet` e la relativa importazione dalla home page, dato che la creazione lobby avviene solo dalla pagina del campo (`CreateLobbySheet`).

File: `app/(app)/page.tsx`

- Rimuovi l'import: `import { QuickCreateSheet } from "@/components/ui/quick-create";`
- Rimuovi lo stato: `const [showQuickCreate, setShowQuickCreate] = useState(false);`
- Rimuovi il JSX:

```typescript
{/* Quick Create Sheet — RIMUOVI TUTTO */}
<QuickCreateSheet
  open={showQuickCreate}
  onClose={() => { setShowQuickCreate(false); }}
  onSubmit={async (data) => { ... }}
  initialCourtId={undefined}
  allCourts={courts}
/>
```

#### Opzione B — Ricollegare il QuickCreateSheet

Se vuoi mantenere la creazione rapida anche dalla home, devi ricollegare un flusso al `showQuickCreate`. Per esempio, aggiungere un pulsante nella `RecentCourtsSheet` (nella sezione "Nessun campo recente") che apre direttamente il QuickCreateSheet. Ma questo duplica la logica di creazione lobby che già esiste nella pagina del campo.

### Verifica

Dopo la rimozione:
1. `npm run lint` — nessun errore per variabili/import inutilizzati
2. La home page non ha più il `QuickCreateSheet` nel DOM
3. La creazione lobby funziona ancora dalla pagina del campo (`/courts/[id]`)

---

## Ordine di esecuzione suggerito

1. **PWA icons** (5 min) — più impatto visivo, nessuna modifica al codice
2. **Dead code removal** (5 min) — semplice pulizia, riduce bundle
3. **Dashboard query fix** (10 min) — bug funzionale
4. **Leave lobby button** (15 min) — nuova feature UI

Tempo totale stimato: **~35 minuti**.
