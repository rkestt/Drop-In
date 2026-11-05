# Supabase Realtime for lobbies: presence, lifecycle, cleanup

Research notes for Drop-In (Next.js 15 App Router, `@supabase/supabase-js` 2.105, `@supabase/ssr` 0.10).
Scope: lobby presence ("who is in this lobby right now"), lobby lifecycle events (join/leave/close),
and the subscription patterns that survive reconnects and React 19 mounts.

All claims marked **[docs]** come from the official Supabase documentation/repo (sources at the bottom).
Claims marked **[inference]** are derived reasoning, not quoted policy.

---

## 0. Current state in this repo

| Component | Channel | Mechanism |
|---|---|---|
| `app/(app)/page.tsx:91` | `"lobbies"` | `postgres_changes` `*` on `public.lobbies` → full refetch |
| `components/lobby/lobby-list.tsx:102` | `"lobby-list"` | `postgres_changes` `*` on `lobbies` + `lobby_participants` → full refetch |
| `components/karma/ban-banner.tsx:33` | `profile-${userId}` | `postgres_changes` on profile |
| `components/notifications/notification-toast.tsx:31` | `profile-toast-${userId}` | `postgres_changes` |
| `components/report/reported-courts-indicator.tsx:32` | `reported-courts` | `postgres_changes` |

Observations that drive the recommendations below:

1. **No presence anywhere.** "N people in this lobby" is derived from `lobby_participants` rows.
   That is actually the *right* primary source (see §2), but it cannot express "user has the
   lobby screen open right now", and a closed tab leaves a stale participant row until the
   `pg_cron` auto-checkout fires (2h) or the user leaves.
2. **Every subscription is `postgres_changes` with `event: "*"`** and ignores the payload
   (refetch on any change). Correct for consistency, but it means N subscribers × M rows.
3. **`.subscribe()` is called with no status callback** in all five files. Join failures
   (`TIMED_OUT`, `CHANNEL_ERROR`, `CLOSED`, RLS/`private` mismatch) are therefore silent:
   the app looks "live" and simply never updates.
4. **No publication is declared in `supabase/migrations/`.** `supabase/config.toml` only has
   `[realtime] enabled = true`. Works on hosted projects that auto-enable all `public` tables,
   but nothing in the repo *proves* `lobbies` / `lobby_participants` are published →
   `postgres_changes` silently delivers nothing (same silent-failure class as #3).
5. **Cleanup uses `supabase.removeChannel(channel)`** — this is the correct call (see §4).

---

## 1. Choose the primitive per job

Supabase Realtime is three products sharing one WebSocket:

| Primitive | Shape | Use for |
|---|---|---|
| **Presence** | ephemeral per-client state, keyed, in-memory | "who is viewing/lobbying right now" |
| **Broadcast** | fire-and-forget messages per topic | "lobby full", "game starting", typing, cursor |
| **Postgres Changes** | DB WAL → filtered events, per-subscriber RLS | durable row state (lobby created/closed, participants) |

Decision rule **[docs]**:

- Postgres Changes authorizes **every event against every subscriber** and processes changes on a
  **single thread**; the docs explicitly say to switch to Broadcast above **~3,000 concurrent
  subscribers** on the same change stream, because Broadcast fans out once instead of N times.
  **[docs]** (postgres-changes page)
- Presence is for state that changes slowly. The docs warn that calling `track()` on every mouse
  move floods the channel; high-frequency updates belong to Broadcast. **[docs]**
- Presence state is *ephemeral*: it lives in the Realtime server's merged view, it is not a table,
  it is not queryable via PostgREST, and it disappears with the socket. **Never use presence as
  the source of truth for "is this user checked in".** **[docs + inference]**

### Recommendation for Drop-In

- **Lobby list / court page ("there is a lobby, 2/10 players, it closed")** → keep
  `postgres_changes` on `lobbies` + `lobby_participants`. This is durable state, needs RLS,
  and volume is low (a few rows in Rome). No change needed beyond fixing #3/#4.
- **"3 people are looking at this lobby right now"** → new **Presence** channel keyed by
  `lobby:<id>`. Use it for soft signals and UI ("X sta guardando"), never for capacity or
  check-in counting.
- **"Game starting, go to /lobbies/<id>"** → **Broadcast** on the same private channel, sent from
  the client that triggers the transition (or from the DB, see §5).
- **Lobby close from `pg_cron`** → Postgres Changes already covers it; do not broadcast it too.
  Double-notifying from two transports is the most common source of duplicate toasts.

---

## 2. Presence: the details that bite

```ts
// browser only, inside a client component
const channel = supabase.channel(`lobby:${lobbyId}`, {
  config: {
    private: true,                 // required to enforce RLS on realtime.messages
    presence: { key: user.id },    // stable per user; default is a server-generated UUIDv1
  },
})
```

- **`key` matters.** Default key is a random UUIDv1 per client, so the same human on phone + laptop
  appears twice. Passing `key: user.id` makes `presenceState()` keyed by user, and makes
  "one entry per user" easy (`Object.keys(state).length`). The key must be unique among clients.
  **[docs]**
- **`presenceState()` shape**: `{ [key]: Array<{ ...meta, presence_ref }> }` — an **array** per key.
  If you keep the default key, one key = one connection. If you force `key: user.id`, multiple tabs
  collapse into one array entry, and you should dedupe with `new Set` over `presence_ref` only if
  you actually want connections, not users. **[docs + inference]**
- **`track()` must run after `SUBSCRIBED`**, not before. Calling it on the channel before the join
  completes resolves `"timed out"` (the official e2e suite asserts on exactly that string).
  **[docs]**
- **`sync` ≈ full snapshot; `join`/`leave` are deltas.** During a `sync`, `join` and `leave` can
  fire together due to reconciliation *even when no user actually joined or left*. Always render
  from `presenceState()`, treat `join`/`leave` as "re-render now" hints. **[docs]**
- **Presence sends also fire your own handlers** (`track` triggers your own `sync`/`join`), so
  "self" is included by default for presence; the `broadcast: { self: true }` option is about
  broadcast only. **[docs]**
- **`untrack()`** stops tracking and fires `leave` elsewhere. Call it on explicit navigation away
  ("leave lobby" button). Do **not** rely on it for tab close — see §4.
- **Rate limits are tight**: presence calls per client **5 per 30 s** on every plan; presence
  messages per second 20 (Free) / 50 (Pro); 10 keys per presence object. **[docs]** → never
  `track()` from a scroll/mousemove handler, and never `track()` on every render.

### Presence + Next.js

- Presence requires an authenticated JWT when the channel is `private: true`. With
  `createBrowserClient` from `@supabase/ssr`, the client is a **singleton** and supabase-js keeps
  Realtime's auth token in sync with the session (including refreshes). **[docs]**
- Server Components cannot hold a socket. Presence must live in a `"use client"` leaf that is
  mounted only while the user is actually on the lobby screen — do not mount it in the root layout.
- Presence is **not** a membership record. If the product needs "this user is in this lobby",
  that is a `lobby_participants` row (durable, RLS, counted by the DB). Presence answers
  "who is *watching*", which is a different question.

---

## 3. Postgres Changes: what it actually guarantees

- **Publication is opt-in.** A table must be in the `supabase_realtime` publication:
  `alter publication supabase_realtime add table your_table_name;` **[docs]**
  Add it as an idempotent migration so local dev and prod agree:
  ```sql
  do $$ begin
    alter publication supabase_realtime add table public.lobbies, public.lobby_participants;
  exception
    when duplicate_object then null;  -- already a member
    when undefined_object then null;  -- publication missing (fresh local db)
  end $$;
  ```
- **DELETE bypasses RLS.** RLS is not applied to `DELETE` because Postgres cannot verify access to
  a deleted row, so delete events are broadcast to subscribers regardless of policy. If `old`
  records are needed (update/delete), set `alter table ... replica identity full;` — the default
  identity only carries the primary key. **[docs]**
- **Filters**: only `eq` / `neq` / `lt` / `lte` / `gt` / `gte` / `in` (max 100 values), combined with
  `AND` only — **no `OR`**. No joins, no filtering on joined tables. For "lobbies of this court"
  use `filter: 'court_id=eq.<id>'` on the `lobbies` channel instead of filtering client-side.
  **[docs]**
- **No replay, no delivery guarantee.** Postgres Changes is a stream of committed changes; nothing
  in the docs promises at-least-once delivery or backfill after a disconnect. The docs' own
  pattern is exactly what this repo does: **refetch the state on event + on (re)subscribe**.
  **[docs + inference]** That is the correct architecture — do not "optimize" it into
  `setState(payload.new)` without a reconciliation path, or a 5 s network blip leaves stale UI.
- **Payload size**: 1,024 KB per Postgres change on all plans; when exceeded, `new`/`old` only
  include fields whose value is ≤ 64 bytes. **[docs]** Lobby rows are small, so fine — but do not
  put avatars/JSON blobs on `profiles` and expect them in the payload.
- **Authorization cost**: each event is RLS-authorized per subscriber, single-threaded. At Drop-In's
  scale (Rome, dozens of courts) this is a non-issue; it becomes one at thousands of concurrent
  subscribers on the same stream. **[docs]**

### On `event: "*"` + full refetch

Refetching on every change is simple and self-healing, which is why it is the recommended default
here. Two refinements that are cheap and safe:

- **Debounce/coalesce** the refetch (~150–250 ms) so a burst of participant inserts on a busy
  court produces one query, not five. Keep the debounce in a ref, and flush on `visibilitychange`.
- **Narrow the subscription** to the events you actually need. `*` on `lobby_participants` also
  fires for rows of lobbies the user cannot see (RLS filters those out, but the callback still
  runs for permitted ones only). If a list only ever needs `INSERT`/`DELETE`, say so.

---

## 4. Lifecycle, cleanup, reconnection

### The cleanup contract

```ts
useEffect(() => {
  let cancelled = false
  const channel = supabase
    .channel(`lobby:${lobbyId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, scheduleRefresh)
    .on('presence', { event: 'sync' }, () => setViewers(snapshot(channel)))
    .subscribe((status, err) => {
      if (cancelled) return
      if (status === 'SUBSCRIBED') { channel.track({ joined_at: new Date().toISOString() }) }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { /* see rejoin below */ }
    })

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}, [lobbyId, supabase])
```

- **`removeChannel()` vs `unsubscribe()`**: `removeChannel` unsubscribes **and removes the channel
  from the client's channel registry**. `unsubscribe()` leaves a closed channel object registered.
  Channels per connection are capped at **100** on every plan, so leaking them eventually produces
  `too_many_channels`. In React, `removeChannel` is the right call in the effect cleanup.
  **[docs]**
- **React 19 StrictMode** double-invokes effects in dev: create → cleanup (`removeChannel`) →
  create. This is safe *because* you return `removeChannel`. What is **not** safe is reusing one
  channel object across mounts or calling `.subscribe()` twice on the same instance — supabase-js
  throws on multiple subscribes to the same channel. Always construct a fresh channel inside the
  effect. **[inference from client API behavior]**
- **Topic reuse**: two live components on the same topic (`lobby-list` in two places) create two
  socket-level joins to one topic. Pointless but legal; if it becomes a real problem, hoist the
  subscription into a provider and share it.
- **`supabase` in deps**: with `createBrowserClient` the underlying instance is a singleton, so
  this dep is stable. Keep it — it documents the dependency and is a no-op when stable. **[docs]**
- **Tab close / navigation**: the socket closes when the document is destroyed; the server then
  emits `leave` for presence, and cleans up its own presence state. `untrack()` in
  `beforeunload` is unreliable (async, may not flush) — treat presence teardown as
  "eventually, on socket close". **Presence TTL / heartbeat timeout is not documented**, so do not
  build a timeout-based UI on it. **[docs + inference]**

### Reconnection

- The socket reconnects automatically; channels rejoin. `subscribe(status)` reports
  `SUBSCRIBED | TIMED_OUT | CLOSED | CHANNEL_ERROR`. **[docs]**
- Server-side, join failures (bad JWT, rate limit, DB down) are backed off by
  `CHANNEL_ERROR_BACKOFF_MS` (default **5000 ms**) to prevent reconnection storms. Realtime also
  retries its own Postgres subscription with exponential backoff and surfaces `system` events of
  the form `{ extension: 'postgres_changes', status: 'ok' | 'error', message }`. **[docs]**
- Practical rules:
  1. **Always pass the status callback** and log `status` + `error`. Silent `.subscribe()` is why
     the current app can be "connected but dead" (RLS deny, table not published, dead token).
  2. On `CHANNEL_ERROR`/`TIMED_OUT`: **refetch once** (hedges missed events) and re-create the
     channel with jittered backoff (e.g. 1s, 2s, 4s, cap 30s). Do not tight-loop re-join — the
     join rate limiter (`too_many_joins`) will start rejecting you.
  3. On `SUBSCRIBED` **after** a previous failure: refetch. This is the only reliable way to
     recover state missed while offline, because Postgres Changes has no replay. **[inference]**
  4. Mobile/laptop sleep: sockets are frozen, not closed. Listen to `visibilitychange` and refetch
     when the document becomes visible again — cheaper and more reliable than trusting the socket.
     **[inference]**
- **Token expiry** does not kill an established channel in normal operation; supabase-js refreshes
  the token and updates Realtime auth. If you ever create a client with a hand-managed token, call
  `supabase.realtime.setAuth(token)` after refresh. Do not construct a second client "to fix auth"
  — two sockets, two channel registries, duplicated events. **[inference]**

---

## 5. Private channels and RLS (the part that must ship before presence)

Public channels need no policy; **private channels authorize joins and messages against RLS on
`realtime.messages`**, evaluated with the caller's role and JWT claims, with
`realtime.topic()` holding the channel topic. Both `SELECT` (receive/join) and `INSERT`
(track/send) policies are required. **[docs]**

```sql
-- one private topic family for lobbies: "lobby:<uuid>"
create policy "lobby members can read realtime"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1 from public.lobby_participants p
    where p.user_id = (select auth.uid())
      and ('lobby:' || p.lobby_id::text) = (select realtime.topic())
  )
);

create policy "lobby members can publish realtime"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1 from public.lobby_participants p
    where p.user_id = (select auth.uid())
      and ('lobby:' || p.lobby_id::text) = (select realtime.topic())
  )
);
```

Notes:

- Always write `(select auth.uid())` / `(select realtime.topic())` — the subselect form lets
  Postgres plan the policy once instead of per row (same rule as normal Supabase RLS guidance).
- `realtime.messages` has **no default SELECT policy**; the docs' quickstart policies
  (`using (true)`) are the "any authenticated user may join anything" shortcut. Do not ship those
  with a topic-per-lobby design.
- On hosted projects, also disable **Allow public access** in Realtime settings if every channel
  should require auth. **[docs]**
- Privileged transitions (lobby full → `status = 'full'`, close) should be written by the API/DB,
  not broadcast by a client: a client-sent "lobby closed" is a spoofable message. Postgres Changes
  on the `lobbies` row is the trustworthy path; a **database broadcast** (`realtime.send(...)`,
  private by default) is the low-latency path when a row change is too coarse. Database broadcasts
  are persisted in `realtime.messages` for ~72 h; client broadcasts are not replayable. **[docs]**

---

## 6. Concrete plan for Drop-In

1. **Migration**: idempotently add `lobbies`, `lobby_participants`, `profiles`, `court_reports`
   to `supabase_realtime`; add `replica identity full` only where `old` values are needed
   (`lobbies` probably yes, `lobby_participants` no).
2. **Status callbacks everywhere**: turn `.subscribe()` into `.subscribe((status, err) => …)`,
   log `status`/`err`, and trigger a refetch on `SUBSCRIBED`-after-failure. This alone fixes the
   silent-dead-subscription class of bugs in the five existing files.
3. **Debounce refetches** (~200 ms) in `page.tsx` and `lobby-list.tsx`; keep refetch as the
   recovery mechanism.
4. **Lobby presence** (`lobby:<id>`, `private: true`, `presence: { key: user.id }`) mounted only
   in the lobby screen, showing "X watching". Not a capacity source.
5. **Broadcast** for instant "game starting" UX on the same private topic, sent by the API route
   that mutates the lobby (or `realtime.send` from the DB), never trusting a client payload.
6. **Cleanup audit**: keep `removeChannel`; ensure every new channel is created *inside* the
   effect and removed in cleanup (100 channels/connection cap).

Do **not** migrate the lobby list from Postgres Changes to Broadcast now. Broadcast has no replay
and no durable state; it would trade a self-healing refetch for hand-rolled cache invalidation.

---

## Sources

Official documentation (fetched 2026-10-30):

- Postgres Changes — https://supabase.com/docs/guides/realtime/postgres-changes
  (publication opt-in, DELETE/RLS, `replica identity full`, filter limits, 3k subscriber guidance)
- Presence — https://supabase.com/docs/guides/realtime/presence
  (key semantics, `presenceState` shape, sync/join/leave reconciliation, `track` after SUBSCRIBED,
  `untrack`, "use Broadcast for high-frequency updates")
- Broadcast — https://supabase.com/docs/guides/realtime/broadcast
  (`private` default for DB broadcasts, `self`, `ack`, replay for private channels, 72 h retention
  of DB broadcasts, REST/REST-batch endpoints)
- Realtime Authorization — https://supabase.com/docs/guides/realtime/authorization
  (`private: true`, policies on `realtime.messages`, `realtime.topic()`, extension filters)
- Realtime Limits — https://supabase.com/docs/guides/realtime/limits
  (connections/channels/messages per plan, presence 5 calls per 30 s, payload sizes)
- Creating a Supabase client for SSR (Next.js) —
  https://supabase.com/docs/guides/auth/server-side/creating-a-client
  (`createBrowserClient` singleton, browser client is the one used for realtime)
- Realtime source of truth for client statuses and server backoff:
  `supabase/realtime` — `assets/js/app.js` (`SUBSCRIBED`/`TIMED_OUT`/`CLOSED` handling),
  `lib/realtime_web/channels/realtime_channel.ex` (postgres subscribe retry/backoff, `system` events),
  `ENVS.md` (`CHANNEL_ERROR_BACKOFF_MS`, default 5000 ms),
  `priv/repo/tenant_schema/realtime/functions/authorize.sql` (how RLS on `realtime.messages`
  is probed per channel join).

Repo files inspected: `app/(app)/page.tsx`, `components/lobby/lobby-list.tsx`,
`components/karma/ban-banner.tsx`, `components/notifications/notification-toast.tsx`,
`components/report/reported-courts-indicator.tsx`, `lib/supabase/client.ts`,
`supabase/config.toml`, `supabase/migrations/001_initial_schema.sql`.
