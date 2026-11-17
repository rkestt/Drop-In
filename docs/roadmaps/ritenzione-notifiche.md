# Ritenzione e notifiche

**Orizzonte**: primavera.
**Obiettivo**: l'app si fa ricordare due volte, non venti, e senza mentire.
**Piano**: `docs/plans/spring.md`, voci 5, 7.

## Stato

Il centro notifiche in-app è completo. La consegna push è **scritta e non deployata** (#87: VAPID, secrets, `functions deploy`, cron). Esistono tre notifiche: `participant_joined`, `lobby_starting_soon`, `karma_loss`. Nessuna riattivazione possibile oggi.

## Voci

| Voce | Ticket | Stato |
| --- | --- | --- |
| Deploy della push e audit delle notifiche esistenti | #87 | aperto |
| Notifica di **riconferma** a ridosso dell'occorrenza | nuovo, dentro #91 | da aprire |
| Ricorrenza abituale ("di solito il giovedì ci sono sei") | voce 5 del piano | opzionale, dopo 4 settimane di dati |
| Push su iOS solo da PWA installata | #80 | vincolo, non ticket |

## Decisioni chiuse

- Al lancio solo **due** eventi: "si è formata una partita vicino a te" e "stasera al campo X ci sono sei".
- Ogni feature nuova dichiara nel proprio ticket le notifiche che introduce: senza questa regola, le occorrenze ricorrenti fanno esplodere la produzione.
- La ricorrenza abituale si mostra come **stima** ("di solito"), mai come presenza, e si trasforma in Conferma con un tap.

## Decisioni aperte

- Quante notifiche sono troppe. Serve un limite per utente e per giorno, ed è una scelta di prodotto, non tecnica.
- Se la ricorrenza abituale vale la pena: è la voce più affascinante e la meno necessaria. Nessun dato dice ancora se sposta qualcosa.

## Vincolo da non dimenticare

Su iOS le web push funzionano **solo** dall'app installata sulla schermata Home (16.4+). Il che rende l'installazione della PWA un requisito di ritenzione, non un abbellimento — e lega questa lane a `interfaccia` e a #80.
