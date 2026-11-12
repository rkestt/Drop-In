import { describe, expect, it } from "vitest";
import {
  PUSH_OPT_IN_KEY,
  pushSupportState,
  readOptIn,
  subscriptionRow,
  urlBase64ToUint8Array,
  writeOptIn,
} from "@/lib/push/subscribe";

describe("urlBase64ToUint8Array", () => {
  it("decodifica una chiave base64url senza padding", () => {
    // "Hello" in base64url senza padding.
    const out = urlBase64ToUint8Array("SGVsbG8");
    expect(Array.from(out)).toEqual([72, 101, 108, 108, 111]);
  });

  it("gestisce i caratteri url-safe - e _", () => {
    const out = urlBase64ToUint8Array("AB-_");
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(3);
  });
});

describe("pushSupportState", () => {
  const base = {
    hasServiceWorker: true,
    hasPushManager: true,
    permission: "granted",
    isStandalone: true,
    hasVapidKey: true,
  };

  it("ready quando tutto e' disponibile", () => {
    expect(pushSupportState(base)).toBe("ready");
  });

  it("unsupported senza service worker o push manager", () => {
    expect(pushSupportState({ ...base, hasServiceWorker: false })).toBe(
      "unsupported",
    );
    expect(pushSupportState({ ...base, hasPushManager: false })).toBe(
      "unsupported",
    );
  });

  it("missing-key senza chiave VAPID", () => {
    expect(pushSupportState({ ...base, hasVapidKey: false })).toBe(
      "missing-key",
    );
  });

  it("blocked con permesso negato", () => {
    expect(pushSupportState({ ...base, permission: "denied" })).toBe(
      "blocked",
    );
  });

  it("ios-needs-install quando non standalone", () => {
    expect(pushSupportState({ ...base, isStandalone: false })).toBe(
      "ios-needs-install",
    );
  });

  it("il supporto tecnico vince sul resto", () => {
    expect(
      pushSupportState({
        ...base,
        hasServiceWorker: false,
        hasVapidKey: false,
        permission: "denied",
        isStandalone: false,
      }),
    ).toBe("unsupported");
  });
});

describe("subscriptionRow", () => {
  it("costruisce la riga per l'upsert", () => {
    const sub = { endpoint: "https://example.com/push", keys: {} };
    expect(subscriptionRow("uid-1", sub)).toEqual({
      user_id: "uid-1",
      subscription: sub,
    });
  });
});

describe("opt-in", () => {
  it("chiave versionata per nome", () => {
    expect(PUSH_OPT_IN_KEY).toBe("dropin:push-optin");
  });

  it("readOptIn: solo '1' e' opt-in", () => {
    expect(readOptIn("1")).toBe(true);
    expect(readOptIn(null)).toBe(false);
    expect(readOptIn("0")).toBe(false);
    expect(readOptIn("true")).toBe(false);
  });

  it("writeOptIn scrive e rimuove sullo storage dato", () => {
    const store = new Map<string, string>();
    const storage = {
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    writeOptIn(storage, true);
    expect(store.get(PUSH_OPT_IN_KEY)).toBe("1");
    writeOptIn(storage, false);
    expect(store.has(PUSH_OPT_IN_KEY)).toBe(false);
  });
});
