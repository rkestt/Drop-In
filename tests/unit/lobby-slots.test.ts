import { describe, expect, it } from "vitest";
import { formatAppTime } from "@/lib/datetime";
import {
  firstSelectableSlot,
  lobbyDayOptions,
  lobbyTimeSlots,
  zonedTimeToInstant,
  LOBBY_SLOT_END_MINUTES,
  LOBBY_SLOT_START_MINUTES,
  LOBBY_SLOT_STEP_MINUTES,
} from "@/lib/lobby/slots";

/**
 * #81: giorni e slot del picker "Orario inizio".
 *
 * Tutto gira a Roma anche se il runner è UTC: niente getter locali e niente
 * `toLocale*` senza `timeZone`. I casi DST sono quelli veri del 2027
 * (28 marzo, 31 ottobre), non date inventate.
 */

const SLOT_COUNT =
  (LOBBY_SLOT_END_MINUTES - LOBBY_SLOT_START_MINUTES) / LOBBY_SLOT_STEP_MINUTES + 1;

describe("lobbyDayOptions", () => {
  it("sette giorni consecutivi, il primo è oggi a Roma", () => {
    const days = lobbyDayOptions(new Date("2026-11-15T10:00:00.000Z"));
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.key)).toEqual([
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
    ]);
  });

  it("etichette relative: Oggi, Domani, poi giorno e mese in it-IT", () => {
    const days = lobbyDayOptions(new Date("2026-11-15T10:00:00.000Z"));
    expect(days[0].label).toBe("Oggi");
    expect(days[1].label).toBe("Domani");
    // 2026-11-15 è una domenica: il 17 è martedì.
    expect(days[2].label).toBe("mar 17 nov");
    expect(days[2].ariaLabel).toBe("mar 17 nov, martedì 17 novembre");
    expect(days[0].ariaLabel).toBe("Oggi, dom 15 nov, domenica 15 novembre");
  });

  it("a cavallo della mezzanotte di Roma parte dal giorno civile di Roma", () => {
    // 23:30Z = 00:30 del 16 a Roma: il primo giorno è già il 16.
    const late = lobbyDayOptions(new Date("2026-11-15T23:30:00.000Z"));
    expect(late[0].key).toBe("2026-11-16");
    expect(late[0].label).toBe("Oggi");
    // 22:30Z = 23:30 del 15 a Roma: ancora il 15.
    const early = lobbyDayOptions(new Date("2026-11-15T22:30:00.000Z"));
    expect(early[0].key).toBe("2026-11-15");
  });

  it("il giorno del cambio DST non si salta né si duplica", () => {
    // La notte del 28 marzo 2027 a Roma si passa a CEST: la sequenza resta 28, 29, 30.
    const keys = lobbyDayOptions(new Date("2027-03-27T23:30:00.000Z")).map(
      (d) => d.key,
    );
    expect(keys.slice(0, 3)).toEqual(["2027-03-28", "2027-03-29", "2027-03-30"]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("days=0 non produce giorni", () => {
    expect(lobbyDayOptions(new Date("2026-11-15T10:00:00.000Z"), 0)).toEqual([]);
  });
});

describe("lobbyTimeSlots", () => {
  it("34 slot da 07:00 a 23:30 ogni 30 minuti, senza duplicati", () => {
    const slots = lobbyTimeSlots(
      "2027-04-10",
      new Date("2027-04-01T10:00:00.000Z"),
    );
    expect(slots).toHaveLength(SLOT_COUNT);
    expect(slots[0].time).toBe("07:00");
    expect(slots.at(-1)?.time).toBe("23:30");
    expect(new Set(slots.map((s) => s.time)).size).toBe(slots.length);
    expect(new Set(slots.map((s) => s.iso)).size).toBe(slots.length);
  });

  it("ISO = istante reale: new Date(iso) resta lo stesso istante", () => {
    const slots = lobbyTimeSlots(
      "2027-04-10",
      new Date("2027-04-01T10:00:00.000Z"),
    );
    for (const slot of slots) {
      expect(new Date(slot.iso).toISOString()).toBe(slot.iso);
      expect(formatAppTime(slot.iso)).toBe(slot.time);
    }
  });

  it("28 marzo 2027 (ingresso DST): 07:00 Roma = 05:00Z, non 06:00Z", () => {
    const slots = lobbyTimeSlots(
      "2027-03-28",
      new Date("2027-03-27T10:00:00.000Z"),
    );
    expect(slots[0].iso).toBe("2027-03-28T05:00:00.000Z");
  });

  it("31 ottobre 2027 (uscita DST): 07:00 Roma = 06:00Z, non 05:00Z", () => {
    const slots = lobbyTimeSlots(
      "2027-10-31",
      new Date("2027-10-30T10:00:00.000Z"),
    );
    expect(slots[0].iso).toBe("2027-10-31T06:00:00.000Z");
    // Anche l'ultimo slot della giornata da 25 ore resta coerente.
    expect(slots.at(-1)?.iso).toBe("2027-10-31T22:30:00.000Z");
  });

  it("gli slot passati sono disabilitati, il primo futuro è selezionabile", () => {
    // 09:10 a Roma del 28 marzo 2027 (07:10Z).
    const now = new Date("2027-03-28T07:10:00.000Z");
    const slots = lobbyTimeSlots("2027-03-28", now);
    const byTime = new Map(slots.map((s) => [s.time, s]));

    expect(byTime.get("07:00")?.disabled).toBe(true);
    expect(byTime.get("09:00")?.disabled).toBe(true);
    expect(byTime.get("09:30")?.disabled).toBe(false);
    expect(byTime.get("23:30")?.disabled).toBe(false);

    const first = firstSelectableSlot(slots);
    expect(first?.time).toBe("09:30");
    expect(first?.iso).toBe("2027-03-28T07:30:00.000Z");
  });

  it("uno slot esattamente a `now` non è più selezionabile", () => {
    const slots = lobbyTimeSlots(
      "2027-04-10",
      new Date("2027-04-10T08:00:00.000Z"), // 10:00 a Roma
    );
    const ten = slots.find((s) => s.time === "10:00");
    expect(ten?.disabled).toBe(true);
  });

  it("leadMinutes sposta in avanti il primo slot utile", () => {
    const now = new Date("2027-03-28T07:10:00.000Z"); // 09:10 a Roma
    const slots = lobbyTimeSlots("2027-03-28", now, { leadMinutes: 30 });
    expect(slots.find((s) => s.time === "09:30")?.disabled).toBe(true);
    expect(slots.find((s) => s.time === "10:00")?.disabled).toBe(false);
  });

  it("oltre l'orizzonte massimo è disabilitato anche se nel futuro", () => {
    const now = new Date("2027-03-28T07:10:00.000Z");
    const slots = lobbyTimeSlots("2027-04-20", now, { horizonDays: 7 });
    expect(slots.every((s) => s.disabled)).toBe(true);
    expect(firstSelectableSlot(slots)).toBeUndefined();
  });

  it("un giorno passato è tutto disabilitato", () => {
    const slots = lobbyTimeSlots(
      "2026-11-14",
      new Date("2026-11-15T10:00:00.000Z"),
    );
    expect(slots.every((s) => s.disabled)).toBe(true);
  });

  it("step non valido = errore esplicito, mai loop infinito", () => {
    expect(() =>
      lobbyTimeSlots("2027-04-10", new Date(), { stepMinutes: 0 }),
    ).toThrow(RangeError);
  });

  it("fine giornata: alle 23:40 oggi è chiuso, domani è aperto", () => {
    // 23:40 a Roma (CEST) del 10 aprile 2027: l'ultimo slot (23:30) è passato.
    const now = new Date("2027-04-10T21:40:00.000Z");
    const today = lobbyTimeSlots("2027-04-10", now);
    expect(today.every((s) => s.disabled)).toBe(true);
    expect(firstSelectableSlot(today)).toBeUndefined();
    const tomorrow = lobbyTimeSlots("2027-04-11", now);
    expect(firstSelectableSlot(tomorrow)?.time).toBe("07:00");
  });

  it("orizzonte default 14 giorni: +7 abilitato, +15 disabilitato", () => {
    const now = new Date("2027-04-01T10:00:00.000Z");
    const window = lobbyDayOptions(now, 16);
    const plus7 = lobbyTimeSlots(window[7].key, now);
    expect(firstSelectableSlot(plus7)).toBeDefined();
    const plus15 = lobbyTimeSlots(window[15].key, now);
    expect(plus15.every((s) => s.disabled)).toBe(true);
    expect(firstSelectableSlot(plus15)).toBeUndefined();
  });

  it("34 slot con ultimo 23:30 coerente anche nei giorni DST", () => {
    for (const dayKey of ["2027-03-28", "2027-10-31"]) {
      const slots = lobbyTimeSlots(
        dayKey,
        new Date("2027-03-01T10:00:00.000Z"),
      );
      expect(slots).toHaveLength(34);
      expect(slots.at(-1)?.time).toBe("23:30");
    }
    // 28/03/2027 CEST (+2): 23:30 Roma = 21:30Z.
    expect(
      lobbyTimeSlots("2027-03-28", new Date("2027-03-01T10:00:00.000Z")).at(-1)
        ?.iso,
    ).toBe("2027-03-28T21:30:00.000Z");
    // 31/10/2027 CET (+1): 23:30 Roma = 22:30Z.
    expect(
      lobbyTimeSlots("2027-10-31", new Date("2027-10-01T10:00:00.000Z")).at(-1)
        ?.iso,
    ).toBe("2027-10-31T22:30:00.000Z");
  });

  it("dayKey/time malformati = RangeError parlante", () => {
    expect(() => zonedTimeToInstant("28/03/2027", "07:00")).toThrow(RangeError);
    expect(() => zonedTimeToInstant("2027-4-1", "07:00")).toThrow(RangeError);
    expect(() => zonedTimeToInstant("2027-03-28", "7:00")).toThrow(RangeError);
    expect(() => zonedTimeToInstant("2027-03-28", "25:00")).toThrow(RangeError);
    expect(() => zonedTimeToInstant("2027-03-28", "12:60")).toThrow(RangeError);
    expect(() => lobbyTimeSlots("non-una-data", new Date())).toThrow(
      RangeError,
    );
  });

  it("stepMinutes frazionario/negativo = throw, days strani = clamp", () => {
    const now = new Date("2027-04-01T10:00:00.000Z");
    expect(() =>
      lobbyTimeSlots("2027-04-10", now, { stepMinutes: 22.5 }),
    ).toThrow(RangeError);
    expect(() =>
      lobbyTimeSlots("2027-04-10", now, { stepMinutes: -30 }),
    ).toThrow(RangeError);
    expect(() =>
      lobbyTimeSlots("2027-04-10", now, { horizonDays: Infinity }),
    ).toThrow(RangeError);
    // 2.5 giorni → floor a 2, mai 3 a sorpresa.
    expect(lobbyDayOptions(now, 2.5)).toHaveLength(2);
    // Infinity → cappato a 31, mai loop infinito.
    expect(lobbyDayOptions(now, Infinity)).toHaveLength(31);
  });

  it("horizonDays oltre 31 viene cappato a 31", () => {
    const now = new Date("2027-04-01T10:00:00.000Z");
    const window = lobbyDayOptions(now, 31);
    // +30 giorni da now: dentro il cap → slot utili.
    const inside = lobbyTimeSlots(window[30].key, now, { horizonDays: 60 });
    expect(firstSelectableSlot(inside)).toBeDefined();
    // +32 giorni: oltre il cap di 31 → tutto disabilitato (senza cap
    // horizonDays: 60 li terrebbe abilitati).
    const outside = lobbyTimeSlots("2027-05-03", now, { horizonDays: 60 });
    expect(outside.every((s) => s.disabled)).toBe(true);
  });

  it("ora inesistente del cambio DST: mappa deterministica fuori finestra slot", () => {
    // Il 28/03/2027 le 02:30 a Roma non esistono (02:00→03:00): l'algoritmo a
    // due passaggi atterra su 01:30Z, cioè le 03:30 civili. È fuori dalla
    // finestra slot (07:00–23:30), quindi il picker non ci arriva mai: questo
    // test pinna solo che il comportamento resta deterministico.
    expect(zonedTimeToInstant("2027-03-28", "02:30")).toBe(
      Date.UTC(2027, 2, 28, 1, 30),
    );
  });
});
