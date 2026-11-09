// scripts/check-design.mjs — guardrail anti-regressione del design system.
// Scansiona app/, components/, lib/ (*.ts, *.tsx, *.css) e fallisce (exit 1) se:
//  - trova `data-theme` (un solo tema, mai toggle)
//  - trova varianti Tailwind `dark:` in className
//  - trova colori hardcoded (#hex, rgb(, hsl(, oklch() fuori dall'allowlist
//  - in app/globals.css manca uno dei token obbligatori
// Zero dipendenze. Uso: node scripts/check-design.mjs
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCAN_DIRS = ["app", "components", "lib"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const EXCLUDED_TOP = new Set([
  "node_modules",
  ".next",
  ".git",
  "tests",
  "scripts",
  "docs",
  ".opencode",
  ".agents",
  "public",
]);

// Allowlist SOLO per i colori hardcoded: fallback standalone o API esterne.
const COLOR_ALLOWLIST = new Set([
  "app/globals.css",
  "app/layout.tsx",
  "app/global-error.tsx",
  "components/map/court-map.tsx",
  "lib/map/provider.ts",
]);

const REQUIRED_TOKENS = [
  "--bg-base",
  "--bg-surface",
  "--bg-elevated",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--accent",
  "--accent-hover",
  "--accent-subtle",
  "--success",
  "--danger",
  "--warning",
  "--cool-muted",
];

const COLOR_PATTERNS = [
  { re: /#[0-9a-fA-F]{3,8}\b/g, label: "colore hardcoded (#hex)" },
  { re: /\brgb\(/g, label: "colore hardcoded (rgb()" },
  { re: /\bhsl\(/g, label: "colore hardcoded (hsl()" },
  { re: /\boklch\(/g, label: "colore hardcoded (oklch()" },
];
const DATA_THEME_RE = /data-theme/;
const DARK_VARIANT_RE = /\bdark:/;

// Scala chiusa: i px che hanno un token non vanno scritti a mano.
const TEXT_PX_TO_UTILITY = {
  11: "text-label",
  12: "text-xs",
  14: "text-sm",
  16: "text-base",
  18: "text-lg",
  20: "text-xl",
  24: "text-2xl",
  28: "text-display-sm",
  32: "text-display",
  40: "text-display-lg",
};
// Eccezioni note, documentate in gaps.md: valori fuori scala o raggi non di componente.
const ARBITRARY_ALLOWLIST = [
  { re: /text-\[13px\]/, reason: "13px fuori scala" },
  { re: /text-\[64px\]/, reason: "numeri hero fuori scala" },
  { re: /rounded-\[1px\]/, reason: "barra 1px, non un raggio di componente" },
];
const ROUNDED_ARB_RE = /rounded(?:-[trblse])?-\[(?!var\()[^\]\n]+\]/g;
const TEXT_PX_RE = /text-\[([0-9.]+)px\]/g;
const SPACING_ARB_RE =
  /(?:gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-\[[0-9.]+(?:px|rem)\]/g;

async function collectFiles(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // dir assente: niente da scansionare
  }
  for (const e of entries) {
    if (EXCLUDED_TOP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await collectFiles(full, out);
    } else if (e.isFile() && EXTENSIONS.has(path.extname(e.name))) {
      out.push(full);
    }
  }
}

const errors = [];
let fileCount = 0;

const files = [];
for (const d of SCAN_DIRS) await collectFiles(path.join(ROOT, d), files);
files.sort();
fileCount = files.length;

for (const full of files) {
  const rel = path.relative(ROOT, full).replaceAll(path.sep, "/");
  const content = await readFile(full, "utf8");
  const lines = content.split("\n");
  const colorAllowed = COLOR_ALLOWLIST.has(rel);
  lines.forEach((line, i) => {
    const n = i + 1;
    if (DATA_THEME_RE.test(line))
      errors.push(`${rel}:${n}: vietato data-theme (un solo tema, mai toggle)`);
    // Varianti Tailwind dark: solo in className (spec). Così i token
    // --success-dark/--danger-dark/--warning-dark e le chiavi "dark" di API
    // esterne (es. stili mappa light/dark) non sono falsi positivi.
    if (line.includes("className") && DARK_VARIANT_RE.test(line))
      errors.push(`${rel}:${n}: vietata variante dark: in className (un solo tema)`);

    // Raggi arbitrari (fuori dalla scala tokenizzata).
    ROUNDED_ARB_RE.lastIndex = 0;
    for (const token of line.match(ROUNDED_ARB_RE) ?? []) {
      if (!ARBITRARY_ALLOWLIST.some((a) => a.re.test(token))) {
        errors.push(
          `${rel}:${n}: raggio arbitrario ${token} (usa rounded-control/card/sheet/chip)`
        );
      }
    }

    // text-[Npx]: se il px ha un token, la classe arbitraria è vietata.
    TEXT_PX_RE.lastIndex = 0;
    let tm;
    while ((tm = TEXT_PX_RE.exec(line))) {
      const px = Number(tm[1]);
      const util = TEXT_PX_TO_UTILITY[px];
      if (util) {
        errors.push(`${rel}:${n}: text-[${tm[1]}px] arbitrario (usa ${util})`);
      } else if (!ARBITRARY_ALLOWLIST.some((a) => a.re.test(tm[0]))) {
        errors.push(
          `${rel}:${n}: text-[${tm[1]}px] fuori scala (aggiungi un token o documenta l'eccezione)`
        );
      }
    }

    // Spacing arbitrario (gap/padding/margin).
    SPACING_ARB_RE.lastIndex = 0;
    if (SPACING_ARB_RE.test(line)) {
      errors.push(`${rel}:${n}: spacing arbitrario (usa la scala Tailwind)`);
    }
    if (!colorAllowed) {
      for (const { re, label } of COLOR_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(line)) {
          errors.push(`${rel}:${n}: ${label} fuori allowlist (usa i token di globals.css)`);
          break; // un errore per riga basta
        }
      }
    }
  });
}

// Token obbligatori in app/globals.css
try {
  const css = await readFile(path.join(ROOT, "app", "globals.css"), "utf8");
  for (const token of REQUIRED_TOKENS) {
    if (!css.includes(token))
      errors.push(`app/globals.css: token mancante ${token}`);
  }
} catch {
  errors.push("app/globals.css: file non trovato");
}

if (errors.length > 0) {
  for (const e of errors) console.error(e);
  console.error(`\ndesign check: FALLITO (${errors.length} problemi in ${fileCount} file)`);
  process.exit(1);
}
console.log(`design check: OK (${fileCount} file)`);
