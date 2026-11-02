/**
 * @file The demos page (A11, U11): package filter chips, the demo cards and an empty state per
 * package no demo uses. The `demo-filter` island applies the filter.
 */
import type { VNode } from "preact";
import { PackageIcon } from "../components/icons";
import type { DemoEntry } from "../data/demos";
import { demoGaps, demos, demosRepository } from "../data/demos";
import type { PackageEntry } from "../data/packages";
import { packages } from "../data/packages";
import { ALL_DEMOS, demosUsing } from "../lib/demos";
import type { UrlBuilder } from "../lib/url-builder";

/** Small counts in words, for "All six". */
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/**
 * A count in words for small numbers, digits otherwise.
 *
 * @param count - The number.
 * @returns `"six"` for 6, `"12"` for 12.
 */
function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

/** The packages a demo can be filtered by: everything but the Claude plugin and the core. */
const FILTERS: readonly PackageEntry[] = packages.filter(
  entry => entry.group !== "Start" && entry.group !== "Core"
);

/**
 * One demo card: diorama, name, line, stack chips, Live and Source.
 *
 * @param props - Component props.
 * @param props.demo - The demo.
 * @param props.eager - Load the art at once (the first row).
 * @param props.url - Route link builder.
 * @returns The `<article>`.
 */
function DemoCard(props: { demo: DemoEntry; eager: boolean; url: UrlBuilder }): VNode {
  const { demo, url } = props;
  return (
    <article
      id={demo.id}
      data-demo=""
      data-stack={demo.stack.join(" ")}
      tabIndex={-1}
      style={{ "--hue": demo.hue ?? 262 }}
    >
      <div data-part="thumb">
        <img
          src={`/art/demo-${demo.id}-960.webp`}
          srcset={`/art/demo-${demo.id}-960.webp 960w, /art/demo-${demo.id}-1600.webp 1600w`}
          sizes="(max-width: 620px) 100vw, (max-width: 1000px) 50vw, 400px"
          width={960}
          height={640}
          alt={demo.alt ?? ""}
          loading={props.eager ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
      <div data-part="body">
        <h2>{demo.name}</h2>
        <p>{demo.description}</p>
        <div data-part="chips">
          {demo.stack.map(id => (
            <a key={id} data-part="chip" href={url("docsPackage", { pkg: id })}>
              <PackageIcon id={id} size={22} />
              {id}
            </a>
          ))}
        </div>
        <div data-part="links">
          {demo.live === undefined ? (
            <span data-part="soon" aria-disabled="true">
              Live <small>Soon</small>
            </span>
          ) : (
            <a href={demo.live} target="_blank" rel="noopener">
              Live
            </a>
          )}
          <a href={demosRepository} target="_blank" rel="noopener">
            Source
          </a>
        </div>
      </div>
    </article>
  );
}

/**
 * The empty state of a package no demo uses (F7).
 *
 * @param props - Component props.
 * @param props.entry - The package.
 * @returns The hidden empty state; the island shows it for its filter.
 */
function EmptyState(props: { entry: PackageEntry }): VNode {
  const { entry } = props;
  return (
    <div data-part="empty" data-empty-for={entry.id} hidden>
      <PackageIcon id={entry.id} size={80} />
      <div>
        <h2>No demo uses {entry.name} directly yet.</h2>
        <p>{demoGaps[entry.id] ?? demoGaps.default}</p>
        <button type="button" data-component="button" data-variant="ghost" data-filter={ALL_DEMOS}>
          Show all {countWord(demos.length)} demos
        </button>
      </div>
    </div>
  );
}

/**
 * The demos page.
 *
 * @param props - Component props.
 * @param props.url - Route link builder.
 * @returns The page root.
 * @example
 * ```tsx
 * route("/demos/").render(ctx => <DemosPage url={ctx.url} />);
 * ```
 */
export function DemosPage(props: { url: UrlBuilder }): VNode {
  const unused = FILTERS.filter(entry => demosUsing(demos, entry.id).length === 0);
  return (
    <div data-page="demos">
      <div data-component="demos-page" data-island="demo-filter">
        <header data-part="head">
          <h1>Demos</h1>
          <p>
            {countWord(demos.length).replace(/^./, letter => letter.toUpperCase())} apps on Moku. An
            agent wrote most of the code. The kernel read all of it.
          </p>
        </header>
        <fieldset data-part="filters">
          <legend data-visually-hidden>Filter by package</legend>
          <button type="button" data-filter={ALL_DEMOS} aria-pressed="true">
            All {countWord(demos.length)}
          </button>
          {FILTERS.map(entry => (
            <button key={entry.id} type="button" data-filter={entry.id} aria-pressed="false">
              <PackageIcon id={entry.id} size={22} />
              {entry.id}
            </button>
          ))}
        </fieldset>
        <div data-part="grid">
          {demos.map((demo, index) => (
            <DemoCard key={demo.id} demo={demo} eager={index < 3} url={props.url} />
          ))}
          {unused.map(entry => (
            <EmptyState key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
