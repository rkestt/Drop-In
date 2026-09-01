import type { Page } from "@playwright/test";

const IGNORED_PATTERNS = [
  // MapLibre tiles may fail offline / rate-limited; not an app error
  /Failed to load resource.*(tiles|mapbox|openstreetmap)/i,
  /net::ERR_/,
  /\[Fast Refresh\]/,
  /Download the React DevTools/i,
  /Autofocus processing/i,
];

export interface ConsoleErrorTracker {
  errors: string[];
  assertClean: () => void;
}

export async function trackConsoleErrors(page: Page): Promise<ConsoleErrorTracker> {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_PATTERNS.some((p) => p.test(text))) return;
    errors.push(text);
  });

  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });

  return {
    errors,
    assertClean() {
      if (errors.length > 0) {
        throw new Error(
          `Console errors detected (${errors.length}):\n${errors.join("\n")}`
        );
      }
    },
  };
}
