/**
 * @file What shipped beside the search: the phone type scale, the Sora headings, the favicon set,
 * the "Moku" brand in the header and the footer, the demo stacks and filter chips, the pyramid's
 * bricks and paint order, and the docs sidebar and table of contents as they stay put and follow
 * the page. Expectations come from the plain data files and from the page's own headings.
 */
import type { Locator, Page } from "@playwright/test";
import { demos } from "../../src/data/demos";
import { packages } from "../../src/data/packages";
import { boot, expect, isPhone, press, scrollTo, test } from "./_fixtures";
import { RICH_DOC, SITE_SCREENS } from "./_inventory";

/**
 * A computed font size.
 *
 * @param locator - The element.
 * @returns Its size, px.
 */
function fontSize(locator: Locator): Promise<number> {
  return locator.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
}

const sidebar = (page: Page) => page.locator('[data-component="docs-sidebar"]');
const toc = (page: Page) => page.locator('aside[data-component="docs-toc"]');

/**
 * The h2 and h3 of the article as the TOC should list them.
 *
 * @param page - The page.
 * @returns Id and depth of each heading, in document order.
 */
function articleHeadings(page: Page): Promise<string[]> {
  return page
    .locator("[data-content] :is(h2, h3)[id]")
    .evaluateAll(all => all.map(heading => `${heading.id}:${heading.tagName.slice(1)}`));
}

/**
 * What the TOC lists.
 *
 * @param page - The page.
 * @returns Id and depth of each item, in list order.
 */
function tocItems(page: Page): Promise<string[]> {
  return toc(page)
    .locator("ul li")
    .evaluateAll(all =>
      all.map(item => {
        const href = item.querySelector("a")?.getAttribute("href")?.slice(1) ?? "";
        return `${decodeURIComponent(href)}:${(item as HTMLElement).dataset.depth}`;
      })
    );
}

/**
 * Whether an element is in view and clear of the sticky header.
 *
 * @param page - The page.
 * @param selector - The element.
 */
async function expectLanded(page: Page, selector: string) {
  const target = page.locator(selector);
  await expect(target).toBeInViewport();
  await expect
    .poll(async () => {
      const top = await target.evaluate(element => element.getBoundingClientRect().top);
      const bottom = await page
        .locator('[data-component="site-header"]')
        .evaluate(element => element.getBoundingClientRect().bottom);
      return top >= bottom && top <= bottom + 60;
    })
    .toBe(true);
  await expect.poll(() => target.evaluate(element => element.matches(":target"))).toBe(true);
}

/**
 * The drawing on show.
 *
 * @param page - The page.
 * @param phone - Whether the project is a phone.
 * @returns The `<svg>`.
 */
const drawing = (page: Page, phone: boolean) =>
  page.locator(`[data-component="pyramid"] svg[data-layout="${phone ? "stacked" : "wide"}"]`);

test.describe("type scale", () => {
  // Bug: the phone rules lose to the desktop ones by source order or by @scope, so prose stays 17px
  // and code stays 13.5px on a 390-wide screen.
  test("docs prose and code take their size for the device", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, RICH_DOC);
    const content = page.locator("[data-content]").first();
    const expected = phone
      ? { body: 15.5, prose: 15.5, h2: 20, inline: 12.5, code: 11.5, line: 18.4, lead: 17 }
      : { body: 17, prose: 17, h2: 22, inline: 13, code: 13.5, line: 23.22, lead: undefined };
    expect(await fontSize(page.locator("body"))).toBe(expected.body);
    expect(await fontSize(content)).toBe(expected.prose);
    expect(await fontSize(content.locator("h2").first())).toBe(expected.h2);
    expect(await fontSize(content.locator(":not(pre) > code").first())).toBe(expected.inline);
    const body = page.locator('figure[data-component="code"] [data-part="body"]').first();
    expect(await fontSize(body)).toBe(expected.code);
    const inner = body.locator("pre code").first();
    expect(await fontSize(inner)).toBe(expected.code);
    const line = await inner.evaluate(element =>
      Number.parseFloat(getComputedStyle(element).lineHeight)
    );
    expect(line).toBeCloseTo(expected.line, 1);
    if (expected.lead !== undefined) {
      expect(
        await fontSize(page.locator('[data-component="doc-article"] [data-part="lead"]'))
      ).toBe(expected.lead);
    }
  });

  test("a table is set smaller on a phone, its head smaller still", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the phone scale");
    await boot(page, "/docs/web/how-it-works/");
    const table = page.locator("[data-content] table").first();
    expect(await fontSize(table)).toBe(13);
    expect(await fontSize(table.locator("th").first())).toBe(11.5);
    expect(await fontSize(table.locator("td").first())).toBe(13);
  });

  // Bug: the gutter keeps the desktop line height, so the numbers drift off their lines down a block.
  test("every gutter row stays on its code line", async ({ page }) => {
    await boot(page, RICH_DOC);
    const drift = await page
      .locator('figure[data-component="code"]:not([hidden])')
      .evaluateAll(figures =>
        figures.flatMap(figure => {
          const gutter = [...figure.querySelectorAll('[data-part="gutter"] > [data-line]')];
          const lines = [...figure.querySelectorAll("pre code .line")];
          if (gutter.length === 0 || lines.length !== gutter.length) return [];
          const off = gutter.map(
            (row, index) =>
              row.getBoundingClientRect().top - (lines[index]?.getBoundingClientRect().top ?? 0)
          );
          const worst = Math.max(...off.map(value => Math.abs(value)));
          return worst > 2 ? [`${figure.textContent?.slice(0, 30)}: ${worst}px`] : [];
        })
      );
    expect(drift).toEqual([]);
  });

  test("the landing's console and the layers code keep the phone sizes", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the phone scale");
    await boot(page, "/");
    expect(await fontSize(page.locator('[data-component="hero"] [data-part="console"]'))).toBe(
      11.5
    );
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("text-size-adjust")
      )
    ).toBe("100%");
  });
});

test.describe("Sora headings", () => {
  // Bug: the face is renamed in one place and headings silently fall back to system-ui.
  for (const screen of [SITE_SCREENS[0], SITE_SCREENS[1], SITE_SCREENS[4]]) {
    test(`${screen?.path}: the h1 is set in Sora, loaded from the site`, async ({ page }) => {
      await boot(page, screen?.path ?? "/", { static: screen?.static ?? false });
      const family = await page
        .locator("h1")
        .first()
        .evaluate(element => getComputedStyle(element).fontFamily);
      expect(family.split(",")[0]?.trim().replaceAll('"', "")).toBe("Sora");
      const faces = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].map(face => `${face.family}:${face.status}`);
      });
      expect(faces.map(face => face.replaceAll('"', ""))).toContain("Sora:loaded");
      expect(faces.join(" ")).not.toContain("Unbounded");
    });
  }

  test("the font and its licence are served, and the head preloads it", async ({
    page,
    request
  }) => {
    await boot(page, "/");
    const font = "/fonts/sora/sora-latin-wght-normal.woff2";
    await expect(page.locator(`head link[rel="preload"][as="font"][href="${font}"]`)).toHaveCount(
      1
    );
    const response = await request.get(font);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/woff2|font/);
    const licence = await request.get("/fonts/sora/OFL.txt");
    expect(licence.status()).toBe(200);
  });
});

test.describe("favicon", () => {
  // Bug: the static 404 page or a client navigation drops the icons.
  for (const screen of SITE_SCREENS) {
    test(`${screen.path}: the three icon links`, async ({ page }) => {
      await boot(page, screen.path, { static: screen.static ?? false });
      const head = page.locator("head");
      await expect(head.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
        "href",
        "/favicon.svg"
      );
      await expect(head.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute(
        "href",
        "/favicon-32.png"
      );
      await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
        "href",
        "/apple-touch-icon.png"
      );
    });
  }

  test("a client navigation keeps one of each", async ({ page }) => {
    await boot(page, "/");
    await page.locator('main a[href="/docs/"]').first().click();
    await expect(page).toHaveURL(/\/docs\/$/);
    await expect(page.locator('head link[rel="icon"]')).toHaveCount(2);
    await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  test("the files are served at their stated sizes", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "files, one check");
    const svg = await request.get("/favicon.svg");
    expect(svg.status()).toBe(200);
    expect(svg.headers()["content-type"]).toContain("image/svg+xml");
    expect(await svg.text()).toContain("<polygon");
    for (const [path, size] of [
      ["/favicon-32.png", 32],
      ["/apple-touch-icon.png", 180]
    ] as const) {
      const png = await request.get(path);
      expect(png.status(), path).toBe(200);
      expect(png.headers()["content-type"], path).toContain("image/png");
      const bytes = await png.body();
      expect(bytes.readUInt32BE(16), `${path} width`).toBe(size);
      expect(bytes.readUInt32BE(20), `${path} height`).toBe(size);
    }
  });
});

test.describe("Moku brand", () => {
  // Bug: the brand changes in the components, and the static 404 copy keeps the old name.
  for (const screen of SITE_SCREENS) {
    test(`${screen.path}: header and footer say Moku`, async ({ page }) => {
      await boot(page, screen.path, { static: screen.static ?? false });
      const headerLogo = page.locator('[data-component="site-header"] [data-part="logo"]');
      await expect(headerLogo).toBeVisible();
      await expect(headerLogo).toHaveText("Moku");
      await expect(headerLogo).toHaveAccessibleName("Moku Labs home");
      await expect(headerLogo).toHaveAttribute("href", "/");
      const footerLogo = page.locator('[data-component="site-footer"] [data-part="logo"]');
      await expect(footerLogo).toHaveText("Moku");
      await expect(footerLogo).toHaveAttribute("href", "/");
      await expect(page.locator('[data-component="site-footer"]')).toContainText(
        "Moku Labs builds Moku"
      );
    });
  }

  test("the logos lead home from a docs page", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, RICH_DOC);
    await press(page.locator('[data-component="site-footer"] [data-part="logo"]'), phone);
    await expect(page).toHaveURL(url => url.pathname === "/");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${RICH_DOC}$`));
    await press(page.locator('[data-component="site-header"] [data-part="logo"]'), phone);
    await expect(page).toHaveURL(url => url.pathname === "/");
  });
});

test.describe("demo stacks and filter chips", () => {
  /** The packages a demo can be filtered by, from the data file. */
  const FILTERS = packages.filter(entry => entry.group !== "Start" && entry.group !== "Core");

  // Bug: a card shows a stale stack, the chips drift from the data, or a chip leads nowhere.
  test("every card shows its stack in order, each chip with its icon and docs link", async ({
    page
  }) => {
    await boot(page, "/demos/");
    for (const demo of demos) {
      const chips = page.locator(`[id="${demo.id}"] [data-part="chips"] a`);
      await expect(chips).toHaveText([...demo.stack]);
      for (const [index, id] of demo.stack.entries()) {
        await expect(chips.nth(index)).toHaveAttribute("href", `/docs/${id}/`);
        await expect(chips.nth(index).locator("img, svg").first()).toBeVisible();
      }
    }
  });

  test("a stack chip opens its package's docs", async ({ page }, testInfo) => {
    await boot(page, "/demos/");
    await press(
      page.locator('[id="trivia"] [data-part="chips"] a[href="/docs/room/"]'),
      isPhone(testInfo.project.name)
    );
    await expect(page).toHaveURL(/\/docs\/room\/$/);
    await expect(page.locator("h1").first()).toHaveText("@moku-labs/room");
  });

  // Bug: a chip shows no card and no way back, or two chips stay pressed at once.
  test("every filter chip shows exactly the demos on that package, and is the only one pressed", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/demos/");
    const chips = page.locator('[data-part="filters"] [data-filter]');
    await expect(chips).toHaveCount(FILTERS.length + 1);
    for (const entry of FILTERS) {
      const expected = demos.filter(demo => demo.stack.includes(entry.id)).map(demo => demo.id);
      expect(expected.length, `${entry.id} has a demo`).toBeGreaterThan(0);
      await press(page.locator(`[data-part="filters"] [data-filter="${entry.id}"]`), phone);
      const shown = await page
        .locator("[data-demo]")
        .evaluateAll(cards =>
          cards.filter(card => !(card as HTMLElement).hidden).map(card => card.id)
        );
      expect(shown, entry.id).toEqual(expected);
      await expect(page.locator('[data-part="filters"] [aria-pressed="true"]')).toHaveCount(1);
      await expect(page.locator(`[data-filter="${entry.id}"]`)).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    }
  });

  // Every package has a demo now, so the page ships no empty state. See the known dead golden.
  test("no filter can reach an empty state", async ({ page }) => {
    await boot(page, "/demos/");
    await expect(page.locator("[data-empty-for]")).toHaveCount(0);
    await expect(page.locator('[data-part="head"] p')).toContainText("Six apps on Moku");
    await expect(page.locator('[data-part="filters"] [data-filter="all"]')).toHaveText("All six");
  });

  // Bug: a brick or a search result links to a card that lands under the sticky header, or unmarked.
  test("a deep link to a card lands under the header and flashes it", async ({ page }) => {
    await boot(page, "/demos/#trivia");
    const card = page.locator('[id="trivia"]');
    await expect(card).toBeInViewport();
    const top = await card.evaluate(element => element.getBoundingClientRect().top);
    const bottom = await page
      .locator('[data-component="site-header"]')
      .evaluate(element => element.getBoundingClientRect().bottom);
    expect(top).toBeGreaterThanOrEqual(bottom);
    expect(await card.evaluate(element => element.matches(":target"))).toBe(true);
    await expect(card).not.toHaveCSS("box-shadow", "none");
  });
});

test.describe("pyramid bricks", () => {
  /** The ids of the middle row: every package but the plugin and the kernel. */
  const MIDDLE = packages
    .filter(entry => entry.id !== "claude" && entry.id !== "core")
    .map(entry => entry.id);

  // Bug: the plugin's brick comes back, a package goes missing, or a row takes another tone.
  test("one kernel, ten packages, six demos, each in its tone", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const svg = drawing(page, phone);
    await expect(svg).toHaveAttribute("aria-label", /ten packages, six demo apps/);
    expect(MIDDLE).toHaveLength(10);
    await expect(svg.locator('[data-kind="core"][data-tone="kernel"]')).toHaveCount(1);
    await expect(svg.locator('[data-kind="package"][data-tone="plugin"]')).toHaveCount(10);
    await expect(svg.locator('[data-kind="demo"][data-tone="terrace-2"]')).toHaveCount(
      demos.length
    );
    await expect(svg.locator('[data-brick][data-id="claude"]')).toHaveCount(0);
    const ids = await svg
      .locator('[data-kind="package"]')
      .evaluateAll(all => all.map(brick => (brick as SVGElement).dataset.id));
    expect(ids.toSorted()).toEqual(MIDDLE.toSorted());
    await expect(svg.locator('[data-kind="core"] text')).toHaveText("@moku-labs/core");
    for (const demo of demos) {
      await expect(svg.locator(`[data-kind="demo"][data-id="${demo.id}"] text`)).toHaveText(
        demo.name
      );
    }
  });

  // Bug: reversing the bricks drew each row right to left, so a brick's side face lay over its right
  // neighbour's front. Both the document order and what is really on top at a shared point.
  test("the base paints first, each row left to right, each right neighbour on top", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const svg = drawing(page, phone);
    await svg.evaluate(element => element.scrollIntoView({ block: "center" }));
    await scrollTo(page, svg);
    const bricks = await svg.evaluate(element => {
      const root = element as SVGSVGElement;
      return [...root.querySelectorAll<SVGGElement>("[data-brick]")].map(brick => {
        const corner = brick
          .querySelector<SVGPolygonElement>('[data-face="left"]')
          ?.points.getItem(0) ?? { x: 0, y: 0 };
        // A point of this brick's front that its left neighbour's side face reaches over.
        const point = new DOMPoint(corner.x + 3, corner.y + 15).matrixTransform(
          root.getScreenCTM() ?? undefined
        );
        const top = document
          .elementFromPoint(point.x, point.y)
          ?.closest<SVGGElement>("[data-brick]");
        return { id: brick.dataset.id ?? "", x: corner.x, y: corner.y, top: top?.dataset.id };
      });
    });
    const problems = bricks.flatMap((right, index) => {
      const left = bricks[index - 1];
      if (left === undefined) return [];
      if (right.y > left.y) return [`${right.id} (lower row) paints after ${left.id}`];
      if (right.y !== left.y) return [];
      if (right.x <= left.x) return [`${right.id} paints after ${left.id}, to its left`];
      return right.top === right.id ? [] : [`${left.id}/${right.id}: ${right.top} on top`];
    });
    expect(problems).toEqual([]);
  });

  // Bug: a label runs off its brick at the narrowest phone, or a stale fill makes it unreadable.
  test("every label fits its brick's front, in the drawing on show", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    for (const width of phone ? [320, 390, 430] : [1440, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      const misses = await drawing(page, phone)
        .locator("[data-brick]")
        .evaluateAll(bricks =>
          bricks.flatMap(brick => {
            const text = brick.querySelector("text")?.getBoundingClientRect();
            const front = brick.querySelector('[data-face="left"]')?.getBoundingClientRect();
            if (text === undefined || front === undefined) return ["no label"];
            const fits = text.left >= front.left - 0.5 && text.right <= front.right + 0.5;
            return fits ? [] : [`${brick.textContent}: ${text.width} in ${front.width}`];
          })
        );
      expect(misses, `${width}px`).toEqual([]);
    }
  });

  // Bug: the bricks took the plugin tone and the label or the legend kept the old one.
  for (const theme of ["dark", "light"] as const) {
    test(`${theme}: labels read on their bricks, and the legend matches the bricks`, async ({
      page
    }, testInfo) => {
      const phone = isPhone(testInfo.project.name);
      await boot(page, `/?theme=${theme}`);
      const svg = drawing(page, phone);
      const report = await svg.evaluate(element => {
        const context = document.createElement("canvas").getContext("2d", {
          willReadFrequently: true
        });
        const toRgb = (color: string): number[] => {
          if (context === null) return [0, 0, 0];
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const luminance = (color: string) => {
          const [r = 0, g = 0, b = 0] = toRgb(color).map(value => {
            const part = value / 255;
            return part <= 0.04 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (first: string, second: string) => {
          const [low, high] = [luminance(first), luminance(second)].toSorted((a, b) => a - b);
          return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
        };
        const styleOf = getComputedStyle;
        const fillOf = (node: Element | null | undefined) =>
          node ? styleOf(node).fill : "transparent";
        const ratios = Object.fromEntries(
          ["core", "package", "demo"].map(kind => {
            const brick = element.querySelector(`[data-kind="${kind}"]`);
            const face = brick?.querySelector('[data-face="left"]');
            return [kind, ratio(fillOf(brick?.querySelector("text")), fillOf(face))];
          })
        );
        const pyramid = element.closest('[data-component="pyramid"]');
        const swatch = (name: string) => pyramid?.querySelector(`[data-swatch="${name}"]`);
        const background = (node: Element | null | undefined) =>
          node ? styleOf(node).backgroundColor : "";
        const face = (kind: string, part: string) =>
          fillOf(element.querySelector(`[data-kind="${kind}"] [data-face="${part}"]`));
        return {
          ratios,
          legend: {
            package: [background(swatch("package")), face("package", "left")],
            demo: [background(swatch("demo")), face("demo", "left")],
            kernel: [background(swatch("kernel")), face("core", "top")]
          }
        };
      });
      for (const [kind, value] of Object.entries(report.ratios)) {
        expect(value, `${kind} label contrast`).toBeGreaterThanOrEqual(4.5);
      }
      for (const [name, [swatch, face]] of Object.entries(report.legend)) {
        expect(swatch, `${name} swatch`).toBe(face);
      }
    });
  }

  // Bug: a stack edit leaves the relations stale: the demo lights another package, or a package
  // lights a demo that no longer uses it.
  test("each brick lights exactly what the data says", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "hover");
    await boot(page, "/");
    const wide = drawing(page, false);
    await scrollTo(page, wide);
    const lit = () =>
      wide
        .locator("[data-related]")
        .evaluateAll(all =>
          all.map(
            brick => `${(brick as SVGElement).dataset.kind}:${(brick as SVGElement).dataset.id}`
          )
        );
    for (const demo of demos) {
      await wide.locator(`[data-kind="demo"][data-id="${demo.id}"]`).hover();
      await expect
        .poll(lit, demo.id)
        .toEqual(expect.arrayContaining([...demo.stack.map(id => `package:${id}`), "core:core"]));
      const shown = await lit();
      expect(shown.toSorted(), demo.id).toEqual(
        [...demo.stack.map(id => `package:${id}`), "core:core"].toSorted()
      );
    }
    for (const id of MIDDLE) {
      await wide.locator(`[data-kind="package"][data-id="${id}"]`).hover();
      const users = demos.filter(demo => demo.stack.includes(id)).map(demo => `demo:${demo.id}`);
      await expect.poll(lit, id).toEqual(expect.arrayContaining([...users, "core:core"]));
      const shown = await lit();
      expect(shown.toSorted(), id).toEqual([...users, "core:core"].toSorted());
    }
  });

  // Bug: a brick's link goes nowhere: the pyramid navigates from a data attribute, so the link
  // check of the rest of the site cannot see it.
  test("every brick leads somewhere real, and its tip says who uses it", async ({
    page,
    request
  }, testInfo) => {
    await boot(page, "/");
    const bricks = await drawing(page, isPhone(testInfo.project.name))
      .locator("[data-brick]")
      .evaluateAll(all =>
        all.map(brick => {
          const data = (brick as SVGElement).dataset;
          return { id: data.id, kind: data.kind, href: data.href ?? "", action: data.tipAction };
        })
      );
    expect(bricks).toHaveLength(1 + MIDDLE.length + demos.length);
    const demosResponse = await request.get("/demos/");
    const demosPage = await demosResponse.text();
    for (const brick of bricks) {
      const [path, fragment] = brick.href.split("#");
      const target = await request.get(path ?? "");
      expect(target.status(), brick.href).toBe(200);
      if (fragment !== undefined) expect(demosPage, brick.href).toContain(`id="${fragment}"`);
      if (brick.kind === "package") expect(brick.action, brick.id).toMatch(/^Used by /);
      if (brick.kind === "demo") {
        const stack = demos.find(demo => demo.id === brick.id)?.stack.join(", ");
        expect(brick.action, brick.id).toContain(`Built on ${stack}`);
      }
    }
  });
});

test.describe("docs sidebar and table of contents", () => {
  // Bug: the columns scroll away with the article, or slide under the sticky header.
  test("desktop: both columns stay just under the header while the article scrolls", async ({
    page
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the side columns");
    await boot(page, RICH_DOC);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(1500);
    const bottom = await page
      .locator('[data-component="site-header"]')
      .evaluate(element => element.getBoundingClientRect().bottom);
    for (const column of [sidebar(page), toc(page)]) {
      const top = await column.evaluate(element => element.getBoundingClientRect().top);
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
      await expect(column).toBeInViewport();
    }
  });

  // Bug: a page's h3 is left out of the TOC, a link is stale, or the swap keeps the old page's list.
  for (const path of [RICH_DOC, "/docs/game/plugins/flow/", "/docs/ai/plugins/ark/"]) {
    test(`${path}: the TOC lists the article's h2 and h3 in order, loaded directly`, async ({
      page
    }, testInfo) => {
      test.skip(isPhone(testInfo.project.name), "the side column");
      await boot(page, path);
      const items = await tocItems(page);
      expect(items.length).toBeGreaterThan(1);
      expect(items).toEqual(await articleHeadings(page));
    });
  }

  test("a sidebar link swaps the TOC to the new page and marks its first heading", async ({
    page
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the side column");
    await boot(page, "/docs/game/quick-start/");
    await sidebar(page).locator('nav a[href="/docs/game/plugins/flow/"]').click();
    await expect(page).toHaveURL(/\/docs\/game\/plugins\/flow\/$/);
    await expect(sidebar(page).locator('a[aria-current="page"]')).toHaveAttribute(
      "href",
      "/docs/game/plugins/flow/"
    );
    await expect(toc(page).locator('a[href="#gate-inbox-fx-features"]')).toBeAttached();
    const items = await tocItems(page);
    expect(items).toEqual(await articleHeadings(page));
    await expect(toc(page).locator("ul a[data-current]")).toHaveCount(1);
    await expect(toc(page).locator("ul a").first()).toHaveAttribute("data-current", "");
    const indent = async (depth: number) =>
      toc(page)
        .locator(`li[data-depth="${depth}"] a`)
        .first()
        .evaluate(link => Number.parseFloat(getComputedStyle(link).paddingLeft));
    expect(await indent(3)).toBeGreaterThan(await indent(2));
  });

  // Bug: the spy follows clicks only, loses a deep link, or never reaches the last section.
  test("the spy follows the scroll, a deep link and the last heading", async ({
    page
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the side column");
    await boot(page, `${RICH_DOC}#links`);
    await expect(toc(page).locator('a[href="#links"]')).toHaveAttribute("data-current", "");
    await expect(toc(page).locator("ul a[data-current]")).toHaveCount(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(toc(page).locator("ul a").first()).toHaveAttribute("data-current", "");
    const middle = toc(page).locator("ul a").nth(2);
    const id = ((await middle.getAttribute("href")) ?? "").slice(1);
    await page.locator(`[id="${id}"]`).evaluate(element => element.scrollIntoView());
    await expect(middle).toHaveAttribute("data-current", "");
    const last = toc(page).locator("ul a").last();
    await last.click();
    const lastId = ((await last.getAttribute("href")) ?? "").slice(1);
    await expect(page.locator(`[id="${lastId}"]`)).toBeInViewport();
    await expect(last).toHaveAttribute("data-current", "");
  });

  // Bug: the switcher starts open and pushes the pages down, or marks no current package.
  test("the package switcher starts closed and marks the current package", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, RICH_DOC);
    if (phone) await press(sidebar(page).locator(":scope > summary"), true);
    const switcher = sidebar(page).locator('[data-part="switcher"]');
    await expect(switcher.locator("ul")).toBeHidden();
    await expect(switcher.locator("summary b")).toHaveText("@moku-labs/web");
    await expect(switcher.locator("summary small")).toHaveText(/\d+\.\d+\.\d+/);
    await press(switcher.locator(":scope > summary"), phone);
    await expect(switcher.locator('ul a[aria-current="true"]')).toHaveCount(1);
    await expect(switcher.locator('ul a[aria-current="true"]')).toHaveAttribute(
      "href",
      "/docs/web/"
    );
    await press(switcher.locator(":scope > summary"), phone);
    await expect(switcher.locator("ul")).toBeHidden();
  });

  test("phone: the sidebar is in the flow, its chevron turns, the inline TOC lists every heading", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the phone layout");
    await boot(page, RICH_DOC);
    await expect(sidebar(page)).toHaveCSS("position", "static");
    const chevron = sidebar(page).locator(':scope > summary [data-part="chevron"]');
    const closed = await chevron.evaluate(element => getComputedStyle(element).transform);
    await press(sidebar(page).locator(":scope > summary"), true);
    await expect
      .poll(() => chevron.evaluate(element => getComputedStyle(element).transform))
      .not.toBe(closed);
    await press(sidebar(page).locator(":scope > summary"), true);
    const inline = page.locator('[data-component="docs-toc-inline"]');
    await press(inline.locator("summary"), true);
    const items = await inline.locator("li").evaluateAll(all =>
      all.map(item => {
        const href = item.querySelector("a")?.getAttribute("href")?.slice(1) ?? "";
        return `${decodeURIComponent(href)}:${(item as HTMLElement).dataset.depth}`;
      })
    );
    expect(items).toEqual(await articleHeadings(page));
    const heights = await inline
      .locator("a")
      .evaluateAll(all => all.map(link => link.getBoundingClientRect().height));
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(40);
  });

  // Open finding, reported and not fixed: the sidebar's own scroll goes back to the top on every
  // page, so the page you just opened is marked below the fold. A fix adds an island and moves the
  // sidebar in the desktop goldens, and this run updates no golden. Drop the fixme with the fix.
  test.fixme("desktop: the current page's link is in the sidebar's view", async ({
    page
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the side column");
    const inView = () =>
      sidebar(page).evaluate(element => {
        const link = element.querySelector('nav > div a[aria-current="page"]');
        if (link === null) return false;
        const box = element.getBoundingClientRect();
        const row = link.getBoundingClientRect();
        return row.top >= box.top && row.bottom <= box.bottom;
      });
    await boot(page, "/docs/ai/quick-start/");
    const links = sidebar(page).locator('nav > [data-part="group"] a');
    const lowest = (await links.nth((await links.count()) - 3).getAttribute("href")) ?? "";
    expect(
      await sidebar(page).evaluate(element => element.scrollHeight > element.clientHeight),
      "the sidebar is long enough to scroll"
    ).toBe(true);
    const link = sidebar(page).locator(`nav a[href="${lowest}"]`);
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${lowest}$`));
    await expect(sidebar(page).locator('a[aria-current="page"]')).toHaveAttribute("href", lowest);
    expect(await inView(), "after a click").toBe(true);
    await boot(page, lowest);
    expect(await inView(), "direct load").toBe(true);
  });
});

test.describe("a link to a fragment of another page", () => {
  // Bug: the SPA scrolls every forward navigation to the top, so the link lands on the page's start.
  test("the header's Packages link lands on the packages from another page", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/");
    if (phone) await press(page.locator('[data-part="burger"]'), true);
    await press(page.locator('#site-menu a[data-nav="packages"]'), phone);
    await expect(page).toHaveURL(url => url.pathname === "/" && url.hash === "#packages");
    await expectLanded(page, "#packages");
    await expect(page.locator("h1").first()).toHaveText(SITE_SCREENS[0]?.title ?? "");
  });

  test("the footer's Packages link does too", async ({ page }, testInfo) => {
    await boot(page, "/about/");
    await press(
      page.locator('[data-component="site-footer"] a[href="/#packages"]'),
      isPhone(testInfo.project.name)
    );
    await expect(page).toHaveURL(url => url.pathname === "/" && url.hash === "#packages");
    await expectLanded(page, "#packages");
  });

  test("a docs link lands on its heading, and Back returns to its page", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/web/plugins/router/");
    const link = page.locator('[data-content] a[href="/docs/web/guides/routing/#builder-methods"]');
    await link.first().scrollIntoViewIfNeeded();
    await press(link.first(), phone);
    await expect(page).toHaveURL(/\/routing\/#builder-methods$/);
    await expectLanded(page, '[data-content] [id="builder-methods"]');
    await page.goBack();
    await expect(page).toHaveURL(/\/plugins\/router\/$/);
    await expect(page.locator("h1").first()).toContainText("router");
  });

  test.describe("with motion", () => {
    test.use({ reducedMotion: "no-preference" });

    // Bug: with a view transition the swap runs late, and the landing runs before the page is in.
    test("a link lands on its target through the view transition too", async ({
      page
    }, testInfo) => {
      const phone = isPhone(testInfo.project.name);
      await boot(page, "/about/");
      await press(page.locator('[data-component="site-footer"] a[href="/#packages"]'), phone);
      await expect(page).toHaveURL(url => url.pathname === "/" && url.hash === "#packages");
      await expectLanded(page, "#packages");
    });
  });

  // Bug: the pyramid navigates with the fragment in the path: no route matches it, so the page opens
  // at the top with no link of the header marked.
  test("a demo brick lands on its card and keeps the header's Demos marked", async ({
    page
  }, testInfo) => {
    test.skip(
      isPhone(testInfo.project.name),
      "one tap shows the tip; the phone gesture is in home"
    );
    await boot(page, "/");
    const brick = page.locator('svg[data-layout="wide"] [data-brick][data-id="trivia"]');
    await scrollTo(page, brick);
    await brick.click();
    await expect(page).toHaveURL(/\/demos\/#trivia$/);
    await expectLanded(page, '[id="trivia"]');
    await expect(page.locator('#site-menu a[data-nav="demos"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
