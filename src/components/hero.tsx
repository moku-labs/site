/**
 * @file The landing hero (A1, §7): headline, the isometric world, kernel.log and the plugin tray.
 * Rendered at build in its first-paint state; the `kernel-world` island makes it playable.
 */
import type { VNode } from "preact";
import type { TrayPlugin } from "../data/tray";
import type { HeroView, HomePackage } from "../lib/home-data";
import type { HeroState } from "../lib/kernel-tray";
import { appLine, seedHeroState, trayNote, visibleLog } from "../lib/kernel-tray";
import type { UrlBuilder } from "../lib/url-builder";
import { CubeIcon } from "./cube-icon";
import { KernelWorld } from "./kernel-world";
import { WorldTip } from "./world-tip";

/** Props of {@link Hero}. */
type HeroProperties = {
  /** The tray, its kernel messages and the kernel version. */
  hero: HeroView;
  /** The family, in family order. */
  packages: readonly HomePackage[];
  /** Route link builder. */
  url: UrlBuilder;
};

/** Length of `createApp` in the live line; the rest is the argument list the island rewrites. */
const CALL = "createApp";

/**
 * kernel.log: the live `createApp` line, the last six log lines and Reset.
 *
 * @param props - Component props.
 * @param props.state - The hero state.
 * @param props.tray - The tray.
 * @returns The console.
 */
function KernelLog(props: { state: HeroState; tray: readonly TrayPlugin[] }): VNode {
  const line = appLine(props.state.accepted, props.tray);
  return (
    <div data-part="console">
      <div data-part="console-bar">
        <span>kernel.log</span>
        <button type="button" data-part="reset">
          Reset
        </button>
      </div>
      <code data-part="app-line">
        <span data-token="function">{CALL}</span>
        <span data-part="app-arguments">{line.slice(CALL.length)}</span>
      </code>
      <ol data-part="log" aria-live="polite">
        {visibleLog(props.state.log).map((entry, index) => (
          <li key={index} data-kind={entry.kind}>
            {entry.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One tray button: the plugin cube, its name and its note or verdict.
 *
 * @param props - Component props.
 * @param props.item - The tray plugin.
 * @param props.state - The hero state.
 * @returns The `<li>`.
 */
function TrayButton(props: { item: TrayPlugin; state: HeroState }): VNode {
  const { item } = props;
  const verdict = props.state.verdicts[item.id];
  return (
    <li>
      <button
        type="button"
        data-part="plug"
        data-plug={item.id}
        data-state={verdict?.state}
        disabled={verdict?.state === "locked"}
        aria-label={`Plug ${item.plugin} into the kernel`}
      >
        <CubeIcon tone="block" glyph={item.glyph} size={36} />
        <b>{item.plugin}</b>
        <small>{trayNote(item, verdict)}</small>
      </button>
    </li>
  );
}

/**
 * The hero section. Its `data-props` carry the tray and the kernel's captured messages (D9), so
 * the island judges plugins with the real kernel's words.
 *
 * @param props - Component props.
 * @returns The `<section data-component="hero" data-island="kernel-world">`.
 * @example
 * ```tsx
 * <Hero hero={view.hero} packages={view.packages} url={url} />
 * ```
 */
export function Hero(props: HeroProperties): VNode {
  const { hero, url } = props;
  const state = seedHeroState(hero.tray, hero.messages, hero.seed);
  const accepted = state.accepted.flatMap(id => hero.tray.filter(item => item.id === id));
  const islandData = { tray: hero.tray, messages: hero.messages, seed: hero.seed };
  return (
    <section
      data-component="hero"
      data-island="kernel-world"
      data-props={JSON.stringify(islandData)}
      aria-label="Moku in one interaction"
    >
      <div data-part="intro">
        <h1>Slop doesn't spread.</h1>
        <p data-part="sub">Your LLM writes the plugins. The kernel reads them first.</p>
        <p data-part="how">
          <strong>Try it:</strong> drag a plugin from the tray onto the pink cube, or click one.
          Good ones lock in. Bad ones fall off.
        </p>
        <div data-part="actions">
          <a data-component="button" data-variant="primary" href={url("docsHub")}>
            Read the docs
          </a>
          <a data-component="button" data-variant="ghost" href={`${url("home")}#start`}>
            Start with Claude
          </a>
        </div>
      </div>
      <div data-part="stage">
        <div data-part="world-frame">
          <KernelWorld
            packages={props.packages}
            accepted={accepted}
            kernelVersion={hero.kernelVersion}
            url={url}
          />
        </div>
        <KernelLog state={state} tray={hero.tray} />
      </div>
      <div data-part="tray">
        <p data-part="tray-head">
          <span>Six plugins your LLM just wrote</span>
          <span data-part="hint">drag to the pink cube, or click</span>
        </p>
        <ul>
          {hero.tray.map(item => (
            <TrayButton key={item.id} item={item} state={state} />
          ))}
        </ul>
      </div>
      <WorldTip />
      <div data-part="flyer" aria-hidden="true" hidden>
        <CubeIcon tone="block" glyph="plug" size={48} />
        <span />
      </div>
    </section>
  );
}
