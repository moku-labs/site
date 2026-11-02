/**
 * @file Head per screen from the single `SITE` source: title (`%s — Moku Labs`, the home page bare),
 * description, canonical, Open Graph, viewport and lang.
 */
import { SITE } from "../../src/config";
import { expect, test } from "./_fixtures";
import { SCREENS } from "./_inventory";

for (const screen of SCREENS.filter(s => !s.static)) {
  test(`head: ${screen.path}`, async ({ page }) => {
    await page.goto(screen.path);
    const title = await page.title();
    if (screen.path === "/") expect(title).toBe(SITE.name);
    else expect(title).toMatch(new RegExp(` — ${SITE.name}$`));
    if (screen.doc) expect(title.startsWith(screen.title)).toBe(true);
    const head = page.locator("head");
    await expect(head.locator('meta[name="description"]')).toHaveAttribute("content", /.{20,}/);
    // The site root is written as the bare origin; every other page with its trailing slash.
    const url = screen.path === "/" ? SITE.url : `${SITE.url}${screen.path}`;
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", url);
    await expect(head.locator('meta[property="og:url"]')).toHaveAttribute("content", url);
    await expect(head.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
    await expect(head.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /width=device-width/
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveCount(1);
  });
}
