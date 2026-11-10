/**
 * Verifica manuale (non in CI) di Drawer/Sonner su WebKit con profilo iPhone.
 *
 * Serve perché l'host di sviluppo può non avere le dipendenze di sistema per
 * WebKit: si esegue dentro l'immagine ufficiale Playwright.
 *
 *   docker run --rm --network host --user "$(id -u):$(id -g)" \
 *     -e HOME=/tmp -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
 *     -v "$PWD":"$PWD" -w "$PWD" \
 *     mcr.microsoft.com/playwright:v1.65.0-noble \
 *     node scripts/verify/webkit-styleguide.mjs
 *
 * Richiede un dev server già attivo su BASE_URL (default http://localhost:3100).
 * Esce con codice 1 se un check fallisce.
 */
import { webkit, chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const device = devices["iPhone 13"];

async function openDrawer(page) {
  await page.goto(`${BASE}/styleguide`, { waitUntil: "networkidle" });
  await page.locator("#componenti").getByRole("button", { name: "Apri drawer" }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(300);
}

async function run(name, launcher) {
  const browser = await launcher.launch();
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  await page.goto(`${BASE}/styleguide`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  // Drawer: apertura, focus iniziale, Escape
  await page.locator("#componenti").getByRole("button", { name: "Apri drawer" }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(400);
  const opened = await page.locator('[role="dialog"]').isVisible();
  const focusInside = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(document.activeElement);
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const escClosed = !(await page.locator('[role="dialog"]').isVisible().catch(() => false));

  // Backdrop: tap sopra il drawer
  await openDrawer(page);
  const box = await page.locator('[role="dialog"]').boundingBox();
  await page.mouse.click(Math.round(box.x + box.width / 2), Math.round(box.y / 2));
  await page.waitForTimeout(400);
  const backdropClosed = !(await page.locator('[role="dialog"]').isVisible().catch(() => false));

  // Il drag oltre soglia usa eventi touch reali: è coperto da
  // tests/e2e/drawer.spec.ts (CDP touch), non da mouse drag in questo script.

  // Body bloccato da aperto
  await openDrawer(page);
  await page.waitForTimeout(200);
  const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Toast: un nodo, posizione, swipe up
  await page.getByRole("button", { name: "Mostra toast" }).click();
  await page.waitForSelector("[data-sonner-toast]");
  await page.waitForTimeout(400);
  const toastCount = await page.locator("[data-sonner-toast]").count();
  const toastBox = await page.locator("[data-sonner-toast]").first().boundingBox();
  const viewport = page.viewportSize();
  const tx = toastBox.x + toastBox.width / 2;
  const ty = toastBox.y + toastBox.height / 2;
  await page.mouse.move(tx, ty);
  await page.mouse.down();
  for (let i = 1; i <= 15; i += 1) {
    await page.mouse.move(tx, ty - i * 12);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);
  const toastAfter = await page.locator("[data-sonner-toast]").count();

  // Reduced motion
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDrawer(page);
  const reduced = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const cs = getComputedStyle(dialog);
    return {
      transition: parseFloat(cs.transitionDuration.replace("s", "")) || 0,
      animation: parseFloat(cs.animationDuration.replace("s", "")) || 0,
    };
  });

  await browser.close();

  const checks = {
    drawerOpens: opened,
    focusInsideDialog: focusInside,
    escapeCloses: escClosed,
    backdropCloses: backdropClosed,
    bodyScrollLocked: bodyOverflow === "hidden",
    singleToast: toastCount === 1,
    toastNearTop: toastBox ? toastBox.y <= 24 : false,
    toastSwipeCloses: toastAfter === 0,
    reducedMotionStatic: reduced ? reduced.transition <= 0.02 && reduced.animation <= 0.02 : false,
    consoleClean: errors.length === 0,
  };

  return {
    engine: name,
    checks,
    toast: { count: toastCount, afterSwipe: toastAfter, y: toastBox?.y ?? null, viewport: viewport?.height ?? null },
    reduced,
    errors,
    allPassed: Object.values(checks).every(Boolean),
  };
}

const results = [];
results.push(await run("webkit", webkit));
try {
  results.push(await run("chromium", chromium));
} catch {
  // Chromium opzionale: serve solo al confronto.
}

console.log(JSON.stringify(results, null, 2));
process.exit(results[0].allPassed ? 0 : 1);
