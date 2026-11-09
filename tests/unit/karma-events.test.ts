import { describe, expect, it } from "vitest";
import { profileChangeEvents } from "@/components/notifications/karma-events";

describe("profileChangeEvents", () => {
  it("calo karma → un solo evento con id stabile legato al nuovo valore", () => {
    const oldProfile = { karma_score: 90, banned_until: null };
    const newProfile = { karma_score: 87, banned_until: null };

    const first = profileChangeEvents(oldProfile, newProfile);
    const second = profileChangeEvents(oldProfile, newProfile);

    expect(first).toHaveLength(1);
    expect(first[0].kind).toBe("karma_drop");
    expect(first[0].id).toBe("karma-87");
    // Stesso payload due volte → stesso id: Sonner sostituisce, non accoda.
    expect(second[0].id).toBe(first[0].id);
    expect(first[0].title).toContain("87");
  });

  it("ban applicato → evento error con id stabile", () => {
    const events = profileChangeEvents(
      { karma_score: 90, banned_until: null },
      { karma_score: 90, banned_until: "2026-11-16T10:00:00.000Z" }
    );

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("ban_applied");
    expect(events[0].id).toBe("ban-2026-11-16T10:00:00.000Z");
  });

  it("recupero karma → evento success", () => {
    const events = profileChangeEvents(
      { karma_score: 87, banned_until: null },
      { karma_score: 89, banned_until: null }
    );

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("karma_recovery");
    expect(events[0].id).toBe("karma-89");
  });

  it("nessun cambiamento → nessun evento", () => {
    expect(
      profileChangeEvents(
        { karma_score: 90, banned_until: null },
        { karma_score: 90, banned_until: null }
      )
    ).toEqual([]);
  });

  it("calo + ban insieme → due eventi distinti", () => {
    const events = profileChangeEvents(
      { karma_score: 90, banned_until: null },
      { karma_score: 87, banned_until: "2026-11-16T10:00:00.000Z" }
    );

    expect(events.map((e) => e.kind)).toEqual(["karma_drop", "ban_applied"]);
  });
});
