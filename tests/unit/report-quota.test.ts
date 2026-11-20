import { describe, expect, it } from "vitest";
import { dailyQuotaMessage } from "@/lib/reports/quota";

// Helper del report-drawer (#84/055): solo la quota giornaliera passa il
// testo del server (già italiano), tutto il resto resta ramo generico.
describe("dailyQuotaMessage", () => {
  it("P0001 giornaliero → messaggio del server", () => {
    const message =
      "Hai raggiunto il limite giornaliero di segnalazioni. Riprova domani.";
    expect(dailyQuotaMessage({ code: "P0001", message })).toBe(message);
  });

  it("altri P0001 e rete → null (ramo generico)", () => {
    expect(dailyQuotaMessage({ code: "P0001", message: "boom" })).toBeNull();
    expect(dailyQuotaMessage({ code: null, message: "Failed to fetch" })).toBeNull();
    expect(dailyQuotaMessage(null)).toBeNull();
    expect(dailyQuotaMessage("stringa senza quota")).toBeNull();
  });

  it("mai raw inglese: solo il testo italiano col nome azione passa", () => {
    expect(
      dailyQuotaMessage({ code: "P0001", message: "rate limit exceeded" }),
    ).toBeNull();
  });
});
