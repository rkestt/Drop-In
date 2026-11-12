import { test, expect, type Page } from "@playwright/test";

/**
 * #68: con una ricerca attiva, spostare la mappa deve rifare la query sul
 * nuovo centro. Il ramo è in `handleBoundsChange` di `app/(app)/page.tsx` e
 * scatta su `moveend`: qui non si simula il drag del puntatore (in headless
 * non produce movimento affidabile), si guida la mappa vera via l'handle che
 * il componente espone per i test (`window.__dropinMap`).
 *
 * Richiede il DB locale (corti del seed), quindi `E2E_WITH_DB=1`.
 */
test.skip(!process.env.E2E_WITH_DB, "Richiede Supabase locale: E2E_WITH_DB=1");

const SEARCH_RPC = (req: { url(): string }) => req.url().includes("nearby_courts");

function rpcBody(req: { postData(): string | null }): Record<string, unknown> {
  try {
    return JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function searchAndWait(page: Page, query: string) {
  const search = page.getByRole("searchbox");
  await search.fill(query);
  const req = await page.waitForRequest(
    (r) => SEARCH_RPC(r) && String(rpcBody(r)["p_query"] ?? "") === query.toLowerCase()
  );
  return req;
}

test.describe("#68 ricerca legata al centro mappa", () => {
  test("spostare la mappa con query attiva rifà la ricerca sul nuovo centro", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!window.__dropinMap, undefined, { timeout: 30_000 });

    // Prima ricerca: il centro è quello iniziale (Roma).
    const first = await searchAndWait(page, "parco");
    const firstLat = Number(rpcBody(first)["p_lat"]);
    expect(Number.isFinite(firstLat)).toBe(true);

    // Attende la risposta, così la lista è "ready" e non in volo.
    await expect(page.getByText(/(campo|campi) per «parco»|Nessun campo per/)).toBeVisible({
      timeout: 15_000,
    });

    // Sposta la mappa di ~15 km a est e aspetta la nuova RPC.
    const moved = page.waitForRequest(SEARCH_RPC, { timeout: 15_000 });
    await page.evaluate(() => {
      const map = window.__dropinMap;
      if (!map) throw new Error("__dropinMap non disponibile");
      const center = map.getCenter();
      map.jumpTo({ center: [center.lng + 0.15, center.lat], zoom: 12 });
    });

    const second = await moved;
    const body = rpcBody(second);
    // La nuova fetch deve portare la query e un centro diverso.
    expect(String(body["p_query"] ?? "").toLowerCase()).toBe("parco");
    const secondLng = Number(body["p_lng"]);
    expect(Number.isFinite(secondLng)).toBe(true);
    const before = Number(rpcBody(first)["p_lng"]);
    expect(Math.abs(secondLng - before)).toBeGreaterThan(0.01);

    // E la UI resta coerente: il contatore non deve tornare a "Cerco…".
    await expect(page.getByText(/(campo|campi) per «parco»|Nessun campo per/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("svuotare la query non lascia risultati né marker della ricerca", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!window.__dropinMap, undefined, { timeout: 30_000 });
    await searchAndWait(page, "parco");
    await expect(page.getByText(/(campo|campi) per «parco»|Nessun campo per/)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("searchbox").fill("");
    await expect(page.getByRole("searchbox")).toHaveValue("");
    // Torna il contatore del browse (senza "per «parco»").
    await expect(page.getByText(/per «parco»/)).toHaveCount(0, { timeout: 15_000 });
  });
});
