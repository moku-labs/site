import { describe, expect, it, vi } from "vitest";
import {
  createLinkWarmer,
  isEagerAllowed,
  type LinkLike,
  prefetchPath
} from "../../../src/lib/link-prefetch";

const HERE = "https://moku-labs.com/docs/web/quick-start/";

/**
 * A link with the given attributes.
 *
 * @param attributes - Attribute values by name.
 * @returns The link.
 */
function link(attributes: Record<string, string>): LinkLike {
  return {
    getAttribute: name => attributes[name],
    hasAttribute: name => Object.hasOwn(attributes, name)
  };
}

describe("prefetchPath", () => {
  // Bug: a page link of the site is not warmed, or a relative href resolves to the wrong path.
  it("returns the path of a page on this site, relative hrefs resolved", () => {
    expect(prefetchPath(link({ href: "/docs/web/routing/" }), HERE)).toBe("/docs/web/routing/");
    expect(prefetchPath(link({ href: "../how-it-works/" }), HERE)).toBe("/docs/web/how-it-works/");
    expect(prefetchPath(link({ href: "/demos/?tag=web#top" }), HERE)).toBe("/demos/");
  });

  // Bug: data is fetched for pages the SPA never handles: another site, a new tab, a download,
  // a file, or the page already shown.
  it("skips links the SPA does not open in place", () => {
    const skipped = [
      { href: "https://github.com/moku-labs" },
      { href: "/docs/", target: "_blank" },
      { href: "/docs/", download: "" },
      { href: "/llms.txt" },
      { href: "/docs/web/quick-start.md" },
      { href: "#install" },
      { href: "" },
      {}
    ];

    for (const attributes of skipped) expect(prefetchPath(link(attributes), HERE)).toBeUndefined();
  });

  // Bug: an explicit same-tab target is treated as a new tab.
  it("warms a link whose target is _self or empty", () => {
    expect(prefetchPath(link({ href: "/about/", target: "_self" }), HERE)).toBe("/about/");
    expect(prefetchPath(link({ href: "/about/", target: "" }), HERE)).toBe("/about/");
  });
});

describe("isEagerAllowed", () => {
  // Bug: links in view are warmed for a reader on save-data or 2g, or never warmed at all.
  it("allows eager warming unless save-data or a 2g connection", () => {
    expect(isEagerAllowed(undefined)).toBe(true);
    expect(isEagerAllowed({ effectiveType: "4g" })).toBe(true);
    expect(isEagerAllowed({ effectiveType: "3g" })).toBe(true);
    expect(isEagerAllowed({ saveData: true, effectiveType: "4g" })).toBe(false);
    expect(isEagerAllowed({ effectiveType: "2g" })).toBe(false);
    expect(isEagerAllowed({ effectiveType: "slow-2g" })).toBe(false);
  });
});

describe("createLinkWarmer", () => {
  // Bug: the same page is fetched again on every hover.
  it("warms each path once", () => {
    const warm = vi.fn();
    const warmer = createLinkWarmer({ warm, here: () => HERE, viewportBudget: 2 });

    expect(warmer.warm(link({ href: "/about/" }))).toBe(true);
    expect(warmer.warm(link({ href: "/about/" }))).toBe(false);
    expect(warmer.warm(link({ href: "/llms.txt" }))).toBe(false);
    expect(warm.mock.calls).toEqual([["/about/"]]);
  });

  // Bug: a long page warms every link it shows; or the budget never refills after navigation.
  it("warms links in view up to the budget per page", () => {
    const warm = vi.fn();
    const warmer = createLinkWarmer({ warm, here: () => HERE, viewportBudget: 2 });

    expect(warmer.warmVisible(link({ href: "/a/" }))).toBe(true);
    expect(warmer.warmVisible(link({ href: "/a/" }))).toBe(false);
    expect(warmer.isSpent()).toBe(false);
    expect(warmer.warmVisible(link({ href: "/b/" }))).toBe(true);
    expect(warmer.isSpent()).toBe(true);
    expect(warmer.warmVisible(link({ href: "/c/" }))).toBe(false);

    warmer.newPage();

    expect(warmer.isSpent()).toBe(false);
    expect(warmer.warmVisible(link({ href: "/c/" }))).toBe(true);
    expect(warm.mock.calls).toEqual([["/a/"], ["/b/"], ["/c/"]]);
  });

  // Bug: intent warm-ups eat the viewport budget, so links in view stop warming early.
  it("does not count intent warm-ups against the viewport budget", () => {
    const warmer = createLinkWarmer({ warm: vi.fn(), here: () => HERE, viewportBudget: 1 });

    warmer.warm(link({ href: "/a/" }));
    warmer.warm(link({ href: "/b/" }));

    expect(warmer.isSpent()).toBe(false);
  });
});
