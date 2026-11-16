import { describe, expect, it } from "vitest";
import {
  bodyToNull,
  clampRating,
  formatAverage,
  reviewCountLabel,
} from "@/lib/reviews/format";
import { reviewErrorMessage } from "@/lib/reviews/errors";

describe("formatAverage", () => {
  it("scrive la media con la virgola, non con il punto", () => {
    expect(formatAverage(4.5)).toBe("4,5");
    expect(formatAverage(4)).toBe("4,0");
    expect(formatAverage(3.25)).toBe("3,3");
  });

  it("usa il trattino quando la media manca o non e' un numero", () => {
    expect(formatAverage(null)).toBe("–");
    expect(formatAverage(undefined)).toBe("–");
    expect(formatAverage(Number.NaN)).toBe("–");
  });

  it("limita i valori fuori scala all'intervallo 0..5", () => {
    expect(formatAverage(9)).toBe("5,0");
    expect(formatAverage(-2)).toBe("0,0");
  });
});

describe("reviewCountLabel", () => {
  it("singolare e plurale italiano", () => {
    expect(reviewCountLabel(1)).toBe("1 recensione");
    expect(reviewCountLabel(7)).toBe("7 recensioni");
  });

  it("zero, negativi e NaN sono 'Nessuna recensione'", () => {
    expect(reviewCountLabel(0)).toBe("Nessuna recensione");
    expect(reviewCountLabel(-3)).toBe("Nessuna recensione");
    expect(reviewCountLabel(Number.NaN)).toBe("Nessuna recensione");
  });
});

describe("clampRating", () => {
  it("accetta 1..5 e arrotonda i decimali", () => {
    expect(clampRating(3)).toBe(3);
    expect(clampRating(4.5)).toBe(5);
  });

  it("null, fuori scala e non-numeri restano null (non diventano 1 stella)", () => {
    expect(clampRating(null)).toBeNull();
    expect(clampRating(undefined)).toBeNull();
    expect(clampRating(0)).toBeNull();
    expect(clampRating(6)).toBeNull();
    expect(clampRating(Number.NaN)).toBeNull();
  });
});

describe("bodyToNull", () => {
  it("vuoto e soli spazi diventano NULL (il CHECK della 033 li rifiuterebbe)", () => {
    expect(bodyToNull("")).toBeNull();
    expect(bodyToNull("   ")).toBeNull();
    expect(bodyToNull(null)).toBeNull();
    expect(bodyToNull(undefined)).toBeNull();
  });

  it("trimma il testo prima di scriverlo", () => {
    expect(bodyToNull("  ciao  ")).toBe("ciao");
  });
});

describe("reviewErrorMessage", () => {
  it("traduce i codici noti in copy italiano", () => {
    expect(reviewErrorMessage("42501")).toMatch(/questo campo/);
    expect(reviewErrorMessage("23505")).toMatch(/già recensito/);
    expect(reviewErrorMessage("23514")).toMatch(/1 a 5 stelle/);
  });

  it("non lascia passare il testo grezzo di Supabase", () => {
    const message = reviewErrorMessage("PGRST116");
    expect(message).toBe("Salvataggio non riuscito. Riprova.");
    expect(reviewErrorMessage(null)).toBe("Salvataggio non riuscito. Riprova.");
  });
});
