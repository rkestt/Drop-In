# Lobby

Schermate `/lobbies` (lista) e `/lobbies/[id]` (dettaglio, gruppo
`(dashboard)`).
Implementa il prototipo `docs/design/prototypes/lobby.html` approvato da
Andrea il 2026-11-10 (d12): copy, gerarchia, stati (lista tue/vicine, vuoto,
loading, dettaglio aperta/piena/in corso/chiusa, crea + errore, join +
ottimistico + pieno) sono vincolanti. Ticket:
`.wayfinder/tickets/d20-impl-lobby.md`.

## Obiettivo

Mostrare le partite vere (le tue + quelle vicine), far entrare e uscire
senza reload, con un solo contenitore per pipeline: lista e dettaglio sono
pagine, crea e join sono drawer. Mai drawer su drawer.

## Layout

1. **Lista** (`app/(dashboard)/lobbies/page.tsx` server + `lobby-tabs.tsx`
   client): tab "Le tue (n)"/"Vicine (n)" con `role=tablist`,
   `aria-selected`, conteggi reali. "Le tue" dal server (creatore o
   partecipante, con `n/max`, nickname, "Sei dentro"); "Vicine" nel client
   `NearbyLobbies` (posizione + RPC `nearby_courts`, raggio 15 km, bug #48:
   mai tutta Italia) con distanza reale ("2,4 km", "400 m").
2. **Card** (`lobby-card.tsx`, presentazionale): tutta la card è un link al
   dettaglio. Badge Aperta/Al completo/In corso/Chiusa, `n/max` it-IT,
   "Sei dentro" (NextHighlight) o "Unisciti ›". Nome accessibile completo
   (campo, sport, orario, posti, distanza, stato). Join ed esci vivono solo
   nel dettaglio, mai nella card.
3. **Dettaglio** (`lobbies/[id]/page.tsx` + `lobby-detail.tsx`): data
   it-IT, nome campo, orario grande + "Si chiude alle" (+30 min), `n/max`,
   avatar con iniziali ("TU" per te), fact karma + iscrizioni, link "Apri
   il campo". Una sola CTA primaria: "Unisciti" (aperta, posti, non
   bannato) / "Crea lobby" (piena) / nessuna (in corso/chiusa: solo motivo).
   "Esci dalla lobby" secondaria se dentro (conferma inline solo se in
   corso). Bannato/karma basso: motivo con data/soglia reali, niente CTA.
4. **Crea** (`create-lobby-drawer.tsx`, Drawer + RHF +
   `createLobbySchema`): orario futuro, max 2–30, errori inline + dominio
   (ban con data, karma con soglia). Successo: SuccessPop, chiusura,
   `router.refresh()` + realtime — mai `window.location.reload()`.
5. **Join** (`join-lobby-drawer.tsx`): riepilogo campo/orario/posti liberi
   + tuo karma + regola no-show ("perdi 3 punti"). "Entra" → ottimistico
   "Sei dentro" + toast; se il server rifiuta: rollback + motivo + recovery
   ("Riprova", "Crea la tua lobby").

## Dati (query reali)

- Lista "Le tue": `lobby_participants` per `user_id` → lobby dove creatore
  o partecipante (`or` su `creator_id`/`id.in`), poi partecipanti +
  nickname dai `profiles`.
- "Vicine": le prime 100 lobby aperte per orario (`OPEN_LOBBIES_LIMIT`, le
  lobby sono effimere per auto-chiusura) con coordinate del campo, poi
  filtro haversine client-side entro 15 km (`lib/lobbies/nearby.ts`, puro e
  testato) + nickname; ordinate per distanza reale. **Limite dichiarato**:
  oltre 100 lobby aperte, quelle vicine oltre le 100 più imminenti non
  compaiono. Scelta consapevole: l'alternativa courts-first (RPC
  `nearby_courts` con cap + lobby su quei court) perde lobby quando i campi
  vicini superano il cap del RPC. Il RPC resta usato solo per la CTA di
  empty state ("Crea una lobby" sul campo più vicino, `p_limit: 1`).
- Dettaglio: `lobbies` per id (`notFound()` se PGRST116, UUID invalido →
  404), `courts(id,name,address,sport)`, partecipanti + nickname, profilo
  (`karma_score`, `banned_until`).
- Realtime: canali su `lobbies` + `lobby_participants` → `router.refresh()`
  per "Le tue" (props dal server) e dettaglio (con `filter` per id),
  ricarico dati (`NearbyLobbies.load` con l'ultima posizione nota) per le
  "Vicine". Join/leave dall'altro browser entro pochi secondi. Rete giù ≠
  404 (messaggio + Riprova).

## Stati

- **default/vuoto/loading**: skeleton con `aria-busy` + `role=status`
  sr-only; "Non hai lobby attive / Creane una dal campo / Trova un campo"
  (Le tue); "Nessuna lobby qui intorno / Sii il primo" + crea sulla prima
  corte vicina, o "Trova un campo" se niente intorno; posizione negata →
  "Attiva la posizione…".
- **dettaglio**: aperta / piena (banner + crea) / in corso (nota, niente
  CTA) / chiusa (nota, niente CTA).
- **join-ottimistico**: banner "Sei dentro…" + toast; errore → rollback +
  banner `role=alert` con recovery.
- **deep link**: `/notifications` manda le lobby a `/lobbies/<uuid>`
  (`lib/notifications/link.ts`), freddo + 404 dedicata.

## Scostamenti dal prototipo

- **Karma richiesto**: il DB non ha una soglia per lobby, quindi il
  drawer/dettaglio mostra solo il tuo karma reale + regola no-show, mai
  "70 o più". Non inventiamo il requisito.
- **Capacità in corsa**: il trigger `enforce_lobby_capacity` non esiste
  nel DB (lo copre `t10-core-loop-impl`): nessuna verifica client
  sostitutiva. La UI disabilita il join a lobby piena (stato, non
  enforcement) e gestisce il rifiuto server con rollback.
- **Stepper max giocatori**: resta l'Input numerico RHF+schema (una sola
  fonte di validazione), niente stepper custom.
