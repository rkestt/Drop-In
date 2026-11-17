/**
 * Verifica un prototipo statico su WebKit (motore Safari) con profilo iPhone.
 *
 * Perché esiste: i prototipi in `docs/design/prototypes/` li guardiamo a 360px
 * e a 390x844 su Chromium, ma il rischio vero è iOS — `dvh` che cambia con la
 * URL bar, `env(safe-area-inset)`, pointer capture, `inert`, scroll-snap.
 * Questo script ripete i check strutturali sul motore giusto.
 *
 * Uso normale: `npm run verify:webkit` (scripts/verify/webkit-proto.sh), che avvia il server
 * statico, prova il WebKit locale e se non parte usa da solo l'immagine Playwright.
 *
 *   npm run verify:webkit
 *   npm run verify:webkit -- --url=http://127.0.0.1:4173/onboarding.html
 *   BROWSER=chromium npm run verify:webkit      # confronto
 *
 * Cosa NON verifica (limiti dell'emulazione, docs/ios.md): collasso della URL bar e `dvh` che
 * cambia, `env(safe-area-inset-*)` (sempre 0 su WebKit), tastiera virtuale, gesti (momentum,
 * rubber-band, pinch), PWA installata. Per la safe-area serve Chromium con
 * `Emulation.setSafeAreaInsetsOverride`.
 *
 * Se il prototipo espone `window.__proto.state()` (come nav-map-lobby.html)
 * controlla anche snap, altezze e ordine del contenuto; altrimenti fa i check
 * generici (overflow, console, font, target).
 *
 * Esce con codice 1 se un check fallisce. Non è in `test:all`: è un check di
 * design, non un test di prodotto.
 */
import { webkit, chromium, devices } from "playwright";

const args = process.argv.slice(2);
const urlArg = args.find((a) => a.startsWith("--url="));
const URL = urlArg ? urlArg.slice(6) : process.env.URL ?? "http://127.0.0.1:4173/nav-map-lobby.html";
const ENGINE = process.env.BROWSER ?? "webkit";

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const launcher = ENGINE === "chromium" ? chromium : webkit;

async function audit(deviceName, viewport) {
  const browser = await launcher.launch();
  const context = await browser.newContext(
    deviceName ? { ...devices[deviceName] } : { viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  const label = deviceName ?? `${viewport.width}x${viewport.height}`;
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(400);

  const base = await page.evaluate(() => {
    const doc = document.documentElement;
    const proto = window.__proto && window.__proto.state ? window.__proto.state() : null;
    return {
      overflow: doc.scrollWidth - doc.clientWidth,
      fonts: {
        syne: document.fonts.check('16px "Syne"'),
        source: document.fonts.check('16px "Source Sans 3"'),
      },
      proto,
    };
  });

  check(`${label} · nessun overflow orizzontale`, base.overflow === 0, String(base.overflow));
  check(`${label} · font locali caricati`, base.fonts.syne && base.fonts.source, JSON.stringify(base.fonts));
  check(`${label} · nessun errore console`, errors.length === 0, errors.slice(0, 2).join(" | "));

  if (!base.proto) {
    await browser.close();
    return;
  }

  const geom = await page.evaluate(() => {
    const sheet = document.getElementById("sheet");
    const nav = document.querySelector(".view--map .bottom-nav");
    const handle = document.getElementById("sheet-handle");
    if (!sheet || !nav || !handle) return null;
    const s = sheet.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    const h = handle.getBoundingClientRect();
    return { gap: Math.round(n.top - s.bottom), handle: [Math.round(h.width), Math.round(h.height)] };
  });

  check(`${label} · parte a striscia`, base.proto.snap === "rail", base.proto.snap);
  check(`${label} · foglio appoggiato sulla nav`, !!geom && geom.gap === 0, geom ? `${geom.gap}px` : "elementi mancanti");
  check(`${label} · handle ≥44px`, !!geom && geom.handle[1] >= 44, geom ? geom.handle.join("x") : "—");

  // tap vero sull'handle
  await page.tap("#sheet-handle");
  await page.waitForTimeout(400);
  const afterTap = await page.evaluate(() => window.__proto.state().snap);
  check(`${label} · tap sull'handle cambia snap`, afterTap !== base.proto.snap, `${base.proto.snap} → ${afterTap}`);

  // drag col mouse (stessa strada dei pointer events)
  await page.evaluate(() => window.__proto.set("rail"));
  await page.waitForTimeout(300);
  const handle = page.locator("#sheet-handle");
  await handle.hover();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - i * 24, { steps: 1 });
  }
  await page.mouse.up();
  await page.waitForTimeout(420);
  const afterDrag = await page.evaluate(() => window.__proto.state());
  check(`${label} · drag apre il foglio`, afterDrag.snap === "full", afterDrag.snap);

  const full = await page.evaluate(() => {
    const sc = document.getElementById("sheet-scroll");
    const row = document.querySelector("#lobby-list .lobby-card");
    const rail = document.getElementById("rail");
    return {
      headGone: getComputedStyle(rail).display === "none",
      rowAtTop: row ? Math.abs(row.getBoundingClientRect().top - sc.getBoundingClientRect().top) <= 2 : null,
      listInert: document.getElementById("list-wrap").inert,
    };
  });
  check(`${label} · a piena la testa sparisce`, full.headGone && full.listInert === false, JSON.stringify(full));
  check(`${label} · a piena la prima riga è in cima`, full.rowAtTop === true, String(full.rowAtTop));

  // schermo intero = 100dvh, e le altezze si ricalcolano
  await page.evaluate(() => window.__proto.set("rail"));
  await page.waitForTimeout(300);
  const heightBefore = await page.evaluate(() => document.getElementById("phone").offsetHeight);
  await page.evaluate(() => document.querySelector("[data-fullscreen]").click());
  await page.waitForTimeout(500);
  const dvh = await page.evaluate(() => ({
    phone: document.getElementById("phone").offsetHeight,
    viewport: window.innerHeight,
    snap: window.__proto.state().snap,
  }));
  check(`${label} · schermo intero = 100dvh`, Math.abs(dvh.phone - dvh.viewport) <= 1, `${dvh.phone} vs ${dvh.viewport}`);
  check(`${label} · altezze ricalcolate sullo schermo`, dvh.phone !== heightBefore, `${heightBefore} → ${dvh.phone}`);

  await browser.close();
}

console.log(`# ${ENGINE} · ${URL}`);
console.log("# non coperti: URL bar/dvh che cambia, env(safe-area-inset), tastiera, gesti, PWA — vedi docs/ios.md\n");
await audit("iPhone 13");
await audit(null, { width: 360, height: 800 });

// reduced motion su un contesto a parte
{
  const browser = await launcher.launch();
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, reducedMotion: "reduce", hasTouch: true });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const ms = await page.evaluate(() => getComputedStyle(document.getElementById("sheet")).transitionDuration);
  check("reduced motion · transizione del foglio ~0", parseFloat(ms) <= 0.001, ms);
  await browser.close();
}

// La safe-area è l'unico pezzo iOS che WebKit non emula (vale sempre 0). Chromium 156+ la sa
// simulare via CDP: qui si verifica che il foglio si alzi davvero e che la nav cresca.
async function safeArea() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const hasHook = await page.evaluate(() => !!(window.__proto && window.__proto.state));
  if (!hasHook) {
    await browser.close();
    return;
  }
  await page.evaluate(() => document.querySelector("[data-fullscreen]").click());
  await page.waitForTimeout(450);
  const read = () =>
    page.evaluate(() => {
      const nav = document.querySelector(".view--map .bottom-nav").getBoundingClientRect();
      const sheet = document.getElementById("sheet").getBoundingClientRect();
      return { navH: Math.round(nav.height), sheetBottom: Math.round(sheet.bottom) };
    });
  const before = await read();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 47, bottom: 34 } });
  await page.waitForTimeout(350);
  const after = await read();
  check("Chromium+CDP · safe-area: il foglio si alza di 34px", before.sheetBottom - after.sheetBottom === 34, `${before.sheetBottom} → ${after.sheetBottom}`);
  check("Chromium+CDP · safe-area: la nav cresce di 34px", after.navH - before.navH === 34, `${before.navH} → ${after.navH}`);
  await browser.close();
}

await safeArea();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.log("FALLITI: " + failed.map((f) => f.name).join(" · "));
  process.exitCode = 1;
}
