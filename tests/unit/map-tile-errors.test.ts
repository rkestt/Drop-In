import { describe, expect, it } from "vitest";
import {
  DEFAULT_TILE_ERROR_POLICY,
  classifyTileError,
  createTileErrorState,
  dismissTileError,
  recordTileError,
  recordTileLoad,
  type TileErrorState,
} from "@/lib/map/tile-errors";

const HOSTS = ["tiles.openfreemap.org"];
const T0 = 1_000_000;

function ajax(status: number, url = "https://tiles.openfreemap.org/planet/20240101/14/1/2.pbf") {
  return { status, url, message: `AJAXError: HTTP ${status}` };
}

function withErrors(
  kinds: Array<Parameters<typeof recordTileError>[1]>,
  start = T0,
  gap = 100
): TileErrorState {
  let state = createTileErrorState();
  kinds.forEach((kind, index) => {
    state = recordTileError(state, kind, start + index * gap);
  });
  return state;
}

describe("classifyTileError", () => {
  it("404 = not-found (non un errore di trasporto)", () => {
    expect(classifyTileError(ajax(404), HOSTS)).toBe("not-found");
  });

  it("5xx = server", () => {
    expect(classifyTileError(ajax(500), HOSTS)).toBe("server");
    expect(classifyTileError(ajax(503), HOSTS)).toBe("server");
  });

  it("401/403/429 = blocked", () => {
    expect(classifyTileError(ajax(403), HOSTS)).toBe("blocked");
    expect(classifyTileError(ajax(429), HOSTS)).toBe("blocked");
    expect(classifyTileError(ajax(401), HOSTS)).toBe("blocked");
  });

  it("fetch fallita = transport", () => {
    expect(classifyTileError(new TypeError("Failed to fetch"), HOSTS)).toBe(
      "transport"
    );
    expect(classifyTileError(new Error("NetworkError when attempting to fetch resource."), HOSTS)).toBe(
      "transport"
    );
    expect(classifyTileError({ message: "Load failed" }, HOSTS)).toBe("transport");
  });

  it("un errore su un altro host non e' una tile", () => {
    expect(
      classifyTileError(
        { status: 500, url: "https://xyz.supabase.co/rest/v1/courts" },
        HOSTS
      )
    ).toBe("ignore");
  });

  it("errori non di rete (immagini, filtri) restano fuori", () => {
    expect(
      classifyTileError(new Error('Image "gate" could not be loaded'), HOSTS)
    ).toBe("ignore");
    expect(
      classifyTileError(
        new Error("Expected value to be of type number, but found null instead."),
        HOSTS
      )
    ).toBe("ignore");
    expect(classifyTileError(null, HOSTS)).toBe("ignore");
    expect(classifyTileError(undefined, HOSTS)).toBe("ignore");
  });

  it("4xx non recuperabili non contano", () => {
    expect(classifyTileError(ajax(400), HOSTS)).toBe("ignore");
  });
});

describe("recordTileError", () => {
  it("un singolo errore non mostra il banner", () => {
    const state = withErrors(["transport"]);
    expect(state.bannerVisible).toBe(false);
  });

  it("sotto soglia niente banner", () => {
    const state = withErrors(["transport", "transport", "transport", "transport"]);
    expect(state.bannerVisible).toBe(false);
  });

  it("alla soglia il banner compare", () => {
    const state = withErrors([
      "transport",
      "server",
      "blocked",
      "transport",
      "transport",
    ]);
    expect(state.bannerVisible).toBe(true);
  });

  it("un singolo 404 viene ignorato, non conta per la soglia", () => {
    const state = withErrors(["not-found"]);
    expect(state.bannerVisible).toBe(false);
    expect(state.samples).toHaveLength(1);
  });

  it("due 404 non bastano ancora, tre 404 contano tutti", () => {
    const two = withErrors(["not-found", "not-found"]);
    expect(two.bannerVisible).toBe(false);
    const three = withErrors(["not-found", "not-found", "not-found"]);
    // 3 non bastano da soli (soglia 5) ma ora contano: con 2 errori veri
    // si arriva a 5.
    expect(three.bannerVisible).toBe(false);
    const mixed = withErrors([
      "not-found",
      "not-found",
      "not-found",
      "transport",
      "transport",
    ]);
    expect(mixed.bannerVisible).toBe(true);
  });

  it("gli errori vecchi escono dalla finestra", () => {
    let state = createTileErrorState();
    for (let i = 0; i < 4; i += 1) {
      state = recordTileError(state, "transport", T0 + i * 100);
    }
    // Il quinto arriva dopo la finestra: i primi quattro sono scaduti.
    state = recordTileError(
      state,
      "transport",
      T0 + DEFAULT_TILE_ERROR_POLICY.windowMs + 500
    );
    expect(state.bannerVisible).toBe(false);
    expect(state.samples).toHaveLength(1);
  });

  it("non muta lo stato di input", () => {
    const initial = createTileErrorState();
    const next = recordTileError(initial, "transport", T0);
    expect(initial.samples).toHaveLength(0);
    expect(next.samples).toHaveLength(1);
    expect(next).not.toBe(initial);
  });

  it("kind ignore ritorna lo stesso stato", () => {
    const initial = createTileErrorState();
    expect(recordTileError(initial, "ignore", T0)).toBe(initial);
  });

  it("una policy piu' severa cambia il momento del banner", () => {
    let state = createTileErrorState();
    const policy = { windowMs: 5_000, threshold: 2, notFoundThreshold: 3 };
    state = recordTileError(state, "server", T0, policy);
    expect(state.bannerVisible).toBe(false);
    state = recordTileError(state, "server", T0 + 1, policy);
    expect(state.bannerVisible).toBe(true);
  });
});

describe("recupero e chiusura", () => {
  const shown = withErrors([
    "transport",
    "transport",
    "transport",
    "transport",
    "transport",
  ]);

  it("un tile caricato azzera la finestra e chiude il banner", () => {
    expect(shown.bannerVisible).toBe(true);
    const recovered = recordTileLoad(shown, T0 + 10_000);
    expect(recovered.bannerVisible).toBe(false);
    expect(recovered.samples).toEqual([]);
    expect(recovered.lastLoadAt).toBe(T0 + 10_000);
  });

  it("recordTileLoad su stato pulito ritorna lo stesso oggetto (niente re-render)", () => {
    const clean = createTileErrorState();
    expect(recordTileLoad(clean, T0)).toBe(clean);
  });

  it("Chiudi nasconde il banner e non lo fa riapparire con altri errori", () => {
    const dismissed = dismissTileError(shown);
    expect(dismissed.bannerVisible).toBe(false);
    expect(dismissed.dismissed).toBe(true);
    const more = recordTileError(dismissed, "transport", T0 + 10_000);
    expect(more.bannerVisible).toBe(false);
    // Il recupero riapre la possibilita' del banner per un futuro guasto.
    const recovered = recordTileLoad(more, T0 + 20_000);
    expect(recovered.dismissed).toBe(false);
    const later = recordTileError(recovered, "transport", T0 + 30_000);
    expect(later.bannerVisible).toBe(false);
  });

  it("Chiudi su banner gia' chiuso e' un no-op", () => {
    const clean = createTileErrorState();
    expect(dismissTileError(clean)).toBe(clean);
  });
});
