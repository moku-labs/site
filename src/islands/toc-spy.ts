/**
 * @file The `toc-spy` island: marks the "On this page" link of the section in view.
 */
import { createIsland } from "@moku-labs/web/browser";

/** The band of the viewport that decides the current section: under the header, top third. */
const SPY_MARGIN = "-80px 0px -65% 0px";

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
 * Watches the article's h2/h3 headings and marks the matching TOC link. The first heading is
 * current until another one scrolls into the band.
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
    const first = headings[0];
    if (first === undefined) return;
    markCurrent(links, first.id);
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) if (entry.isIntersecting) markCurrent(links, entry.target.id);
      },
      { rootMargin: SPY_MARGIN }
    );
    for (const heading of headings) observer.observe(heading);
    ctx.cleanup(() => observer.disconnect());
  }
});
