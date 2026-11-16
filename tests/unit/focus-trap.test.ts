import { describe, expect, it } from "vitest";
import { nextTrapTarget } from "@/lib/a11y/focus-trap";

const items = ["email", "password", "mostra", "accedi", "google", "registrati"];

describe("focus trap del Drawer (#29)", () => {
  it("Tab avanza e non esce mai dalla lista", () => {
    for (let i = 0; i < items.length - 1; i++) {
      expect(nextTrapTarget(items, i, false)).toBe(items[i + 1]);
    }
  });

  it("Tab sull'ultimo torna al primo (wrap)", () => {
    expect(nextTrapTarget(items, items.length - 1, false)).toBe(items[0]);
  });

  it("Shift+Tab torna indietro", () => {
    expect(nextTrapTarget(items, 3, true)).toBe(items[2]);
  });

  it("Shift+Tab sul primo va all'ultimo", () => {
    expect(nextTrapTarget(items, 0, true)).toBe(items[items.length - 1]);
  });

  it("focus fuori dalla lista (popup, heading, sentinella)", () => {
    expect(nextTrapTarget(items, -1, false)).toBe(items[0]);
    expect(nextTrapTarget(items, -1, true)).toBe(items[items.length - 1]);
  });

  it("lista vuota: nessun target, il chiamante blocca il Tab", () => {
    expect(nextTrapTarget([], 0, false)).toBeNull();
    expect(nextTrapTarget([], -1, true)).toBeNull();
  });

  it("lista di uno: resta su quell'elemento in entrambe le direzioni", () => {
    expect(nextTrapTarget(["solo"], 0, false)).toBe("solo");
    expect(nextTrapTarget(["solo"], 0, true)).toBe("solo");
  });
});
