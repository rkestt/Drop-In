// design-review.mjs — review visiva + accessibilita' + token design, read-only.
// Uso: node .opencode/skills/design-review/scripts/design-review.mjs [--url URL] [--out DIR] [--dry-run] [--help]
// - Assume un dev server su --url (default http://localhost:3000); se non risponde,
//   ne avvia uno (npm run dev) e lo spegne alla fine. Non modifica codice, non committa.
// - Screenshot Playwright a 360x780, 768x1024, 1280x800 in --out (default /tmp/opencode/design-review/).
// - Accessibilita' via axe-core; token colori riusando scripts/check-design.mjs (sottoprocesso).
// - Report su stdout in formato `posizione [severita'] messaggio`; exit 1 se ci sono error.
import { execFile, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(
  path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))),
);
const CHECK_DESIGN = path.join(ROOT, "scripts", "check-design.mjs");
const VIEWPORTS = [
  { w: 360, h: 780, label: "360x780" },
  { w: 768, h: 1024, label: "768x1024" },
  { w: 1280, h: 800, label: "1280x800" },
];
const AXE_SEVERITY = { critical: "error", serious: "error", moderate: "warn", minor: "warn" };

function usage() {
  console.log(`design-review — review read-only di una pagina (screenshot + axe + token design)

Uso:
  node ${path.relative(ROOT, fileURLToPath(import.meta.url))} [--url URL] [--out DIR] [--dry-run]

Opzioni:
  --url URL   pagina da rivedere (default http://localhost:3000)
  --out DIR   cartella screenshot/report (default /tmp/opencode/design-review)
  --dry-run   stampa il piano senza avviare browser o server
  --help      mostra questo aiuto
`);
}

function parseArgs(argv) {
  const opts = { url: "http://localhost:3000", out: "/tmp/opencode/design-review", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") opts.url = argv[++i];
    else if (argv[i] === "--out") opts.out = argv[++i];
    else if (argv[i] === "--dry-run") opts.dryRun = true;
    else if (argv[i] === "--help") { usage(); process.exit(0); }
    else { console.error(`opzione sconosciuta: ${argv[i]}`); usage(); process.exit(2); }
  }
  if (!opts.url) { console.error("--url richiede un valore"); process.exit(2); }
  return opts;
}

async function serverUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok || res.status < 500;
  } catch { return false; }
}

async function ensureServer(url) {
  if (await serverUp(url)) return null; // assunto: server esistente, non lo tocchiamo
  const port = new URL(url).port || "3000";
  const child = spawn("npm", ["run", "dev", "--", "-p", port], {
    cwd: ROOT, stdio: "ignore", detached: true,
  });
  child.unref();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await serverUp(url)) return child;
  }
  try { process.kill(-child.pid); } catch { /* gia' morto */ }
  throw new Error(`dev server non partito entro 60s su ${url} (avvia prima npm run dev)`);
}

// Riusa check-design.mjs senza duplicarne la logica: lo esegue e ne mappa l'output.
function runTokenCheck() {
  return new Promise((resolve) => {
    execFile("node", [CHECK_DESIGN], { cwd: ROOT }, (err, stdout, stderr) => {
      const findings = [];
      for (const line of `${stdout}\n${stderr}`.split("\n")) {
        const m = line.match(/^(.+?):(\d+): (.+)$/);
        if (m) findings.push({ where: `${m[1]}:${m[2]}`, severity: "error", message: m[3] });
      }
      const ok = !err && findings.length === 0;
      resolve({ ok, findings });
    });
  });
}

async function reviewViewport(browser, AxeBuilder, url, out, vp) {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  const shot = path.join(out, `${vp.label}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  const { violations } = await new AxeBuilder({ page }).analyze();
  const findings = violations.flatMap((v) =>
    (v.nodes || []).map((n) => ({
      where: `${url} @${vp.label} ${Array.isArray(n.target) ? n.target.join(",") : n.target}`,
      severity: AXE_SEVERITY[v.impact] || "warn",
      message: `axe/${v.id}: ${v.help}`,
    })),
  );
  await context.close();
  return { shot, findings };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.dryRun) {
    console.log(`dry-run: url=${opts.url} out=${opts.out}`);
    console.log(`dry-run: viewport ${VIEWPORTS.map((v) => v.label).join(", ")}`);
    console.log(`dry-run: token check via ${path.relative(ROOT, CHECK_DESIGN)} (riuso, non duplicato)`);
    console.log(`dry-run: axe-core + screenshot, nessuna modifica al codice, nessun commit`);
    const [{ chromium }, { AxeBuilder }] = await Promise.all([
      import("@playwright/test"), import("@axe-core/playwright"),
    ]);
    if (!chromium || !AxeBuilder) throw new Error("dipendenze Playwright/axe mancanti");
    console.log("dry-run: dipendenze OK (playwright, @axe-core/playwright)");
    return;
  }
  await mkdir(opts.out, { recursive: true });
  const serverChild = await ensureServer(opts.url);
  const [{ chromium }, { AxeBuilder }] = await Promise.all([
    import("@playwright/test"), import("@axe-core/playwright"),
  ]);
  const browser = await chromium.launch();
  const findings = [];
  const shots = [];
  try {
    for (const vp of VIEWPORTS) {
      const r = await reviewViewport(browser, AxeBuilder, opts.url, opts.out, vp);
      shots.push(r.shot);
      findings.push(...r.findings);
    }
  } finally {
    await browser.close();
    if (serverChild) try { process.kill(-serverChild.pid); } catch { /* gia' morto */ }
  }
  const tokens = await runTokenCheck();
  findings.push(...tokens.findings);
  for (const f of findings) console.log(`${f.where} [${f.severity}] ${f.message}`);
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const report = { url: opts.url, shots, errors, warns, findings };
  await writeFile(path.join(opts.out, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\ndesign-review: ${errors} error, ${warns} warn — screenshot e report in ${opts.out}`);
  if (errors > 0) process.exit(1);
}

main().catch((e) => { console.error(`design-review: ${e.message}`); process.exit(2); });
