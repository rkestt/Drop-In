# Fondamenta

**Orizzonte**: primavera, e tutto **prima** che entri un solo estraneo.
**Obiettivo**: niente si rompe in modo irreversibile, e nessuno entra prima che sia lecito.
**Piano**: `docs/plans/spring.md`, voci 8a, 8b, 9.

## Stato

Pagine legali con `[DA COMPILARE]`. Eliminazione account self-service ed export dati fatti (#94, 2026-11-18). Backup provato in locale 2026-11-18 (drill eseguito, runbook §7 in `docs/staging.md`); restore su staging cronometrato e RTO remoto restano all'umano. SMTP di default di Supabase: **2 email/ora**, e in molti progetti solo verso indirizzi del team. Produzione ferma a schema `022` mentre master è avanti di tredici migrazioni.

## Voci

| Voce | Ticket | Stato |
| --- | --- | --- |
| Eliminazione account ed export dati (codice) | #94 | fatto 2026-11-18 — self-service con 409 sulle lobby condivise, export JSON, `creator_id` nullable |
| Privacy, ToS, cookie (testi) | #83 | aperto, dopo |
| Backup + ripristino provato, promozione produzione | #85 | backup provato in locale 2026-11-18 (`scripts/backup-db.sh` + `scripts/restore-db.sh`, `--dry-run`, produzione vietata per costruzione; drill eseguito: dump 1,2 MB → restore in scratch → conteggi identici — 10.130 campi, 51 migrazioni, `nearby_courts` 200 righe; runbook §7 in `docs/staging.md` con RPO/RTO e checklist umana). Residuo esplicito all'umano: restore su staging cronometrato e RTO remoto. Pipeline CI/CD e promotion delle migrazioni restano aperte, non sono questa voce |
| SMTP dedicato | #86 | aperto — blocca #95 |
| Rate limit, moderazione foto, anti-spam | #84 | aperto |
| Monitoraggio e uptime | #88 | aperto, non gate |
| Età minima e consenso dei minori | #97 | aperto |

## Decisioni chiuse

- La voce legale si spezza: **8a codice presto** (tocca schema, cascade e storage), **8b testi tardi**.
- **8a fatta (2026-11-18**, `d62bc2b`+`911bdc7`+`3ea71e3`+`e3a91c0`): eliminazione self-service (`POST /api/account/delete`, 409 sulle lobby non finite con altri iscritti, storage prima del database, scrub di `data->'user_id'` sulle notifiche altrui, `lobbies.creator_id` nullable), export JSON (`GET /api/account/export`), sezione dati nelle impostazioni con fallback "Giocatore eliminato". Resta scoperto: e2e (#101), guardrail search_path (#102), testi legali 8b (#83).
- Niente analytics di terze parti e niente Sentry, con criteri di riapertura in `docs/observability.md`.
- Flusso di rilascio in quattro migrazioni sul core loop, non un big bang.

## Decisioni aperte

- **Minori.** La pallavolo e il basket di strada sono sport di ragazzini: serve un'età minima e una regola di consenso (in Italia l'età per il consenso digitale è 14 anni). Oggi non esiste nessun controllo. È la voce legale più facile da dimenticare e la più scomoda da scoprire dopo.
- Quando si promuove la produzione: dipende dai costi, e i costi dipendono da quanti utenti.

## Nota

Questa lane non produce niente di visibile, e per questo è quella che slitta. Il piano la mette al primo posto perché è l'unica sequenza in cui sbagliare l'ordine è irreversibile.
