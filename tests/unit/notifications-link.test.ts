import { describe, expect, it } from "vitest";
import {
  formatRelativeTime,
  notificationHref,
  notificationKind,
} from "@/lib/notifications/link";

const COURT = "123e4567-e89b-12d3-a456-426614174000";
const LOBBY = "123e4567-e89b-12d3-a456-426614174001";

describe("notificationHref", () => {
  it("court_id valido senza kind porta a /courts/<uuid>", () => {
    expect(notificationHref({ court_id: COURT })).toBe(`/courts/${COURT}`);
  });

  // Shape reale 002: notify_lobby_starting_soon (court + lobby + start).
  it("lobby_starting_soon di 002 porta al campo", () => {
    expect(
      notificationHref({
        type: "lobby_starting_soon",
        lobby_id: LOBBY,
        court_id: COURT,
        start_time: "2026-11-10T19:00:00+01:00",
      })
    ).toBe(`/courts/${COURT}`);
  });

  // Shape reale 002: notify_participant_joined (solo lobby).
  it("participant_joined di 002 porta alla lista lobby", () => {
    expect(
      notificationHref({
        type: "participant_joined",
        lobby_id: LOBBY,
        user_id: "999e4567-e89b-12d3-a456-426614174001",
      })
    ).toBe("/lobbies");
  });

  // Shape reale 002: karma_loss porta lobby_id ma va al profilo (prototipo).
  it("karma_loss di 002 porta al profilo, non alla lobby", () => {
    expect(
      notificationHref({
        type: "karma_loss",
        lobby_id: LOBBY,
        points_lost: 3,
      })
    ).toBe("/profile");
  });

  it("il kind vince sul court_id: karma con campo va al profilo", () => {
    expect(notificationHref({ kind: "karma", court_id: COURT })).toBe(
      "/profile"
    );
  });

  it("ban con lobby_id va al profilo", () => {
    expect(notificationHref({ kind: "ban", lobby_id: LOBBY })).toBe("/profile");
  });

  it("meteo/checkin con solo lobby_id non navigano", () => {
    expect(notificationHref({ kind: "weather", lobby_id: LOBBY })).toBeNull();
    expect(notificationHref({ kind: "checkin", lobby_id: LOBBY })).toBeNull();
  });

  it("meteo/checkin con court_id aprono il campo", () => {
    expect(notificationHref({ kind: "weather", court_id: COURT })).toBe(
      `/courts/${COURT}`
    );
    expect(notificationHref({ kind: "checkin", court_id: COURT })).toBe(
      `/courts/${COURT}`
    );
  });

  it("court_id vince su lobby_id quando entrambi validi (tipo lobby)", () => {
    expect(
      notificationHref({
        type: "lobby_starting_soon",
        court_id: COURT,
        lobby_id: LOBBY,
      })
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
    ["lobby_id non valido", { type: "participant_joined", lobby_id: "zzz" }],
    ["data null", null],
    ["data stringa", "lobby"],
    ["data array", [COURT]],
    ["oggetto vuoto", {}],
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
