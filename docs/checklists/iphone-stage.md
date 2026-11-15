# Checklist iPhone — Drop-In stage

URL: https://drop-in-stage.vercel.app
Data: 2026-11-14. Stage allineato a migrazione `032`.

## Prima di iniziare
- [ ] Safari aggiornato (iOS 16.4+ per push).
- [ ] Crea 2 account (es. `amico1@example.com`, `amico2@example.com`) con password.
- [ ] Tieni aperto un secondo device/browser per i test realtime/push.

## Installazione PWA
- [ ] Safari → Condividi → Aggiungi a Home.
- [ ] Apri dall'icona: deve partire standalone, senza barra Safari.
- [ ] Controlla icona, nome, splash.

## Auth
- [ ] Registrazione con email/password; nessuna conferma email.
- [ ] Logout e login.
- [ ] Toggle occhio password in login e registrazione.
- [ ] Sessione persistente dopo chiusura/riapertura.

## Mappa
- [ ] Mappa carica a Roma, tile visibili.
- [ ] Pan/zoom fluidi; niente schermo bianco.
- [ ] Marker visibili; clustering con zoom out.
- [ ] Tap su un campo → anteprima (non navigazione diretta).
- [ ] Filtro sport e ricerca per nome.
- [ ] “Vicine” usa la posizione (concedi permesso).
- [ ] Se togli rete: shell offline, nessuna schermata bianca.

## Aggiungi campo (senza GPS)
- [ ] Submit-court → scegli posizione su mappa / indirizzo / coordinate.
- [ ] Foto da camera o libreria; upload.
- [ ] Dedup: campo vicino → avviso duplicato.
- [ ] Dopo submit: stato “In attesa di approvazione”, niente check-in/lobby.

## Check-in
- [ ] Entro 50 m: check-in OK.
- [ ] Fuori raggio: messaggio metri, niente crash.
- [ ] Accuratezza bassa: messaggio dedicato.
- [ ] Permesso Safari: prova “Chiedi”, “Mai” e “Durante l'uso” con “Posizione precisa” attiva/disattiva.
- [ ] Permesso negato su iOS: messaggio specifico Safari con «Posizione precisa» (non quello generico).
- [ ] Accuratezza 20–50 m: check-in consentito con avviso “GPS impreciso” non bloccante.
- [ ] Accuratezza >50 m: check-in bloccato con messaggio “Segnale GPS debole”.
- [ ] Check-in attivo: scadenza visibile; check-out.
- [ ] Con rete off: check-in va in coda; al reconnect si invia.
- [ ] Check-in in coda da >2h: scartato.

## Lobby
- [ ] Crea lobby (campo, ora, max).
- [ ] Secondo account: join; il primo vede il partecipante in realtime.
- [ ] Lobby piena: join bloccato con messaggio.
- [ ] Lobby chiusa: messaggio “chiusa”, non “riprova”.
- [ ] Leave; il conteggio si aggiorna.
- [ ] Offline: join/leave in coda; reconnect → nessun duplicato.

## Favorites
- [ ] Salva campo dai dettagli.
- [ ] Compare in profilo/preferiti.
- [ ] Rimuovi; persiste al reload.

## Profilo
- [ ] Avatar upload (camera/libreria), resize, reload.
- [ ] Nickname edit.
- [ ] Attività recente: check-in/karma.
- [ ] Karma e ban banner.

## Notifiche
- [ ] Centro notifiche: lista, letto/non letto, badge.
- [ ] Impostazioni → Notifiche: attiva permesso.
- [ ] Push: solo PWA installata iOS 16.4+; da secondo account join lobby → arriva entro ~1 min.
- [ ] Tap push → apre la lobby corretta.

## Impostazioni
- [ ] Sezioni notifiche/posizione/account/info.
- [ ] Logout.
- [ ] Eventuale admin/moderation (se account moderatore).

## Share
- [ ] Condividi campo/lobby (Web Share API).
- [ ] Link apre la pagina giusta.

## A11y / UX
- [ ] VoiceOver: nomi accessibili su pulsanti/marker.
- [ ] Touch target ≥44px.
- [ ] Focus visibile (se usi tastiera esterna).
- [ ] Reduced Motion rispettato.

## Cosa segnare per ogni bug
- iOS + modello, screenshot, passi, rete (Wi-Fi/4G), account usato.
- Se possibile console Safari (Mac → Develop → iPhone) o Web Inspector.
