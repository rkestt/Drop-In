import { describe, expect, it } from "vitest";
import {
  INSTALL_DISMISS_KEY,
  INSTALL_DISMISS_TTL_MS,
  dismissalExpired,
  isIosDevice,
  isStandaloneDisplayMode,
  readDismissedAt,
  shouldShowInstallPrompt,
} from "@/lib/pwa/install";

describe("costanti", () => {
  it("chiave di dismissal versionata per nome", () => {
    expect(INSTALL_DISMISS_KEY).toBe("pwa-install-dismissed-at");
  });

  it("TTL di 30 giorni in ms", () => {
    expect(INSTALL_DISMISS_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe("shouldShowInstallPrompt", () => {
  const base = {
    hasDeferredPrompt: true,
    dismissedAt: null,
    now: 1_000_000_000,
    isStandalone: false,
  };

  it("mostra quando c'è il prompt, mai installata, mai rimandata", () => {
    expect(shouldShowInstallPrompt(base)).toBe(true);
  });

  it("nasconde quando già installata (standalone)", () => {
    expect(shouldShowInstallPrompt({ ...base, isStandalone: true })).toBe(
      false,
    );
  });

  it("nasconde senza deferred prompt", () => {
    expect(
      shouldShowInstallPrompt({ ...base, hasDeferredPrompt: false }),
    ).toBe(false);
  });

  it("nasconde con dismissal recente (dentro il TTL)", () => {
    expect(
      shouldShowInstallPrompt({
        ...base,
        dismissedAt: base.now - INSTALL_DISMISS_TTL_MS + 60_000,
      }),
    ).toBe(false);
  });

  it("mostra con dismissal scaduto (oltre il TTL)", () => {
    expect(
      shouldShowInstallPrompt({
        ...base,
        dismissedAt: base.now - INSTALL_DISMISS_TTL_MS - 1,
      }),
    ).toBe(true);
  });

  it("standalone vince anche con prompt disponibile", () => {
    expect(
      shouldShowInstallPrompt({ ...base, isStandalone: true }),
    ).toBe(false);
  });
});

describe("readDismissedAt", () => {
  it("null -> null", () => {
    expect(readDismissedAt(null)).toBeNull();
  });

  it("spazzatura -> null", () => {
    expect(readDismissedAt("non-un-numero")).toBeNull();
    expect(readDismissedAt("")).toBeNull();
    expect(readDismissedAt("   ")).toBeNull();
    expect(readDismissedAt("NaN")).toBeNull();
    expect(readDismissedAt("Infinity")).toBeNull();
    expect(readDismissedAt("-5")).toBeNull();
  });

  it("numero valido come stringa", () => {
    expect(readDismissedAt("1720000000000")).toBe(1720000000000);
  });

  it("stringa '0' -> 0", () => {
    expect(readDismissedAt("0")).toBe(0);
  });

  it("tollera spazi intorno", () => {
    expect(readDismissedAt("  42  ")).toBe(42);
  });
});

describe("dismissalExpired / TTL boundary", () => {
  const now = 5_000_000_000;

  it("null -> scaduto (mai rimandata)", () => {
    expect(dismissalExpired(null, now)).toBe(true);
  });

  it("esattamente 30 giorni -> scaduto (boundary inclusivo)", () => {
    expect(dismissalExpired(now - INSTALL_DISMISS_TTL_MS, now)).toBe(true);
  });

  it("un ms prima dei 30 giorni -> ancora valida", () => {
    expect(dismissalExpired(now - INSTALL_DISMISS_TTL_MS + 1, now)).toBe(false);
  });

  it("dopo 30 giorni -> scaduto", () => {
    expect(dismissalExpired(now - INSTALL_DISMISS_TTL_MS - 1, now)).toBe(true);
  });
});

describe("isIosDevice", () => {
  it("iPhone", () => {
    expect(
      isIosDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });

  it("iPad", () => {
    expect(
      isIosDevice(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });

  it("iPod", () => {
    expect(
      isIosDevice(
        "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });

  it("Chrome desktop -> false", () => {
    expect(
      isIosDevice(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });
});

describe("isStandaloneDisplayMode", () => {
  it("pass-through del match di display-mode", () => {
    expect(isStandaloneDisplayMode(true)).toBe(true);
    expect(isStandaloneDisplayMode(false)).toBe(false);
  });
});
