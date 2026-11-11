import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { EASE, MOTION } from "@/lib/motion/tokens";

const ROOT = path.resolve(__dirname, "../..");
const GLOBALS_CSS = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

function cssTokenValue(token: string): string {
  const match = GLOBALS_CSS.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!match) throw new Error(`token ${token} non trovato in app/globals.css`);
  return match[1].trim();
}

function msToSeconds(ms: string): number {
  const m = ms.match(/^([\d.]+)ms$/);
  if (!m) throw new Error(`durata non in ms: ${ms}`);
  return parseFloat(m[1]) / 1000;
}

function bezierToArray(bezier: string): readonly [number, number, number, number] {
  const m = bezier.match(
    /^cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/
  );
  if (!m) throw new Error(`curva non cubic-bezier: ${bezier}`);
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
}

describe("motion tokens (JS) rispecchiano i token CSS", () => {
  it.each([
    ["--motion-fast", MOTION.fast],
    ["--motion-base", MOTION.base],
    ["--motion-slow", MOTION.slow],
    ["--motion-success", MOTION.success],
  ] as const)("%s = %s secondi", (token, seconds) => {
    expect(msToSeconds(cssTokenValue(token))).toBeCloseTo(seconds, 5);
  });

  it.each([
    ["--ease-standard", EASE.standard],
    ["--ease-elastic", EASE.elastic],
  ] as const)("%s coincide con la curva JS", (token, curve) => {
    expect(bezierToArray(cssTokenValue(token))).toEqual([...curve]);
  });
});

describe("primitive motion: niente valori inventati", () => {
  const dir = path.join(ROOT, "components/motion");
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));

  it("ogni primitiva importa le durate da lib/motion/tokens", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(path.join(dir, file), "utf8");
      expect(src, file).toContain("@/lib/motion/tokens");
    }
  });

  it("ogni primitiva usa useStableReducedMotion (quello di Motion non basta)", () => {
    // useReducedMotion() di Motion fotografa il valore al primo render (in SSR
    // sempre false) e non si aggiorna: vedi lib/motion/use-reduced-motion.ts.
    for (const file of files) {
      const src = readFileSync(path.join(dir, file), "utf8");
      expect(src, file).toContain("@/lib/motion/use-reduced-motion");
      expect(src, file).not.toMatch(/useReducedMotion\(\)/);
    }
  });

  it("nessuna durata numerica scritta a mano nei componenti", () => {
    for (const file of files) {
      const src = readFileSync(path.join(dir, file), "utf8");
      // `duration: MOTION.*` ok; `duration: 0.2` no.
      expect(src, file).not.toMatch(/duration:\s*\d/);
    }
  });

  it("nessun loop o timer di animazione nelle primitive", () => {
    for (const file of files) {
      const src = readFileSync(path.join(dir, file), "utf8");
      expect(src, file).not.toContain("setInterval");
      expect(src, file).not.toContain("animation-iteration-count");
      expect(src, file).not.toContain("infinite");
    }
  });
});
