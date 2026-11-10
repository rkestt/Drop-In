import { describe, expect, it } from "vitest";
import {
  formatRelativeTime,
  notificationHref,
  notificationKind,
} from "@/lib/notifications/link";

const COURT = "123e4567-e89b-12d3-a456-426614174000";
const LOBBY = "123e4567-e89b-12d3-a456-426614174001";

describe("notificationHref", () => {
  it("court_id valido porta a /courts/<uuid>", () => {
    expect(notificationHref({ court_id: COURT })).toBe(`/courts/${COURT}`);
  });

  it("solo lobby_id valido porta alla lista lobby (niente /lobbies/<id>)", () => {
    expect(notificationHref({ lobby_id: LOBBY, type: "participant_joined" })).toBe(
      "/lobbies"
    );
  });

  it("court_id vince su lobby_id quando entrambi validi", () => {
    expect(
      notificationHref({ court_id: COURT, lobby_id: LOBBY })
    ).toBe(`/courts/${COURT}`);
  });

  it("UUID maiuscoli con spazi vengono normalizzati", () => {
    expect(
      notificationHref({ court_id: `  ${COURT.toUpperCase()} ` })
    ).toBe(`/courts/${COURT}`);
  });

  it.each([
    ["uuid non valido", { court_id: "abc" }],
    ["path traversal nel campo", { court_id: "../../etc" }],
    ["campo non stringa", { court_id: 42 }],
    ["data null", null],
    ["data stringa", "lobby"],
    ["data array", [COURT]],
    ["oggetto vuoto", {}],
    ["solo type senza id", { type: "karma_loss" }],
  ])("non naviga e non lancia errori: %s", (_label, data) => {
    expect(notificationHref(data)).toBeNull();
  });
});

describe("notificationKind", () => {
  it.each([
    [{ kind: "lobby" }, "lobby"],
    [{ type: "lobby_starting_soon" }, "lobby"],
    [{ type: "participant_joined" }, "lobby"],
    [{ type: "karma_loss" }, "karma"],
    [{ kind: "karma" }, "karma"],
    [{ kind: "ban" }, "ban"],
    [{ kind: "checkin" }, "checkin"],
    [{ kind: "weather" }, "weather"],
  ])("%o → %s", (data, expected) => {
    expect(notificationKind(data)).toBe(expected);
  });

  it.each([[null], [undefined], ["x"], [{}], [{ kind: 42 }]])(
    "fallback neutro: %o",
    (data) => {
      expect(notificationKind(data)).toBe("neutral");
    }
  );
});

describe("formatRelativeTime", () => {
  const NOW = new Date("2026-11-10T12:00:00Z").getTime();
  it("sotto il minuto dice Adesso", () => {
    expect(
      formatRelativeTime(new Date(NOW - 30_000).toISOString(), NOW)
    ).toBe("Adesso");
  });
  it("minuti, ore, giorni", () => {
    expect(
      formatRelativeTime(new Date(NOW - 22 * 60_000).toISOString(), NOW)
    ).toBe("22 min fa");
    expect(
      formatRelativeTime(new Date(NOW - 2 * 3_600_000).toISOString(), NOW)
    ).toBe("2 ore fa");
    expect(
      formatRelativeTime(new Date(NOW - 4 * 86_400_000).toISOString(), NOW)
    ).toBe("4 giorni fa");
  });
  it("sent_at null o invalido → stringa vuota", () => {
    expect(formatRelativeTime(null, NOW)).toBe("");
    expect(formatRelativeTime("non-una-data", NOW)).toBe("");
  });
});
