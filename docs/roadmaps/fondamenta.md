# Fondamenta

**Orizzonte**: primavera, e tutto **prima** che entri un solo estraneo.
**Obiettivo**: niente si rompe in modo irreversibile, e nessuno entra prima che sia lecito.
**Piano**: `docs/plans/spring.md`, voci 8a, 8b, 9.

## Stato

Pagine legali con `[DA COMPILARE]`. Nessuna eliminazione account, nessun export dati. Nessun backup verificato. SMTP di default di Supabase: **2 email/ora**, e in molti progetti solo verso indirizzi del team. Produzione ferma a schema `022` mentre master è avanti di tredici migrazioni.

## Voci

| Voce | Ticket | Stato |
| --- | --- | --- |
| Eliminazione account ed export dati (codice) | #94 | aperto — **prima di ogni tester** |
| Privacy, ToS, cookie (testi) | #83 | aperto, dopo |
| Backup + ripristino provato, promozione produzione | #85 | aperto, scope ridotto |
| SMTP dedicato | #86 | aperto — blocca #95 |
| Rate limit, moderazione foto, anti-spam | #84 | aperto |
| Monitoraggio e uptime | #88 | aperto, non gate |
| Età minima e consenso dei minori | #97 | aperto |

## Decisioni chiuse

- La voce legale si spezza: **8a codice presto** (tocca schema, cascade e storage), **8b testi tardi**.
- Niente analytics di terze parti e niente Sentry, con criteri di riapertura in `docs/observability.md`.
- Flusso di rilascio in quattro migrazioni sul core loop, non un big bang.

## Decisioni aperte

- **Minori.** La pallavolo e il basket di strada sono sport di ragazzini: serve un'età minima e una regola di consenso (in Italia l'età per il consenso digitale è 14 anni). Oggi non esiste nessun controllo. È la voce legale più facile da dimenticare e la più scomoda da scoprire dopo.
- Quando si promuove la produzione: dipende dai costi, e i costi dipendono da quanti utenti.

## Nota

Questa lane non produce niente di visibile, e per questo è quella che slitta. Il piano la mette al primo posto perché è l'unica sequenza in cui sbagliare l'ordine è irreversibile.
