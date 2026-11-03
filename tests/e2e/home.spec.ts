/**
 * @file Landing features: the hero's assembly (goal switch, tray pieces that land or wait, the
 * code card, the finish, Start over, the info card, drag and keyboard), the layers stack, the
 * pyramid (hover on desktop, tap-tap on phones), the package grid and the copy buttons.
 */
import type { Locator, Page } from "@playwright/test";
import type { Goal } from "../../src/data/assembly";
import { appGoal, assemblyText, gameGoal, siteGoal } from "../../src/data/assembly";
import {
  addPiece,
  cardNote,
  codeLines,
  fillText,
  initialAssembly,
  trayCardState
} from "../../src/lib/assembly";
import { parseHeroData } from "../../src/lib/hero-props";
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
import { PACKAGE_IDS, SITE_SCREENS } from "./_inventory";

const hero = (page: Page) => page.locator('[data-component="hero"]');
const plug = (page: Page, id: string) => page.locator(`[data-plug="${id}"]`);
const cube = (page: Page, id: string) => page.locator(`svg[data-part="world"] [data-item="${id}"]`);
const info = (page: Page) => page.locator('[data-part="info"]');
const log = (page: Page) => hero(page).locator('[data-part="log"] li');
/** The callout of the label layer on show (one for desktop, one for phone; CSS hides the other). */
const callout = (page: Page, kind: "waiting" | "running") =>
  page.locator(`[data-labels] [data-callout="${kind}"]:visible`);

/**
 * The code card, one string per line, as the visitor reads it (an empty line is drawn as a space).
 *
 * @param page - The page.
 * @returns The lines.
 */
async function codeCard(page: Page): Promise<string[]> {
  const lines = await hero(page).locator('ol[data-part="code"] li code').allTextContents();
  return lines.map(line => line.trimEnd());
}

/**
 * Add pieces one by one the way the device does: a tap on a phone, a click on desktop.
 *
 * @param page - The page.
 * @param ids - Piece ids, in order.
 * @param phone - Whether the project is a phone.
 */
async function addAll(page: Page, ids: readonly string[], phone: boolean) {
  for (const id of ids) {
    await press(plug(page, id), phone);
    await expect(plug(page, id)).toHaveAttribute("data-state", /placed|waiting/);
  }
}

/**
 * Show a goal through the switch.
 *
 * @param page - The page.
 * @param goal - The goal.
 * @param phone - Whether the project is a phone.
 */
async function showGoal(page: Page, goal: Goal, phone: boolean) {
  await press(page.locator(`[data-goal="${goal.id}"]`), phone);
  await expect(page.locator(`[data-goal="${goal.id}"]`)).toHaveAttribute("aria-checked", "true");
  await expect(plug(page, goal.pieces[0]?.id ?? "")).toBeVisible();
}

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
 * Drag a tray card onto the kernel cube with the mouse, in small steps (the island starts a drag
 * only once the pointer moved past a threshold).
 *
 * @param page - The page.
 * @param id - Piece id.
 */
async function dragToKernel(page: Page, id: string) {
  // The tray at the bottom of the screen, so the kernel above it is on screen too.
  await plug(page, id).evaluate(card => card.scrollIntoView({ block: "end" }));
  await scrollTo(page, plug(page, id));
  const from = await centre(plug(page, id));
  const to = await centre(cube(page, "core"));
  expect(to.y, "the kernel is on screen with the tray").toBeGreaterThan(0);
  const steps = 12;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / steps,
      from.y + ((to.y - from.y) * step) / steps
    );
  }
  await page.mouse.up();
}

test.describe("hero assembly, no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // Bug: the build draws an empty or half-drawn hero, so without JS (or before boot) the idea of
  // the platforms, the kernel, the framework and the pieces to add is not on the page.
  test("first paint: platforms, kernel, web with its plugins, empty sockets, tray, code card", async ({
    page
  }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("h1")).toHaveText(SITE_SCREENS[0]?.title ?? "");
    const data = parseHeroData((await hero(page).getAttribute("data-props")) ?? undefined);
    expect(data, "the hero carries its goals and versions").toBeDefined();
    if (data === undefined) return;
    const start = initialAssembly(siteGoal, data.versions);

    const platform = page.locator('svg[data-part="world"] [data-part="platform"]');
    for (const shade of ["ground", "framework-ring", "app-ring"]) {
      await expect(platform.locator(`[data-shade="${shade}"]`).first()).toBeVisible();
    }
    await expect(cube(page, "core")).toBeVisible();
    await expect(cube(page, siteGoal.framework.id)).toBeVisible();
    for (const standing of siteGoal.standing) await expect(cube(page, standing.id)).toBeVisible();
    for (const id of [...siteGoal.pieces.map(piece => piece.id), "app"]) {
      await expect(page.locator(`[data-socket="${id}"]`)).toHaveCount(1);
      await expect(cube(page, id)).toHaveCount(0);
    }

    await expect(page.locator('[data-part="tray-heading"]')).toHaveText(
      fillText(assemblyText.trayHeading, { app: siteGoal.app.name })
    );
    await expect(page.locator('[data-part="cards"] [data-plug]')).toHaveCount(
      siteGoal.pieces.length
    );
    for (const piece of siteGoal.pieces) {
      await expect(plug(page, piece.id)).toBeVisible();
      await expect(plug(page, piece.id)).toHaveAttribute(
        "data-state",
        trayCardState(siteGoal, start, piece.id)
      );
      await expect(plug(page, piece.id).locator("small")).toHaveText(
        cardNote(siteGoal, start, piece.id)
      );
    }
    await expect(hero(page).locator('ol[data-part="code"]')).toBeVisible();
    expect(await codeCard(page)).toEqual(codeLines(siteGoal, start).map(line => line.text));
    await expect(log(page).last()).toHaveText(start.log.at(-1)?.text ?? "");
  });
});

test.describe("hero assembly", () => {
  // Bug: a piece whose need is missing lands anyway (or is refused), the needed card does not ask
  // to come next, the waiter does not settle once its need is in, or the finish never shows.
  test("Site: comments waits for content, content settles it, newsletter finishes the app", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");

    await press(plug(page, "comments"), phone);
    await expect(plug(page, "comments")).toHaveAttribute("data-state", "waiting");
    await expect(callout(page, "waiting")).toHaveText(
      fillText(assemblyText.waitingCallout, { piece: "comments", need: "content" })
    );
    await expect(plug(page, "content")).toHaveAttribute("data-state", "next");
    await expect(plug(page, "content").locator("small")).toHaveText(assemblyText.card.next);

    await press(plug(page, "content"), phone);
    await expect(plug(page, "content")).toHaveAttribute("data-state", "placed");
    await expect(plug(page, "comments")).toHaveAttribute("data-state", "placed");
    await expect(callout(page, "waiting")).toHaveCount(0);
    await expect(cube(page, "app")).toHaveCount(0);

    await press(plug(page, "newsletter"), phone);
    await expect(callout(page, "running")).toHaveText(
      fillText(assemblyText.completion, { app: siteGoal.app.name })
    );
    await expect(cube(page, "app")).toBeVisible();
    await expect(page.locator('[data-socket="app"]')).toHaveCount(0);
    expect(await codeCard(page)).toEqual([...siteGoal.finalCode]);
  });

  // Bug: the App goal's need (tasks on d1) is not enforced, or its finished code drifts from the
  // frozen snippet the compile test checks.
  test("App: tasks waits for d1; the finished code is the frozen App code", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await showGoal(page, appGoal, phone);

    await press(plug(page, "tasks"), phone);
    await expect(plug(page, "tasks")).toHaveAttribute("data-state", "waiting");
    await expect(callout(page, "waiting")).toHaveText(
      fillText(assemblyText.waitingCallout, { piece: "tasks", need: "d1" })
    );
    await addAll(page, ["d1", "kv"], phone);
    await expect(plug(page, "tasks")).toHaveAttribute("data-state", "placed");
    await expect(callout(page, "running")).toHaveText(
      fillText(assemblyText.completion, { app: appGoal.app.name })
    );
    await expect(cube(page, "app")).toBeVisible();
    expect(await codeCard(page)).toEqual([...appGoal.finalCode]);
  });

  // Bug: the Game goal's finished code drifts from the frozen snippet the compile test checks.
  test("Game: three pieces finish with the frozen Game code", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await showGoal(page, gameGoal, phone);
    await addAll(
      page,
      gameGoal.pieces.map(piece => piece.id),
      phone
    );
    await expect(callout(page, "running")).toHaveText(
      fillText(assemblyText.completion, { app: gameGoal.app.name })
    );
    expect(await codeCard(page)).toEqual([...gameGoal.finalCode]);
  });

  // Bug: a goal switch throws away the progress of the goal left, or Start over resets every goal
  // instead of the one on show.
  test("each goal keeps its progress across switches; Start over resets only the current goal", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const data = parseHeroData((await hero(page).getAttribute("data-props")) ?? undefined);
    if (data === undefined) throw new Error("hero props missing");

    await addAll(page, ["content"], phone);
    await showGoal(page, appGoal, phone);
    await expect(plug(page, "d1")).not.toHaveAttribute("data-state", "placed");
    await addAll(page, ["d1"], phone);
    await showGoal(page, gameGoal, phone);
    await addAll(page, ["screen"], phone);

    await showGoal(page, siteGoal, phone);
    await expect(plug(page, "content")).toHaveAttribute("data-state", "placed");
    await expect(plug(page, "newsletter")).not.toHaveAttribute("data-state", "placed");
    const siteState = addPiece(siteGoal, initialAssembly(siteGoal, data.versions), "content").state;
    expect(await codeCard(page)).toEqual(codeLines(siteGoal, siteState).map(line => line.text));

    await showGoal(page, appGoal, phone);
    await expect(plug(page, "d1")).toHaveAttribute("data-state", "placed");
    await press(page.locator('[data-part="reset"]'), phone);
    await expect(plug(page, "d1")).not.toHaveAttribute("data-state", "placed");
    expect(await codeCard(page)).toEqual(
      codeLines(appGoal, initialAssembly(appGoal, data.versions)).map(line => line.text)
    );

    await showGoal(page, siteGoal, phone);
    await expect(plug(page, "content")).toHaveAttribute("data-state", "placed");
    await showGoal(page, gameGoal, phone);
    await expect(plug(page, "screen")).toHaveAttribute("data-state", "placed");
  });

  // Bug: the keyboard cannot add a piece, the info card does not open on Enter, Esc or × leaves the
  // focus lost on the page, the needs arcs do not show, or the card's Add button does nothing.
  test("keyboard: Enter adds a card; Enter opens a cube's info card, Esc and × close it to the cube; Add adds", async ({
    page
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "keyboard on desktop");
    await boot(page, "/");

    await plug(page, "content").focus();
    await page.keyboard.press("Enter");
    await expect(plug(page, "content")).toHaveAttribute("data-state", "placed");

    await cube(page, "router").focus();
    await page.keyboard.press("Enter");
    await expect(info(page)).toBeVisible();
    await expect(info(page).locator('[data-part="info-name"]')).toHaveText("router");
    await expect(cube(page, "router")).toHaveAttribute("data-selected", "");
    expect(await page.locator('[data-arc="need"]').count()).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(info(page)).toBeHidden();
    await expect(page.locator('[data-arc="need"]')).toHaveCount(0);
    await expect(cube(page, "router")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(info(page)).toBeVisible();
    await info(page).locator('[data-part="info-close"]').click();
    await expect(info(page)).toBeHidden();
    await expect(cube(page, "router")).toBeFocused();

    await page.locator('[data-socket="newsletter"]').click();
    const add = info(page).locator('[data-part="info-add"]');
    await expect(add).toHaveText(fillText(assemblyText.info.add, { piece: "newsletter" }));
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(plug(page, "newsletter")).toHaveAttribute("data-state", "placed");
    await expect(info(page)).toBeHidden();
  });

  // Bug: a drag ends without a drop, a drop on the kernel is ignored, or the click that follows the
  // drag adds the piece a second time.
  test("drag a tray card onto the kernel adds it", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the mouse drag is the desktop gesture");
    await boot(page, "/");
    await dragToKernel(page, "content");
    await expect(plug(page, "content")).toHaveAttribute("data-state", "placed");
    await expect(log(page).last()).toContainText("content");
    await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(0);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    // Bug: under reduced motion the finish still waits for its timed steps (or a flyer is left on
    // screen), so the visitor who asked for no motion waits seconds for the end state.
    test("three taps reach the finished state at once", async ({ page }, testInfo) => {
      const phone = isPhone(testInfo.project.name);
      await boot(page, "/");
      for (const piece of siteGoal.pieces) await press(plug(page, piece.id), phone);
      // The animated finish raises the app after 2.4 s; reduced motion shows it with the last tap.
      await expect(callout(page, "running")).toHaveText(
        fillText(assemblyText.completion, { app: siteGoal.app.name }),
        { timeout: 1000 }
      );
      await expect(cube(page, "app")).toBeVisible({ timeout: 1000 });
      await expect(cube(page, "app").locator("[data-motion]")).toHaveCount(0);
      await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(0);
      expect(await codeCard(page)).toEqual([...siteGoal.finalCode]);
    });
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
  test("the landing sections carry their titles", async ({ page }) => {
    await boot(page, "/");
    await expect(page.locator("#checks")).toHaveCount(0);
    await expect(page.locator("#packages h2").first()).toHaveText("Packages");
    await expect(page.locator("#start h2").first()).toHaveText("Start with Claude");
  });

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
