# Drop in — Missing Improvements

## Critical (usability blockers)

1. **Troppi campi sulla mappa** — 10.000 marker caricano tutti insieme. Dovrebbe mostrare solo i campi rilevanti (con partite attive o filtrati per sport/zona), non un bombardamento di punti. Soluzione: cluster markers + lazy load per area visibile. ✅ (clustering in court-map.tsx)

2. **Nessun "ordina"** — le partite sono ordinate per orario, ma non puoi scegliere di vedere le più vicine a te, le prime disponibili, o quelle con più posti liberi. ✅ (sortBy in page.tsx: time/distance/spots)

3. **La mappa non è interattiva** — non puoi toccare un campo sulla mappa e vedere le partite lì senza andare nella pagina del campo.

4. **Clustering markers** — con 10k campi servono cluster per non far impallare la mappa. ✅ (court-map.tsx:179-185)

## Important (daily friction)

5. **Nessuna notifica reminder** — creo una partita per domani alle 18, e non ho modo di sapere che sta per iniziare. ✅ (cron notify-lobby-starting-soon in 002_push_notification_triggers.sql)

6. **Dettaglio partita scarso** — nella lista vedi solo orario + campo. Non chi ha già confermato, quanti posti liberi, come si arriva.

7. **Riprova login** — se sbagli password devi ricominciare da zero, niente feedback chiaro. ✅ (error handling in login-modal.tsx)

8. **Batteria mappa** — Leaflet con 10k marker consuma molto sul mobile. ✅ (usa MapLibre GL JS, non Leaflet)

## Nice to have

9. **Nessun "invita"** — non puoi condividere una partita con un amico (copy link, share, etc).

10. **Empty state debole** — "Sii il primo a crearne una" è okay, ma potrebbe essere più invitante (mappa dei campi + CTA chiaro).

11. **Filtro per zona** — rimosso ma forse serve ancora? Da ridecidere.

12. **Pagina profilo debole** — mostra solo nickname + karma, niente storico partite, statistiche, achievement.

13. **Nessuna chat** — nelle partite non puoi parlare con i partecipanti. ✅ (rimossa su richiesta)

14. **Nessuna possibilità di valutare** — dopo la partita non puoi lasciare feedback o votare i giocatori.

15. **No dark mode toggle** — nonostante il design "cool" abbia variabili CSS per tema, non c'è modo di switchare.

## Technical / Backend

16. **Nessun auto-cleanup** — le partite scadute restano `open` nel DB (manual cleanup required). ✅ (cron auto-close-lobbies, auto-checkout)

17. **Rate limit su Nominatim** — lo script di enrich rischia di essere bloccato.

18. **Nessun caching** — i dati courts vengono ricaricati ad ogni navigazione. ✅ (useCourtCache hook)

19. **RLS policies incomplete** — alcune tabelle potrebbero non avere policy corrette. ✅ (completato con migrazione 008_complete_rls_policies.sql)