/**
 * @file The `toc-spy` island: marks the "On this page" link of the section in view.
 */
import { createIsland } from "@moku-labs/web/browser";

/** A section is current from the moment its heading passes this part of the viewport's height. */
const SPY_LINE = 0.35;

/** How close to the end of the page counts as the end, px. */
const PAGE_END_SLACK = 2;

/**
 * Mark one TOC link as current and clear the others.
 *
 * @param links - The TOC links by heading id.
 * @param id - The heading in view.
 */
function markCurrent(links: ReadonlyMap<string, HTMLElement>, id: string): void {
  for (const [linkId, link] of links) {
    if (linkId === id) link.dataset.current = "";
    else delete link.dataset.current;
  }
}

/**
 * The heading of the section in view: the last one above the line, the first one above them all,
 * and at the end of the page the last one, which a short last section never lifts to the line.
 *
 * @param headings - The headings, in document order.
 * @returns The current heading.
 */
function currentHeading(headings: readonly Element[]): Element | undefined {
  const { scrollHeight } = document.documentElement;
  if (scrollY > 0 && scrollY + innerHeight >= scrollHeight - PAGE_END_SLACK) return headings.at(-1);
  const line = innerHeight * SPY_LINE;
  return headings.findLast(heading => heading.getBoundingClientRect().top <= line) ?? headings[0];
}

/**
 * Watches the article's h2/h3 headings and marks the matching TOC link, once per frame of a scroll.
 * The first heading is current until another one reaches the line.
 */
export const tocSpyIsland = createIsland("toc-spy", {
  onMount: ctx => {
    const links = new Map<string, HTMLElement>();
    for (const link of ctx.el.querySelectorAll<HTMLElement>('a[href^="#"]')) {
      links.set(decodeURIComponent(link.getAttribute("href")?.slice(1) ?? ""), link);
    }
    const headings = [...document.querySelectorAll("[data-content] :is(h2, h3)[id]")].filter(
      heading => links.has(heading.id)
    );
    if (headings.length === 0) return;

    // Read the layout at most once a frame, however often the page scrolls.
    let frame: number | undefined;
    const mark = (): void => {
      frame = undefined;
      const current = currentHeading(headings);
      if (current !== undefined) markCurrent(links, current.id);
    };
    const onScroll = (): void => {
      frame ??= requestAnimationFrame(mark);
    };

    mark();
    addEventListener("scroll", onScroll, { passive: true });
    ctx.cleanup(() => {
      removeEventListener("scroll", onScroll);
      if (frame !== undefined) cancelAnimationFrame(frame);
    });
  }
});
