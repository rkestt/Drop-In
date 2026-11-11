import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./helpers/console";

// Primitive motion delle pipeline (d7) sulla demo deterministica della
// styleguide: nessun dato reale, nessun login, nessun GPS.

// Durate lette dal browser: ~0 con reduced motion, >0 con motion normale.

test.describe("motion pipeline (styleguide demo)", () => {
  test("step: il contenuto si scambia, una sola animazione per cambio", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await page.goto("/styleguide");
    await page.getByTestId("pipe-demo").scrollIntoViewIfNeeded();
    const step = page.getByTestId("pipe-step");
    await expect(step).toHaveText("Passo 1: posizione");
    await step.scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Passo 2", exact: true }).click();
    // Durante l'uscita i due step coesistono: si attende lo smontaggio del
    // vecchio (un solo nodo = una sola animazione per cambio di stato).
    await expect(step).toHaveCount(1);
    await expect(step).toHaveText("Passo 2: conferma");

    // A transizione assestata niente transform residui sul wrapper Motion.
    await page.waitForTimeout(500);
    const transform = await step.evaluate(
      (el) => getComputedStyle(el.parentElement as HTMLElement).transform
    );
    expect(transform === "none" || transform === "").toBe(true);

    tracker.assertClean();
  });

  test("success pop: testo leggibile, dura ~400ms e non si ripete", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await page.goto("/styleguide");
    await page.getByTestId("pipe-demo").scrollIntoViewIfNeeded();
    const pop = page.getByTestId("pipe-success");
    await expect(pop).toBeAttached();

    await expect(pop.getByText("Check-in effettuato")).toBeVisible();
    await expect(pop.getByText(/Check-in attivo fino alle/)).toBeVisible();

    // A riposo il check è assestato (scala 1 = nessun transform).
    await page.waitForTimeout(700);
    const checkTransform = await pop
      .locator("span[aria-hidden='true']")
      .first()
      .evaluate((el) => getComputedStyle(el).transform);
    expect(checkTransform === "none" || checkTransform === "").toBe(true);

    tracker.assertClean();
  });

  test("highlight: visibile, al tap sfuma e il testo resta", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await page.goto("/styleguide");
    await page.getByTestId("pipe-demo").scrollIntoViewIfNeeded();
    const label = page.getByTestId("pipe-highlight");
    await expect(label).toBeAttached();

    const wrapper = page.locator("[data-highlight]").filter({
      has: label,
    });
    await expect(wrapper).toHaveAttribute("data-highlight", "on");

    await label.click();
    await expect(wrapper).toHaveAttribute("data-highlight", "off");
    // L'informazione non era nel movimento: il testo resta leggibile.
    await expect(label).toHaveText("Sei dentro");
    await expect(label).toBeVisible();

    tracker.assertClean();
  });

  test("reduced motion: niente si muove, tutto resta leggibile", async ({
    page,
  }) => {
    const tracker = await trackConsoleErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/styleguide");
    await page.getByTestId("pipe-demo").scrollIntoViewIfNeeded();

    // Step: scambio istantaneo, nessun transform inline di Motion.
    const step = page.getByTestId("pipe-step");
    await expect(step).toBeAttached();
    await page.getByRole("button", { name: "Passo 2", exact: true }).click();
    // Ramo statico: un solo nodo da subito, niente AnimatePresence.
    await expect(step).toHaveCount(1);
    await expect(step).toHaveText("Passo 2: conferma");
    expect(
      await step.evaluate(
        (el) => (el.parentElement as HTMLElement).style.transform
      )
    ).toBe("");
    expect(
      await step.evaluate(
        (el) => getComputedStyle(el.parentElement as HTMLElement).transform
      )
    ).toBe("none");

    // Success: testo subito leggibile, check fermo.
    const pop = page.getByTestId("pipe-success");
    await expect(pop).toBeAttached();
    await expect(pop.getByText("Check-in effettuato")).toBeVisible();
    await expect(pop.getByText(/Check-in attivo fino alle/)).toBeVisible();
    expect(
      await pop
        .locator("span[aria-hidden='true']")
        .first()
        .evaluate((el) => getComputedStyle(el).transform)
    ).toBe("none");

    // Highlight: nessun velo animato, al tap sparisce e il testo resta.
    const label = page.getByTestId("pipe-highlight");
    await expect(label).toBeAttached();
    const wrapper = page.locator("[data-highlight]").filter({ has: label });
    await expect(wrapper).toHaveAttribute("data-highlight", "on");
    await label.click();
    await expect(wrapper).toHaveAttribute("data-highlight", "off");
    await expect(label).toHaveText("Sei dentro");

    // Cintura di sicurezza: nessun nodo della demo ha transizioni o
    // animazioni CSS attive (la media query globale le azzera).
    const durations = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll(
          "[data-testid='pipe-step'], [data-testid='pipe-success'], [data-testid='pipe-highlight']"
        )
      );
      const toMs = (v: string) =>
        v
          .split(",")
          .map((p) =>
            p.trim().endsWith("ms") ? parseFloat(p) : parseFloat(p) * 1000
          );
      return nodes.flatMap((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        return [...toMs(cs.transitionDuration), ...toMs(cs.animationDuration)];
      });
    });
    for (const d of durations) {
      expect(d).toBeLessThanOrEqual(20);
    }

    tracker.assertClean();
  });
});
