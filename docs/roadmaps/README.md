# Roadmap di Drop-In

Tre livelli, ognuno con un lavoro solo.

| Livello | Dove | Risponde a |
| --- | --- | --- |
| **Roadmap** | `docs/roadmaps/*.md` | Dove stiamo andando, in che ordine, e perché |
| **Piano** | `docs/plans/<nome>.md` | Cosa deve essere vero, verificabile, e in che sequenza |
| **Ticket** | GitHub issues | Cosa si fa adesso, con un criterio di "fatto" |

**La regola: una roadmap produce piani, un piano produce ticket.** Nessuna feature parte da un ticket se non c'è un piano che la giustifica, e nessun piano nasce senza una roadmap che ne spieghi il perché. Il vocabolario usato da tutti e tre i livelli è in `GLOSSARY.md`.

`docs/roadmap.md` resta la **fotografia** — cosa è spedito, cosa è parziale, cosa manca, gap → ticket. Questo file è la **direzione**. Quando i due divergono, la fotografia si aggiorna, la direzione si discute.

## Orizzonti

- **Primavera 2027 — apertura.** Beta chiusa con utenti reali, un polo acceso, fondamenta chiuse (dati, legale, backup). Senza ricavi.
- **Estate 2027 — ricavi.** Almeno un incasso reale (sponsor di quartiere o quote torneo) e la densità che lo rende possibile: ~200 attivi in un polo.
- **Dopo — asset.** Database dei campi nominato e curato, valutazioni accumulate, e un'azienda che si può vendere o condividere con un socio.

## Le otto lane

| Lane | Cosa possiede | Orizzonte | Piano |
| --- | --- | --- | --- |
| [dati-territorio](dati-territorio.md) | Campi, sport, nomi, Note di campo, curatela | Primavera, poi continuo | voce 1, 1b, 2 |
| [core-loop](core-loop.md) | Ricorrenza, occorrenze, karma, durata, doppioni | Primavera | voci 3, 4, 12 |
| [interfaccia](interfaccia.md) | Navigazione mappa/lobby, a11y, onboarding | Primavera | #89 |
| [fiducia-moderazione](fiducia-moderazione.md) | Valutazioni, reputazione, chat, testo pubblico | Dopo la beta | voce 6 |
| [ritenzione-notifiche](ritenzione-notifiche.md) | Push, promemoria, ricorrenza abituale | Primavera | voci 5, 7 |
| [crescita-distribuzione](crescita-distribuzione.md) | Inviti, organizzatori, densità, PWA/store | Da subito | voci 10, 13 |
| [ricavi](ricavi.md) | Sponsor, tornei, P.IVA, prezzo | Estate | voce 11 |
| [fondamenta](fondamenta.md) | GDPR, backup, SMTP, sicurezza, produzione | Primavera, prima dei tester | voci 8a, 8b, 9 |

Le voci numerate si riferiscono a `docs/plans/spring.md`, il primo piano prodotto da queste roadmap.

## Cosa non è una lane

Restano fuori perimetro e non hanno una roadmap finché non c'è una decisione che le riapre: **i18n** (#64, fondazione pronta, routing spento), **performance budget**, **basemap offline**, **copertura mondiale dei dati** (`extract_osm.py` sa farlo, nessuno l'ha eseguito), **analytics di terze parti** (scelta motivata in `docs/observability.md`).

Non sono gap dimenticati: sono cose che sappiamo di non fare, ed è diverso.
