import { describe, expect, it } from "vitest";
import {
  expiryFromCheckin,
  formatExpiry,
  fromAccuracy,
  fromGeolocationCode,
  fromInsertError,
  isCheckinActive,
  parseDistanceMeters,
} from "@/lib/checkin/errors";

describe("fromGeolocationCode", () => {
  it("code 1 → permesso negato con recovery", () => {
    const info = fromGeolocationCode(1);
    expect(info.kind).toBe("denied");
    expect(info.body).toMatch(/impostazioni/i);
    expect(info.retryLabel).toBe("Riprova");
  });

  it("code 1 iOS → messaggio Safari con Posizione precisa", () => {
    const info = fromGeolocationCode(1, { ios: true });
    expect(info.kind).toBe("denied");
    expect(info.body).toMatch(/Safari/);
    expect(info.body).toMatch(/Posizione precisa/);
    expect(info.steps?.join(" ")).toMatch(/Posizione precisa/);
  });

  it("code 1 non-iOS → messaggio diverso, senza riferimenti a Safari", () => {
    const ios = fromGeolocationCode(1, { ios: true });
    const other = fromGeolocationCode(1, { ios: false });
    expect(other.kind).toBe("denied");
    expect(other.body).not.toBe(ios.body);
    expect(other.body).not.toMatch(/Safari/);
  });

  it("code 1 iOS non-standalone → rimanda all'icona PWA", () => {
    const info = fromGeolocationCode(1, { ios: true, standalone: false });
    expect(info.kind).toBe("denied");
    expect(`${info.hint ?? ""} ${info.steps?.join(" ") ?? ""}`).toMatch(
      /icona/
    );
  });

  it("code 1 iOS standalone → permessi nella voce Drop-In", () => {
    const info = fromGeolocationCode(1, { ios: true, standalone: true });
    expect(info.kind).toBe("denied");
    expect(info.body).toMatch(/Safari/);
    expect(info.body).toMatch(/Posizione precisa/);
    expect(info.hint).toMatch(/voce Drop-In/);
    expect(info.steps?.join(" ")).toMatch(/Drop-In/);
  });

  it("code 2 → posizione non disponibile", () => {
    const info = fromGeolocationCode(2);
    expect(info.kind).toBe("unavailable");
    expect(info.title).toMatch(/non disponibile/i);
  });

  it("code 3 → timeout, messaggio distinto dal code 2", () => {
    const timeout = fromGeolocationCode(3);
    const unavailable = fromGeolocationCode(2);
    expect(timeout.kind).toBe("timeout");
    expect(timeout.body).not.toBe(unavailable.body);
  });

  it("code 2/3 su iOS → stessi kind, consiglio Posizione precisa", () => {
    const unavailable = fromGeolocationCode(2, { ios: true });
    const timeout = fromGeolocationCode(3, { ios: true });
    expect(unavailable.kind).toBe("unavailable");
    expect(timeout.kind).toBe("timeout");
    expect(`${unavailable.hint ?? ""}`).toMatch(/Posizione precisa/);
    expect(`${timeout.hint ?? ""}`).toMatch(/Posizione precisa/);
  });
});

describe("fromAccuracy", () => {
  it("0 e 20 m → ok, nessuna info", () => {
    expect(fromAccuracy(0)).toEqual({ level: "ok", info: null });
    expect(fromAccuracy(20)).toEqual({ level: "ok", info: null });
  });

  it("21 e 50 m → warn non bloccante con metri arrotondati", () => {
    for (const [input, meters] of [
      [21, "±21 m"],
      [45.4, "±45 m"],
      [50, "±50 m"],
    ] as const) {
      const verdict = fromAccuracy(input);
      expect(verdict.level).toBe("warn");
      expect(verdict.info?.kind).toBe("low-accuracy");
      expect(verdict.info?.body).toContain(meters);
      expect(verdict.info?.title).toMatch(/impreciso/i);
    }
  });

  it("51 e 120 m → block con messaggio dedicato", () => {
    for (const input of [51, 120]) {
      const verdict = fromAccuracy(input);
      expect(verdict.level).toBe("block");
      expect(verdict.info?.kind).toBe("low-accuracy");
      expect(verdict.info?.body).toMatch(/±120 m|±51 m/);
      expect(verdict.info?.title).toMatch(/debole/i);
    }
  });

  it("NaN/Infinity/negativi → ok, mai banner con metri assurdi", () => {
    for (const input of [NaN, Infinity, -Infinity, -1]) {
      const verdict = fromAccuracy(input);
      expect(verdict.level).toBe("ok");
      expect(verdict.info).toBeNull();
    }
  });

  it("confini float: 20.0001 → warn, 50.1 → block", () => {
    const warn = fromAccuracy(20.0001);
    expect(warn.level).toBe("warn");
    expect(warn.info?.kind).toBe("low-accuracy");
    const block = fromAccuracy(50.1);
    expect(block.level).toBe("block");
    expect(block.info?.kind).toBe("low-accuracy");
  });
});

describe("fromInsertError", () => {
  it("messaggio distanza del trigger → fuori raggio con metri", () => {
    const info = fromInsertError(
      "Sei troppo lontano dal campo (120 m). Avvicinati per fare check-in."
    );
    expect(info.kind).toBe("out-of-range");
    expect(info.body).toMatch(/120 m/);
    expect(info.retryLabel).toBe("Aggiorna posizione");
  });

  it("distanza senza metri → fuori raggio generico", () => {
    const info = fromInsertError("Sei troppo lontano dal campo.");
    expect(info.kind).toBe("out-of-range");
    expect(info.body).toMatch(/troppo lontano/i);
  });

  it("relitto del vecchio formato con decimali → metri arrotondati", () => {
    expect(
      parseDistanceMeters("Sei troppo lontano dal campo (1003.40670779.0f m).")
        .meters
    ).toBe(1003);
  });

  it("cooldown 5 minuti → stato dedicato", () => {
    const info = fromInsertError(
      "Devi attendere 5 minuti prima di fare di nuovo check-in su questo campo"
    );
    expect(info.kind).toBe("cooldown");
  });

  it("generico → server con dati conservati", () => {
    const info = fromInsertError("connection reset");
    expect(info.kind).toBe("server");
    expect(info.hint).toMatch(/resta valida/i);
  });

  it("sessione mancante → accesso richiesto", () => {
    const info = fromInsertError("Devi effettuare l'accesso per fare check-in.");
    expect(info.kind).toBe("auth");
    expect(info.body).toMatch(/accedi di nuovo/i);
    expect(info.retryLabel).toBe("Accedi");
  });

  it("già dentro → nessun secondo check-in", () => {
    const info = fromInsertError("Hai già un check-in attivo su questo campo");
    expect(info.kind).toBe("already-inside");
  });

  it("P0001 campi approvati → campo non approvato, senza retry a vuoto", () => {
    const info = fromInsertError(
      "Operazione consentita solo su campi approvati."
    );
    expect(info.kind).toBe("court-not-approved");
    expect(info.title).toBe("Campo non approvato");
    expect(info.body).toMatch(/quando viene approvato/i);
    expect(info.retryLabel).toBe("Chiudi");
    expect(info.hint).toBeUndefined();
  });

  it("quota giornaliera (055) → ramo quota col testo del server, mai server-generico", () => {
    const message = "Hai raggiunto il limite giornaliero di check-in. Riprova domani.";
    const info = fromInsertError(message);
    expect(info.kind).toBe("quota");
    expect(info.title).toMatch(/giornaliero/i);
    expect(info.body).toBe(message);
    expect(info.retryLabel).toBe("Chiudi");
  });

  it("varianti di quota → stesso ramo dedicato", () => {
    for (const msg of [
      "Hai raggiunto il limite giornaliero di check-in. Riprova domani.",
      "Troppi check-in oggi, riprova domani.",
    ]) {
      expect(fromInsertError(msg).kind).toBe("quota");
    }
  });

  it("varianti di revisione → stesso stato dedicato", () => {
    for (const msg of [
      "Campo in revisione: attendi l'approvazione.",
      "court is pending moderation",
    ]) {
      expect(fromInsertError(msg).kind).toBe("court-not-approved");
    }
  });
});

describe("parseDistanceMeters", () => {
  it("estrae i metri dal messaggio del trigger", () => {
    expect(parseDistanceMeters("…(120 m)…").meters).toBe(120);
  });

  it("null senza metri", () => {
    expect(parseDistanceMeters("errore generico").meters).toBeNull();
  });
});

describe("expiryFromCheckin", () => {
  it("scadenza = check-in + 2h, formato it-IT", () => {
    const expiry = expiryFromCheckin("2026-11-10T17:40:00+01:00");
    expect(formatExpiry(expiry)).toBe("19:40");
  });
});

describe("isCheckinActive", () => {
  it("check-in vecchio di 3h → scaduto", () => {
    expect(
      isCheckinActive("2026-11-10T17:40:00+01:00", new Date("2026-11-10T20:40:01+01:00"))
    ).toBe(false);
  });

  it("check-in di 1h fa → attivo", () => {
    expect(
      isCheckinActive("2026-11-10T17:40:00+01:00", new Date("2026-11-10T18:40:00+01:00"))
    ).toBe(true);
  });

  it("scadenza esatta → scaduto", () => {
    expect(
      isCheckinActive("2026-11-10T17:40:00+01:00", new Date("2026-11-10T19:40:00+01:00"))
    ).toBe(false);
  });
});
