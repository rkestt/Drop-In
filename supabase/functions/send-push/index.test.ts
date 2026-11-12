// Test della logica pura di `delivery.ts`. Si lancia con:
//   deno test --allow-env supabase/functions/send-push/
import { assertEquals } from "jsr:@std/assert";
import {
  attemptPatch,
  isDeliverable,
  MAX_PUSH_ATTEMPTS,
  shouldDropSubscription,
  type PushRow,
} from "./delivery.ts";

const NOW = new Date("2026-11-12T12:00:00.000Z");

function row(overrides: Partial<PushRow> = {}): PushRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    push_sent_at: null,
    push_failed_at: null,
    push_attempts: 0,
    ...overrides,
  };
}

Deno.test("isDeliverable: riga nuova e' recapitabile", () => {
  assertEquals(isDeliverable(row()), true);
});

Deno.test("isDeliverable: cap tentativi (attempts = 5 non recapitabile)", () => {
  assertEquals(
    isDeliverable(row({ push_attempts: MAX_PUSH_ATTEMPTS })),
    false,
  );
  assertEquals(
    isDeliverable(row({ push_attempts: MAX_PUSH_ATTEMPTS - 1 })),
    true,
  );
});

Deno.test("isDeliverable: gia' recapitata non recapitabile", () => {
  assertEquals(
    isDeliverable(row({ push_sent_at: NOW.toISOString() })),
    false,
  );
});

Deno.test("isDeliverable: marcata fallita non recapitabile", () => {
  assertEquals(
    isDeliverable(row({ push_failed_at: NOW.toISOString() })),
    false,
  );
});

Deno.test("attemptPatch: successo => push_sent_at", () => {
  assertEquals(attemptPatch({ kind: "delivered" }, row(), NOW), {
    push_sent_at: NOW.toISOString(),
  });
});

Deno.test("attemptPatch: fallimento => retry (attempts + 1, senza failed_at)", () => {
  assertEquals(
    attemptPatch({ kind: "failed" }, row({ push_attempts: 2 }), NOW),
    { push_attempts: 3 },
  );
});

Deno.test("attemptPatch: ultimo tentativo => failed_at", () => {
  assertEquals(
    attemptPatch(
      { kind: "failed" },
      row({ push_attempts: MAX_PUSH_ATTEMPTS - 1 }),
      NOW,
    ),
    {
      push_attempts: MAX_PUSH_ATTEMPTS,
      push_failed_at: NOW.toISOString(),
    },
  );
});

Deno.test("shouldDropSubscription: 404/410 true, il resto false", () => {
  assertEquals(shouldDropSubscription(404), true);
  assertEquals(shouldDropSubscription(410), true);
  assertEquals(shouldDropSubscription(500), false);
  assertEquals(shouldDropSubscription(429), false);
  assertEquals(shouldDropSubscription(201), false);
  assertEquals(shouldDropSubscription(null), false);
});
