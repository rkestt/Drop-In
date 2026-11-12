#!/usr/bin/env node
/**
 * Riassegna l'alias leggibile `drop-in-stage.vercel.app` al deployment
 * più recente del branch `stage`.
 *
 * Perché serve: l'alias custom NON segue le release da solo — solo
 * l'alias per-branch `drop-in-git-stage-....vercel.app` si aggiorna a
 * ogni push. Senza questo passo, `drop-in-stage.vercel.app` resta fermo
 * al build precedente (è già successo: build di 19 h servito come nuovo).
 *
 * Uso: `npm run stage:alias` (dopo ogni release sullo stage).
 *
 * Strategia (sicura di default):
 * 1. `npx vercel ls drop-in --yes` → primo URL
 *    `https://drop-*-andrea-fioris-projects-14d416c7.vercel.app`
 *    (l'output è ordinato, il primo è il più recente);
 * 2. `npx vercel inspect <url>` → conferma che il deployment sia del
 *    branch `stage` (cerca l'alias per-branch `drop-in-git-stage-...`);
 *    se il match non è certo, NON riassegna e stampa cosa ha visto;
 * 3. `npx vercel alias set <url> drop-in-stage.vercel.app`.
 *
 * Auth: usa quella locale del CLI (`~/.local/share/com.vercel.cli`,
 * come `npx vercel`); se il CLI non è autenticato, lo dice e si ferma.
 * Exit code non-zero se qualcosa fallisce. Zero dipendenze nuove.
 */
import { spawnSync } from "node:child_process";

const PREFIX = "[stage-alias]";
const PROJECT = "drop-in";
const TEAM = "andrea-fioris-projects-14d416c7";
const ALIAS = "drop-in-stage.vercel.app";
const BRANCH_ALIAS_PREFIX = "drop-in-git-stage-";

function log(msg) {
  console.log(`${PREFIX} ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`${PREFIX} ✖ ${msg}`);
  process.exit(code);
}

function runVercel(args) {
  // Nota: `vercel inspect` scrive il report su stderr (non su stdout),
  // quindi gli stream vanno letti combinati.
  const r = spawnSync("npx", ["vercel", ...args], {
    encoding: "utf8",
    timeout: 120_000,
  });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  if ((r.status ?? 1) !== 0 || r.error) {
    if (/not logged in|no existing credentials|please log in|log in to Vercel/i.test(out)) {
      fail(
        "CLI Vercel non autenticato: esegui `npx vercel login` e riprova.",
      );
    }
    fail(`comando fallito: npx vercel ${args.join(" ")}\n${out.trim().slice(0, 1000)}`);
  }
  return out;
}

log(`cerco il deployment più recente del progetto ${PROJECT}...`);
const ls = runVercel(["ls", PROJECT, "--yes"]);
const urls = ls.match(new RegExp(`https://drop-[^\\s]*?${TEAM}\\.vercel\\.app`, "g")) ?? [];
if (urls.length === 0) {
  fail(
    `nessun deployment trovato per ${PROJECT} (output di \`vercel ls\` senza URL attesi):\n${ls.trim().slice(0, 1000)}`,
  );
}
const latest = urls[0];
log(`deployment più recente: ${latest}`);

log(`verifico che sia del branch stage (vercel inspect)...`);
const info = runVercel(["inspect", latest]);
const confirmed = info.includes(BRANCH_ALIAS_PREFIX);
if (!confirmed) {
  console.error(`${PREFIX} ✖ non posso confermare il branch stage: ecco cosa ho visto (non riassegno nulla):`);
  console.error(info.trim().slice(0, 2000));
  console.error(`${PREFIX} atteso un alias che contenga \`${BRANCH_ALIAS_PREFIX}\`.`);
  process.exit(1);
}
log(`confermato branch stage (alias ${BRANCH_ALIAS_PREFIX}... presente).`);

// Il deployment esiste prima che la build finisca: `alias set` su un build
// in corso risponde "is not ready". Aspettiamo invece di far rifare tutto
// a mano, che è esattamente il momento in cui si smette di lanciare lo script.
const READY_TIMEOUT_MS = 10 * 60_000;
const POLL_MS = 10_000;

function statusOf(out) {
  const line = out.split("\n").find((l) => /^\s*status\s/i.test(l)) ?? "";
  return line.toLowerCase();
}

async function waitUntilReady(url) {
  const started = Date.now();
  let last = "";
  for (;;) {
    const info = runVercel(["inspect", url]);
    last = statusOf(info);
    if (last.includes("ready")) return info;
    if (last.includes("error") || last.includes("canceled")) {
      fail(`il deployment è finito in stato ${last.trim() || "sconosciuto"}: ${url}`);
    }
    if (Date.now() - started > READY_TIMEOUT_MS) {
      fail(`deployment non pronto dopo ${READY_TIMEOUT_MS / 60_000} minuti (${last.trim()}), riprova più tardi: ${url}`);
    }
    log(`build in corso (${last.trim() || "stato sconosciuto"}), riprovo tra ${POLL_MS / 1000}s...`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

await waitUntilReady(latest);

runVercel(["alias", "set", latest, ALIAS]);
log(`alias ${ALIAS} → ${latest}`);

const interesting = info
  .split("\n")
  .filter((l) => /commit|branch|status|created|author|message|sha/i.test(l))
  .map((l) => l.trim())
  .filter(Boolean);
if (interesting.length > 0) {
  log(`deployment promosso:`);
  for (const l of interesting) log(`  ${l}`);
} else {
  log(`deployment promosso (dettagli completi in \`npx vercel inspect ${latest}\`).`);
}
