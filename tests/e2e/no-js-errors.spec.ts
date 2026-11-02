/**
 * @file Boot guard: every screen loads with zero browser errors, top to bottom (scrolling runs the
 * observers and lazy loads), and the SPA is alive: a client navigation swaps the page without a
 * full reload.
 */
import { boot, expect, test } from "./_fixtures";
import { SCREENS } from "./_inventory";

for (const screen of SCREENS) {
  test(`boots clean: ${screen.path}`, async ({ page }) => {
    await boot(page, screen.path, { static: screen.static ?? false });
    await expect(page.locator("h1").first()).toHaveText(screen.title);
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      scrollTo(0, 0);
    });
  });
}

test("client navigation swaps the page without a reload", async ({ page }) => {
  await boot(page, "/docs/");
  await page.evaluate(() => {
    (globalThis as unknown as { spaMarker: number }).spaMarker = 1;
  });
  await page.locator('main a[href="/docs/web/"]').first().click();
  await expect(page).toHaveURL(/\/docs\/web\/$/);
  await expect(page.locator("h1").first()).toHaveText("@moku-labs/web");
  expect(
    await page.evaluate(() => (globalThis as unknown as { spaMarker?: number }).spaMarker)
  ).toBe(1);
  await page.goBack();
  await expect(page.locator("h1").first()).toHaveText("Docs");
  expect(
    await page.evaluate(() => (globalThis as unknown as { spaMarker?: number }).spaMarker)
  ).toBe(1);
});
