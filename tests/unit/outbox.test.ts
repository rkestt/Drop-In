import { describe, expect, it } from "vitest";
import {
  MAX_OUTBOX_ITEMS,
  OUTBOX_STORAGE_KEY,
  OUTBOX_TTL_MS,
  applyOutboxResult,
  backoffMs,
  classifyOutboxError,
  createOutboxItem,
  dueOutbox,
  enqueueOutbox,
  outboxKey,
  parseOutbox,
  pruneOutbox,
  serializeOutbox,
  type OutboxItem,
} from "@/lib/offline/outbox";

const NOW = 1_700_000_000_000;

function item(
  kind: OutboxItem["kind"],
  id: string,
  extra: Partial<OutboxItem> = {},
): OutboxItem {
  const payload =
    kind === "check_in" ? { court_id: `court-${id}` } : { lobby_id: `lobby-${id}` };
  return {
    id,
    kind,
    key: outboxKey(kind, payload),
    payload,
    enqueuedAt: NOW,
    attempts: 0,
    nextAttemptAt: NOW,
    lastError: null,
    ...extra,
  };
}

describe("costanti", () => {
  it("chiave storage, TTL 2h, cap 20", () => {
    expect(OUTBOX_STORAGE_KEY).toBe("dropin:outbox:v1");
    expect(OUTBOX_TTL_MS).toBe(2 * 60 * 60 * 1000);
    expect(MAX_OUTBOX_ITEMS).toBe(20);
  });
});

describe("outboxKey", () => {
  it("namespace per kind con id", () => {
    expect(outboxKey("check_in", { court_id: "c1" })).toBe("check_in:c1");
    expect(outboxKey("lobby_join", { lobby_id: "l1" })).toBe("lobby_join:l1");
    expect(outboxKey("lobby_leave", { lobby_id: "l1" })).toBe("lobby_leave:l1");
  });

  it("check-in e join sulla stessa corte non collidono", () => {
    expect(outboxKey("check_in", { court_id: "x" })).not.toBe(
      outboxKey("lobby_join", { lobby_id: "x", court_id: "x" }),
    );
  });
});

describe("createOutboxItem", () => {
  it("default: id da crypto.randomUUID, attempts 0, due subito", () => {
    const it1 = createOutboxItem("check_in", { court_id: "c" }, NOW);
    expect(it1.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(it1.attempts).toBe(0);
    expect(it1.nextAttemptAt).toBe(NOW);
    expect(it1.enqueuedAt).toBe(NOW);
    expect(it1.lastError).toBeNull();
    expect(it1.key).toBe("check_in:c");
  });

  it("idFactory iniettata", () => {
    const it1 = createOutboxItem("lobby_join", { lobby_id: "l" }, NOW, () => "fisso");
    expect(it1.id).toBe("fisso");
  });
});

describe("enqueueOutbox", () => {
  it("accoda in coda", () => {
    const a = item("check_in", "a");
    const q = enqueueOutbox([], a, NOW);
    expect(q).toEqual([a]);
  });

  it("dedupe per key: payload nuovo, enqueuedAt originale, attempts azzerati", () => {
    const old = item("check_in", "a", { enqueuedAt: NOW - 1000, attempts: 3 });
    const fresh = createOutboxItem("check_in", { court_id: "court-a" }, NOW, () => "nuovo");
    const q = enqueueOutbox([old], fresh, NOW + 5000);
    expect(q).toHaveLength(1);
    expect(q[0].id).toBe("nuovo");
    expect(q[0].payload).toEqual({ court_id: "court-a" });
    expect(q[0].enqueuedAt).toBe(NOW - 1000);
    expect(q[0].attempts).toBe(0);
    expect(q[0].nextAttemptAt).toBe(NOW + 5000);
    expect(q[0].lastError).toBeNull();
  });

  it("join-then-leave collassa a niente da inviare", () => {
    const join = item("lobby_join", "j", {
      payload: { lobby_id: "L", user_id: "u" },
      key: "lobby_join:L",
    });
    const leave = createOutboxItem(
      "lobby_leave",
      { lobby_id: "L", user_id: "u" },
      NOW,
      () => "leave",
    );
    expect(enqueueOutbox([join], leave, NOW)).toEqual([]);
  });

  it("leave-then-join collassa a niente da inviare", () => {
    const leave = item("lobby_leave", "l", {
      payload: { lobby_id: "L", user_id: "u" },
      key: "lobby_leave:L",
    });
    const join = createOutboxItem(
      "lobby_join",
      { lobby_id: "L", user_id: "u" },
      NOW,
      () => "join",
    );
    expect(enqueueOutbox([leave], join, NOW)).toEqual([]);
  });

  it("leave senza join accodato resta in coda", () => {
    const leave = createOutboxItem(
      "lobby_leave",
      { lobby_id: "L", user_id: "u" },
      NOW,
      () => "leave",
    );
    expect(enqueueOutbox([], leave, NOW)).toEqual([leave]);
  });

  it("join/leave su lobby diverse non collassano", () => {
    const join = item("lobby_join", "j", {
      payload: { lobby_id: "A", user_id: "u" },
      key: "lobby_join:A",
    });
    const leave = createOutboxItem(
      "lobby_leave",
      { lobby_id: "B", user_id: "u" },
      NOW,
      () => "leave",
    );
    const q = enqueueOutbox([join], leave, NOW);
    expect(q.map((i) => i.id)).toEqual(["j", "leave"]);
  });

  it("cap 20: scarta il più vecchio", () => {
    let q: OutboxItem[] = [];
    for (let i = 0; i < MAX_OUTBOX_ITEMS; i++) {
      q = enqueueOutbox(
        q,
        createOutboxItem("check_in", { court_id: `c${i}` }, NOW + i, () => `id-${i}`),
        NOW + i,
      );
    }
    expect(q).toHaveLength(MAX_OUTBOX_ITEMS);
    const overflow = createOutboxItem("check_in", { court_id: "nuova" }, NOW + 999, () => "nuova");
    const capped = enqueueOutbox(q, overflow, NOW + 999);
    expect(capped).toHaveLength(MAX_OUTBOX_ITEMS);
    expect(capped.map((i) => i.id)).not.toContain("id-0");
    expect(capped.map((i) => i.id)).toContain("nuova");
  });
});

describe("pruneOutbox", () => {
  it("check-in scaduto esattamente a 2h via, lobby ops mai", () => {
    const oldCheck = item("check_in", "vecchio", { enqueuedAt: NOW - OUTBOX_TTL_MS });
    const youngCheck = item("check_in", "giovane", {
      enqueuedAt: NOW - OUTBOX_TTL_MS + 1,
    });
    const oldJoin = item("lobby_join", "join", { enqueuedAt: NOW - OUTBOX_TTL_MS - 1 });
    const oldLeave = item("lobby_leave", "leave", { enqueuedAt: 0 });
    const kept = pruneOutbox([oldCheck, youngCheck, oldJoin, oldLeave], NOW);
    expect(kept.map((i) => i.id).sort()).toEqual(["giovane", "join", "leave"]);
  });
});

describe("dueOutbox", () => {
  it("solo nextAttemptAt <= now", () => {
    const due = item("check_in", "due", { nextAttemptAt: NOW });
    const future = item("check_in", "futura", { nextAttemptAt: NOW + 1 });
    expect(dueOutbox([due, future], NOW).map((i) => i.id)).toEqual(["due"]);
  });
});

describe("classifyOutboxError", () => {
  it("null/undefined → transient", () => {
    expect(classifyOutboxError(null)).toBe("transient");
    expect(classifyOutboxError(undefined)).toBe("transient");
  });

  it("duplicate: messaggio reale UNIQUE del DB", () => {
    expect(
      classifyOutboxError(
        '23505 duplicate key value violates unique constraint "lobby_participants_lobby_id_user_id_key"',
      ),
    ).toBe("duplicate");
  });

  it("duplicate: già dentro (check-in e lobby)", () => {
    expect(classifyOutboxError("Hai già un check-in attivo su questo campo")).toBe("duplicate");
    expect(classifyOutboxError("Sei già dentro questa lobby.")).toBe("duplicate");
  });

  it("duplicate: cooldown 5 minuti", () => {
    expect(
      classifyOutboxError(
        "Devi attendere 5 minuti prima di fare di nuovo check-in su questo campo",
      ),
    ).toBe("duplicate");
  });

  it("permanent: 42501 RLS e Non autorizzato", () => {
    expect(classifyOutboxError("42501 new row violates row-level security policy")).toBe("permanent");
    expect(classifyOutboxError("Non autorizzato.")).toBe("permanent");
    expect(classifyOutboxError("Non autorizzato a modificare il profilo.")).toBe("permanent");
  });

  it("permanent: validazione P0001, karma, ban, limite", () => {
    expect(classifyOutboxError("P0001 Inserisci un nome o una foto.")).toBe("permanent");
    expect(classifyOutboxError("Karma troppo basso (45). Non puoi partecipare.")).toBe("permanent");
    expect(classifyOutboxError("Sei bannato fino a 2026-12-01")).toBe("permanent");
  });

  it("permanent: distanza con coordinate congelate", () => {
    expect(
      classifyOutboxError("Sei troppo lontano dal campo (120 m). Avvicinati per fare check-in."),
    ).toBe("permanent");
  });

  it("transient: rete e server generici", () => {
    expect(classifyOutboxError("Failed to fetch")).toBe("transient");
    expect(classifyOutboxError("NetworkError when attempting to fetch resource.")).toBe("transient");
    expect(classifyOutboxError("connection reset")).toBe("transient");
    expect(classifyOutboxError("")).toBe("transient");
  });

  it("duplicate vince su permanent quando entrambi matchano", () => {
    // Cooldown con codice P0001: resta "già registrato", non errore.
    expect(classifyOutboxError("P0001 Devi attendere 5 minuti")).toBe("duplicate");
  });
});

describe("backoffMs", () => {
  it("scala 5s, 15s, 60s, tetto 5min", () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(15_000);
    expect(backoffMs(3)).toBe(60_000);
    expect(backoffMs(4)).toBe(300_000);
    expect(backoffMs(5)).toBe(300_000);
    expect(backoffMs(99)).toBe(300_000);
  });
});

describe("applyOutboxResult", () => {
  const q = [item("check_in", "a"), item("lobby_join", "b")];

  it("ok rimuove", () => {
    const r = applyOutboxResult(q, "a", "ok", NOW);
    expect(r).toEqual({ queue: [q[1]], removed: true });
  });

  it("duplicate rimuove", () => {
    const r = applyOutboxResult(q, "a", "duplicate", NOW);
    expect(r.removed).toBe(true);
    expect(r.queue.map((i) => i.id)).toEqual(["b"]);
  });

  it("permanent rimuove senza retry", () => {
    const r = applyOutboxResult(q, "b", "permanent", NOW);
    expect(r.removed).toBe(true);
    expect(r.queue.map((i) => i.id)).toEqual(["a"]);
  });

  it("transient incrementa e riprogramma con backoff", () => {
    const first = applyOutboxResult(q, "a", "transient", NOW, "boom");
    expect(first.removed).toBe(false);
    expect(first.queue[0].attempts).toBe(1);
    expect(first.queue[0].nextAttemptAt).toBe(NOW + 5_000);
    expect(first.queue[0].lastError).toBe("boom");
    const second = applyOutboxResult(first.queue, "a", "transient", NOW, "boom2");
    expect(second.queue[0].attempts).toBe(2);
    expect(second.queue[0].nextAttemptAt).toBe(NOW + 15_000);
    expect(second.queue[0].lastError).toBe("boom2");
  });

  it("id assente: coda invariata, removed false", () => {
    const r = applyOutboxResult(q, "x", "ok", NOW);
    expect(r).toEqual({ queue: q, removed: false });
  });
});

describe("serializeOutbox / parseOutbox", () => {
  it("roundtrip", () => {
    const q = [item("check_in", "a"), item("lobby_leave", "b")];
    expect(parseOutbox(serializeOutbox(q))).toEqual(q);
  });

  it("spazzatura e forme errate: mai eccezioni, mai code rotte", () => {
    expect(parseOutbox(null)).toEqual([]);
    expect(parseOutbox("")).toEqual([]);
    expect(parseOutbox("non-json{{{")).toEqual([]);
    expect(parseOutbox(JSON.stringify({ foo: "bar" }))).toEqual([]);
    expect(parseOutbox(JSON.stringify([{ id: "x" }]))).toEqual([]);
    expect(
      parseOutbox(
        JSON.stringify([
          { ...item("check_in", "ok") },
          { ...item("check_in", "bad"), kind: "sconosciuto" },
          { ...item("check_in", "nan"), enqueuedAt: NaN },
          { ...item("check_in", "inf"), nextAttemptAt: Infinity },
          null,
          "stringa",
        ]),
      ).map((i) => i.id),
    ).toEqual(["ok"]);
  });
  it("taglia a MAX_OUTBOX_ITEMS (localStorage manomesso)", () => {
    const big = Array.from(
      { length: MAX_OUTBOX_ITEMS + 5 },
      (_, i) => item("check_in", `x${i}`),
    );
    expect(parseOutbox(serializeOutbox(big))).toHaveLength(MAX_OUTBOX_ITEMS);
  });
});
