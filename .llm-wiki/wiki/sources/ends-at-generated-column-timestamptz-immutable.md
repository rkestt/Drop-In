---
type: source
title: "ends_at come colonna generata: timestamptz + interval non è IMMUTABLE (42P17)"
slug: ends-at-generated-column-timestamptz-immutable
status: insight
category: "source"
created: 2026-11-17
updated: 2026-11-17
---

# ends_at come colonna generata: timestamptz + interval non è IMMUTABLE (42P17)

Verificato il 2026-11-17 su Drop-In (PG 17 locale, migrazione `036_lobby_duration_ends_at.sql`).

## Il problema

Una generated column vuole un'espressione **IMMUTABLE**. `start_time + duration_minutes * INTERVAL '1 minute'` su `timestamptz` è **STABLE** (l'aritmetica dipende dal `TimeZone` di sessione per i cambi d'ora), quindi Postgres risponde `42P17: generation expression is not immutable` e la migrazione non passa.

## La forma che passa

```sql
ALTER TABLE public.lobbies ADD COLUMN ends_at TIMESTAMPTZ
  GENERATED ALWAYS AS (
    timezone('UTC', timezone('UTC', start_time) + make_interval(mins => duration_minutes))
  ) STORED;
```

Gli overload `timezone(text, …)` sono IMMUTABLE: `timezone('UTC', timestamptz)` → `timestamp` con l'ora di parete UTC, si somma l'intervallo, `timezone('UTC', timestamp)` torna a `timestamptz` interpretandolo come UTC. **L'UTC non ha DST**, quindi l'istante assoluto è preservato: è il trucco che rende l'espressione dichiarativa senza cambiare semantica.

## Verifica da rifare quando si tocca

```sql
SELECT t, timezone('UTC', timezone('UTC', t) + make_interval(mins => 90)) - t
FROM (VALUES (timestamptz '2026-03-29 00:30:00+00'),
             (timestamptz '2026-10-25 00:30:00+00')) v(t);
-- atteso: 01:30:00 su entrambi (ingresso/uscita dall'ora legale italiana)
```

## Perché conviene rispetto alle alternative

- due copie dell'aritmetica (cron SQL + `formatAppCloseTime` in TS) divergono alla prima modifica: era il bug di #96;
- trigger che scrive `ends_at` = codice imperativo per un'invariante dichiarativa, e può divergere se qualcuno aggiorna fuori dal trigger;
- la generata è indicizzabile: `CREATE INDEX ... ON lobbies (ends_at) WHERE status IN ('open','in_progress')` serve al cron.

Nota: `ends_at` vale per la chiusura automatica e per il display; lo **sport** della Lobby resta una colonna separata (`lobbies.sport`), perché un Campo polivalente non basta a dire se due Lobby si sovrappongono davvero.

## Related

- [[test-all-verde-perche-meta-degli-e2e-si-skippa]]
