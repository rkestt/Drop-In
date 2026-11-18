import { describe, expect, it } from "vitest";
import {
  findBlockingLobbies,
  isAlreadyDeletedError,
  type OwnedLobbyRow,
  type ParticipantRow,
} from "@/lib/account/delete";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-11-18T10:00:00Z");

function lobby(over: Partial<OwnedLobbyRow> & { id: string }): OwnedLobbyRow {
  return {
    start_time: "2026-11-18T09:00:00Z",
    ends_at: "2026-11-18T11:00:00Z",
    status: "open",
    ...over,
  };
}

describe("findBlockingLobbies", () => {
  it("blocca la futura con un altro iscritto", () => {
    const blocking = findBlockingLobbies(
      [lobby({ id: "l1", start_time: "2026-11-18T12:00:00Z", ends_at: "2026-11-18T13:00:00Z" })],
      [{ lobby_id: "l1", user_id: OTHER }],
      ME,
      NOW
    );
    expect(blocking.map((l) => l.id)).toEqual(["l1"]);
  });

  it("blocca l'iniziata ieri e ancora in corso con un altro iscritto", () => {
    const blocking = findBlockingLobbies(
      [lobby({ id: "l1", start_time: "2026-11-17T10:00:00Z", ends_at: "2026-11-18T10:00:01Z" })],
      [{ lobby_id: "l1", user_id: OTHER }],
      ME,
      NOW
    );
    expect(blocking.map((l) => l.id)).toEqual(["l1"]);
  });

  it("lascia passare l'iniziata e finita anche con altri iscritti", () => {
    const blocking = findBlockingLobbies(
      [lobby({ id: "l1", start_time: "2026-11-18T08:00:00Z", ends_at: "2026-11-18T09:00:00Z" })],
      [{ lobby_id: "l1", user_id: OTHER }],
      ME,
      NOW
    );
    expect(blocking).toEqual([]);
  });

  it("lascia passare la non finita senza iscritti", () => {
    const blocking = findBlockingLobbies(
      [lobby({ id: "l1" })],
      [] as ParticipantRow[],
      ME,
      NOW
    );
    expect(blocking).toEqual([]);
  });

  it("lascia passare la non finita dove sono iscritto solo io", () => {
    const blocking = findBlockingLobbies(
      [lobby({ id: "l1" })],
      [{ lobby_id: "l1", user_id: ME }],
      ME,
      NOW
    );
    expect(blocking).toEqual([]);
  });

  it("lascia passare non-open anche non finite con altri iscritti", () => {
    for (const status of ["in_progress", "closed", null]) {
      const blocking = findBlockingLobbies(
        [lobby({ id: "l1", status })],
        [{ lobby_id: "l1", user_id: OTHER }],
        ME,
        NOW
      );
      expect(blocking, `status ${status}`).toEqual([]);
    }
  });

  it("ripiega su start_time se ends_at illeggibile", () => {
    const blocking = findBlockingLobbies(
      [lobby({ id: "l1", start_time: "2026-11-18T12:00:00Z", ends_at: "non-una-data" })],
      [{ lobby_id: "l1", user_id: OTHER }],
      ME,
      NOW
    );
    expect(blocking.map((l) => l.id)).toEqual(["l1"]);
  });

  it("lascia passare se start_time ed ends_at sono entrambi illeggibili", () => {
    for (const row of [
      lobby({ id: "l1", start_time: "xx", ends_at: "yy" }),
      lobby({ id: "l2", start_time: "xx", ends_at: null }),
    ]) {
      const blocking = findBlockingLobbies(
        [row],
        [{ lobby_id: row.id, user_id: OTHER }],
        ME,
        NOW
      );
      expect(blocking, `riga ${row.id}`).toEqual([]);
    }
  });

  it("blocca solo le lobby giuste in un mix", () => {
    const blocking = findBlockingLobbies(
      [
        lobby({ id: "futura-con-altri", start_time: "2026-11-18T12:00:00Z", ends_at: "2026-11-18T13:00:00Z" }),
        lobby({ id: "in-corso-con-altri", start_time: "2026-11-17T10:00:00Z", ends_at: "2026-11-18T10:00:01Z" }),
        lobby({ id: "finita", start_time: "2026-11-18T08:00:00Z", ends_at: "2026-11-18T09:00:00Z" }),
        lobby({ id: "futura-sola", start_time: "2026-11-18T12:00:00Z", ends_at: "2026-11-18T13:00:00Z" }),
      ],
      [
        { lobby_id: "futura-con-altri", user_id: OTHER },
        { lobby_id: "in-corso-con-altri", user_id: OTHER },
        { lobby_id: "finita", user_id: OTHER },
      ],
      ME,
      NOW
    );
    expect(blocking.map((l) => l.id)).toEqual(["futura-con-altri", "in-corso-con-altri"]);
  });
});

describe("isAlreadyDeletedError", () => {
  it("vero su 404 dello admin API", () => {
    expect(isAlreadyDeletedError({ status: 404 })).toBe(true);
    expect(
      isAlreadyDeletedError({ status: 404, code: "user_not_found" })
    ).toBe(true);
  });

  it("vero sul codice user_not_found", () => {
    expect(isAlreadyDeletedError({ code: "user_not_found" })).toBe(true);
    expect(isAlreadyDeletedError({ status: 400, code: "User_Not_Found" })).toBe(
      true
    );
  });

  it("falso su errori veri e valori vuoti", () => {
    expect(isAlreadyDeletedError({ status: 500 })).toBe(false);
    expect(isAlreadyDeletedError({ message: "boom" })).toBe(false);
    expect(isAlreadyDeletedError(null)).toBe(false);
    expect(isAlreadyDeletedError(undefined)).toBe(false);
    expect(isAlreadyDeletedError("user_not_found")).toBe(false);
  });
});
