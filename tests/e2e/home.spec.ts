/**
 * @file Landing features: the hero kernel world (click and drag plug-in, verdicts, kernel.log,
 * Reset, block tips and links), the layers stack, the pyramid (hover on desktop, tap-tap on
 * phones), the package grid and the copy buttons.
 */
import type { Locator, Page } from "@playwright/test";
import {
  boot,
  clipboardAfterCopy,
  expect,
  isPhone,
  point,
  press,
  scrollTo,
  test
} from "./_fixtures";
import { PACKAGE_IDS } from "./_inventory";

const plug = (page: Page, id: string) => page.locator(`[data-plug="${id}"]`);
const log = (page: Page) => page.locator('[data-part="log"] li');
const appLine = (page: Page) => page.locator('[data-part="app-arguments"]');

/**
 * The centre of an element in page coordinates.
 *
 * @param locator - The element.
 * @returns Its centre.
 */
async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Drag a tray plugin onto the kernel: with the mouse on desktop, with a finger (CDP touch events,
 * the real touch pipeline) on a phone.
 *
 * @param page - The page.
 * @param id - Tray plugin id.
 * @param phone - Whether the project is a phone.
 */
async function dragToKernel(page: Page, id: string, phone: boolean) {
  // Kernel at the top of the screen, so the tray under the world is on screen too (phones stack them).
  await page
    .locator('[data-part="kernel"]')
    .evaluate(kernel => kernel.scrollIntoView({ block: "start" }));
  await scrollTo(page, page.locator('[data-part="kernel"]'));
  const from = await centre(plug(page, id));
  const to = await centre(page.locator('[data-part="kernel"]'));
  const steps = 12;
  const along = (step: number) => ({
    x: from.x + ((to.x - from.x) * step) / steps,
    y: from.y + ((to.y - from.y) * step) / steps
  });
  if (!phone) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let step = 1; step <= steps; step++) await page.mouse.move(along(step).x, along(step).y);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", point?: { x: number; y: number }) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: point ? [{ x: Math.round(point.x), y: Math.round(point.y), id: 1 }] : []
    });
  await touch("touchStart", from);
  for (let step = 1; step <= steps; step++) await touch("touchMove", along(step));
  await touch("touchEnd");
  await cdp.detach();
}

test.describe("hero kernel world", () => {
  test("first paint explains itself: router in, second router refused", async ({ page }) => {
    await boot(page, "/");
    await expect(plug(page, "router")).toHaveAttribute("data-state", "locked");
    await expect(plug(page, "router")).toBeDisabled();
    await expect(plug(page, "router-again")).toHaveAttribute("data-state", "rejected");
    await expect(appLine(page)).toHaveText("({ plugins: [routerPlugin] })");
    await expect(log(page)).toHaveCount(3);
    await expect(log(page).last()).toHaveAttribute("data-kind", "error");
    await expect(log(page).last()).toContainText('Duplicate plugin name: "router"');
  });

  test("click plug-in: accept, refuse with the kernel's exact error, win, reset", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await page.locator('[data-part="tray"]').scrollIntoViewIfNeeded();

    await press(plug(page, "blog"), phone);
    await expect(plug(page, "blog")).toHaveAttribute("data-state", "locked");
    await expect(log(page).last()).toHaveText('"blog" locked in. plugins: 2');
    await expect(appLine(page)).toContainText("blogPlugin");

    await press(plug(page, "start"), phone);
    await expect(plug(page, "start")).toHaveAttribute("data-state", "rejected");
    await expect(log(page).last()).toHaveAttribute("data-kind", "error");
    await expect(log(page).last()).toContainText("start");

    await press(plug(page, "auth"), phone);
    await expect(plug(page, "auth")).toHaveAttribute("data-state", "rejected");
    await expect(log(page).last()).toContainText("session");

    await press(plug(page, "session"), phone);
    await expect(plug(page, "session")).toHaveAttribute("data-state", "locked");
    await press(plug(page, "auth"), phone);
    await expect(plug(page, "auth")).toHaveAttribute("data-state", "locked");
    await expect(page.locator('[data-part="log"] [data-kind="win"]')).toContainText(
      "app.start() → ready. 4 plugins in"
    );
    await expect(log(page)).toHaveCount(6);

    await press(page.locator('[data-part="reset"]'), phone);
    await expect(log(page)).toHaveCount(1);
    await expect(log(page).first()).toHaveText("kernel ready. waiting for plugins.");
    await expect(plug(page, "router")).toBeEnabled();
    await expect(plug(page, "router")).not.toHaveAttribute("data-state", /./);
    await expect(appLine(page)).toHaveText("({ plugins: [] })");
  });

  test("drag a plugin onto the kernel", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await dragToKernel(page, "blog", phone);
    await expect(plug(page, "blog")).toHaveAttribute("data-state", "locked");
    await expect(log(page).last()).toHaveText('"blog" locked in. plugins: 2');
  });

  test.describe("with motion", () => {
    test.use({ reducedMotion: "no-preference" });
    test("a thrown plugin flies, lands in a socket, and a refused one tumbles off", async ({
      page
    }, testInfo) => {
      const phone = isPhone(testInfo.project.name);
      await boot(page, "/");
      await page.locator('[data-part="tray"]').scrollIntoViewIfNeeded();
      await press(plug(page, "blog"), phone);
      await expect(page.locator('[data-part="flyer"][data-clone]')).toBeAttached();
      await expect(plug(page, "blog")).toHaveAttribute("data-state", "locked", { timeout: 5000 });
      await expect(page.locator('[data-part="socket"][data-filled]')).toHaveCount(2);
      await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(0);
      await press(plug(page, "start"), phone);
      await expect(plug(page, "start")).toHaveAttribute("data-state", "rejected", {
        timeout: 5000
      });
      await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(0, {
        timeout: 5000
      });
      await dragToKernel(page, "session", phone);
      await expect(plug(page, "session")).toHaveAttribute("data-state", "locked", {
        timeout: 5000
      });
    });
  });

  test("a family block shows its tip and opens its docs", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const block = page.locator(
      'svg[data-part="world"] [data-part="block"][data-href="/docs/web/"]'
    );
    const tip = page.locator('[data-component="hero"] [data-component="world-tip"]').first();
    if (phone) {
      await block.focus();
      await expect(tip).toBeVisible();
    } else {
      await block.hover();
      await expect(tip).toBeVisible();
      await expect(tip).toContainText("@moku-labs/web");
    }
    await press(block, phone);
    await expect(page).toHaveURL(/\/docs\/web\/$/);
    await expect(page.locator("h1").first()).toHaveText("@moku-labs/web");
  });
});

test.describe("layers stack", () => {
  test("a layer, its step and its code line light together", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const stack = page.locator('[data-island="layers-stack"]');
    await stack.scrollIntoViewIfNeeded();
    await expect(stack.locator('svg [data-layer="3"]')).toHaveAttribute("data-active", "");
    const layer = stack.locator('svg [data-layer="1"]');
    await point(layer, phone);
    await expect(layer).toHaveAttribute("data-active", "");
    await expect(stack.locator('[data-part="steps"] [data-layer="1"]')).toHaveAttribute(
      "data-active",
      ""
    );
    await expect(stack.locator('svg [data-layer="3"]')).not.toHaveAttribute("data-active", /.*/);
    await expect(stack.locator('[data-part="gutter"] > [data-line="1"]')).toHaveAttribute(
      "data-highlight",
      ""
    );
    const step = stack.locator('[data-part="steps"] [data-layer="2"]');
    await press(step, phone);
    await expect(stack.locator('svg [data-layer="2"]')).toHaveAttribute("data-active", "");
  });
});

test.describe("pyramid", () => {
  test("desktop: hover lights relations, click opens", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "hover is a desktop gesture");
    await boot(page, "/");
    const wide = page.locator('[data-component="pyramid"] svg[data-layout="wide"]');
    await expect(
      page.locator('[data-component="pyramid"] svg[data-layout="stacked"]')
    ).toBeHidden();
    const trivia = wide.locator('[data-brick][data-id="trivia"]');
    await scrollTo(page, wide);
    await trivia.hover();
    await expect(trivia).toHaveAttribute("data-current", "");
    for (const id of ["web", "room", "worker"]) {
      await expect(wide.locator(`[data-kind="package"][data-id="${id}"]`)).toHaveAttribute(
        "data-related",
        ""
      );
    }
    await expect(wide.locator('[data-kind="package"][data-id="game"]')).not.toHaveAttribute(
      "data-related",
      /.*/
    );
    const tip = page.locator('[data-component="pyramid"] [data-component="world-tip"]');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Trivia");
    await wide.locator('[data-kind="package"][data-id="game"]').hover();
    await expect(wide.locator('[data-kind="demo"][data-id="ticktoe"]')).toHaveAttribute(
      "data-related",
      ""
    );
    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
    await trivia.click();
    await expect(page).toHaveURL(/\/demos\/#trivia$/);
  });

  test("phone: stacked, first tap shows, second tap opens, tap beside closes", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "tap-tap is the phone gesture");
    await boot(page, "/");
    const stacked = page.locator('[data-component="pyramid"] svg[data-layout="stacked"]');
    await expect(stacked).toBeVisible();
    await expect(page.locator('[data-component="pyramid"] svg[data-layout="wide"]')).toBeHidden();
    const box = await stacked.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);
    const brick = stacked.locator('[data-brick][data-kind="package"][data-id="web"]');
    await scrollTo(page, stacked);
    await brick.tap();
    const tip = page.locator('[data-component="pyramid"] [data-component="world-tip"]');
    await expect(tip).toBeVisible();
    await expect(brick).toHaveAttribute("data-current", "");
    // The tip fits on the screen at its own width, not squeezed against the right edge.
    await expect(tip).toBeInViewport({ ratio: 1 });
    const tipBox = await tip.boundingBox();
    expect(tipBox?.width ?? 0).toBeGreaterThanOrEqual(200);
    await expect(page).toHaveURL(/\/$/);
    await stacked.tap({ position: { x: 2, y: 2 } });
    await expect(tip).toBeHidden();
    await scrollTo(page, stacked);
    await brick.tap();
    await expect(tip).toBeVisible();
    // A finger lands where the brick is now: no scroll in between (a scroll puts the tip away).
    const at = await centre(brick);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page).toHaveURL(/\/docs\/web\/$/);
  });

  test("keyboard: Enter on a brick opens it", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "keyboard on desktop");
    await boot(page, "/");
    const brick = page.locator('svg[data-layout="wide"] [data-brick][data-kind="core"]');
    await scrollTo(page, brick);
    await brick.focus();
    await expect(
      page.locator('[data-component="pyramid"] [data-component="world-tip"]')
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/docs\/core\/$/);
  });
});

test.describe("packages and copy", () => {
  test("the package grid lists every package and links to its docs", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const grid = page.locator('[data-component="package-grid"]');
    await expect(grid.locator("a")).toHaveCount(PACKAGE_IDS.length);
    for (const id of PACKAGE_IDS)
      await expect(grid.locator(`a[href="/docs/${id}/"]`)).toHaveCount(1);
    await press(grid.locator('a[href="/docs/worker/"]'), phone);
    await expect(page).toHaveURL(/\/docs\/worker\/$/);
  });

  test("the install terminal copies only the commands", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const terminal = page.locator(
      '[data-component="claude-install"] figure[data-component="terminal"]'
    );
    await terminal.scrollIntoViewIfNeeded();
    const button = terminal.locator('[data-part="copy"]');
    await expect(button).toHaveText("Copy");
    await press(button, phone);
    const text = await clipboardAfterCopy(page, button);
    expect(text).toBe("/plugin marketplace add moku-labs/claude\n/plugin install moku@moku");
    await expect(button).toHaveText("Copy", { timeout: 4000 });
  });

  test("every prompt bubble copies its prompt", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const prompts = page.locator('figure[data-component="prompt"]');
    expect(await prompts.count()).toBeGreaterThan(0);
    const first = prompts.first();
    await first.scrollIntoViewIfNeeded();
    const expected = (await first.getAttribute("data-copy")) ?? "";
    expect(expected.length).toBeGreaterThan(0);
    await press(first.locator('[data-part="copy"]'), phone);
    expect(await clipboardAfterCopy(page, first.locator('[data-part="copy"]'))).toBe(expected);
  });
});
