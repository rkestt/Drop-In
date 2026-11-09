import { test, expect, type Page } from "@playwright/test";

// Drawer del progetto (components/ui/drawer.tsx, wrapper Base UI).
// Usa il demo della sezione Componenti in /styleguide: contiene un campo
// di testo così il comportamento da tastiera è verificabile.

async function openComponentiDrawer(page: Page) {
  await page.goto("/styleguide");
  const trigger = page.locator("#componenti").getByRole("button", { name: "Apri drawer" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Transizioni Base UI completate.
  await page.waitForTimeout(600);
  return trigger;
}

async function focusedId(page: Page): Promise<{ id: string; inside: boolean }> {
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    const dlg = document.querySelector('[role="dialog"]');
    return { id: a?.id || a?.tagName || "none", inside: !!dlg && !!a && dlg.contains(a) };
  });
}

test.describe("drawer", () => {
  test("focus iniziale dentro, Tab cicla avanti e indietro", async ({ page }) => {
    await openComponentiDrawer(page);

    const initial = await focusedId(page);
    expect(initial.inside).toBe(true);

    // Avanti: input -> Annulla -> Conferma -> input (ciclo, mai fuori).
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(120);
      const f = await focusedId(page);
      expect(f.inside).toBe(true);
      seen.push(f.id);
    }
    expect(seen[0]).toBe("sg-drawer-nome");
    expect(seen[3]).toBe("sg-drawer-nome");

    // Indietro: 3 Shift+Tab da Conferma percorrono Annulla -> input ->
    // Conferma (ciclo completo all'indietro, mai fuori).
    const backSeen: string[] = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Shift+Tab");
      await page.waitForTimeout(120);
      const f = await focusedId(page);
      expect(f.inside).toBe(true);
      backSeen.push(f.id);
    }
    expect(backSeen[1]).toBe("sg-drawer-nome");
  });

  test("Escape chiude e restituisce il focus al trigger", async ({ page }) => {
    const trigger = await openComponentiDrawer(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 3000 });
    await expect(trigger).toBeFocused();
  });

  test("tap sul backdrop chiude e restituisce il focus al trigger", async ({ page }) => {
    const trigger = await openComponentiDrawer(page);
    await page.mouse.click(200, 40);
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 3000 });
    await expect(trigger).toBeFocused();
  });

  test("scroll del body bloccato da aperto, ripristinato da chiuso", async ({ page }) => {
    await openComponentiDrawer(page);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 3000 });
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("drag oltre soglia chiude", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "touch sintetico via CDP, solo Chromium");
    await openComponentiDrawer(page);
    const box = await page.getByRole("dialog").boundingBox();
    expect(box).not.toBeNull();
    const sx = box!.x + box!.width / 2;
    const sy = box!.y + 20;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: sx, y: sy, id: 1 }],
    });
    for (let i = 1; i <= 15; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: sx, y: sy + i * 30, id: 1 }],
      });
      await page.waitForTimeout(16);
    }
    // Mid-drag: il popup segue il dito (il rilascio oltre soglia chiude).
    const midDragTransform = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return dlg ? getComputedStyle(dlg).transform : "missing";
    });
    expect(midDragTransform).not.toBe("none");
    expect(midDragTransform).not.toBe("missing");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 3000 });
  });

  test("reduced motion: nessuna animazione, contenuto leggibile", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openComponentiDrawer(page);
    const durations = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
      const cs = getComputedStyle(dlg);
      const toMs = (v: string) => {
        const first = v.split(",")[0].trim();
        return first.endsWith("ms") ? parseFloat(first) : parseFloat(first) * 1000;
      };
      return { transition: toMs(cs.transitionDuration), animation: toMs(cs.animationDuration) };
    });
    expect(durations.transition).toBeLessThanOrEqual(20);
    expect(durations.animation).toBeLessThanOrEqual(20);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#sg-drawer-nome")).toBeVisible();
  });
});
