import { test, expect, type Page } from "@playwright/test";
import {
  VISUAL_VIEWPORTS,
  VISUAL_SHOT,
  freezeClock,
  seedOnboarded,
  visualMask,
  waitForStablePage,
} from "./helpers/visual";

// Visual regression (d27) — gruppo **static**, senza database: gira anche in CI.
// 3 schermate × 3 viewport (360×780, 768×1024, 1280×800), pagina intera,
// diff massimo 1%. Le schermate con dati stanno in
// `screens-visual-full.spec.ts` (progetto `visual-full`).
//
// Determinismo: clock fisso (9 nov 2026 18:00 Europe/Rome, vedi
// `timezoneId` in playwright.config.ts), font locali + `document.fonts.ready`,
// maschere mirate su `[data-visual-mask]` (mappa WebGL/tile/marker). Mai
// `waitForTimeout` come unica attesa.

const STATIC_SCREENS = [
  {
    name: "styleguide",
    url: "/styleguide",
    // La sezione 09 è client-only (`ssr: false`): il segnale di prontezza deve
    // aspettare lei, altrimenti l'altezza della pagina cambia tra uno scatto e
    // l'altro (era il motivo dei diff a 1280).
    ready: (page: Page) => page.getByTestId("library-showcase"),
  },
  {
    name: "offline",
    url: "/~offline",
    ready: (page: Page) =>
      page.getByRole("heading", { name: "Sei offline." }),
  },
  {
    name: "submit-court",
    url: "/submit-court",
    ready: (page: Page) => page.locator("h1"),
  },
] as const;

test.describe("visual-static", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const screen of STATIC_SCREENS) {
    for (const { width, height } of VISUAL_VIEWPORTS) {
      test(`${screen.name} @ ${width}px`, async ({ page }) => {
        await seedOnboarded(page);
        await page.setViewportSize({ width, height });
        await freezeClock(page);
        await page.goto(screen.url);
        await waitForStablePage(page, screen.ready(page));
        await expect(page).toHaveScreenshot(
          `${screen.name}-${width}.png`,
          { ...VISUAL_SHOT, mask: visualMask(page) },
        );
      });
    }
  }
});
