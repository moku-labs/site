/**
 * @file The landing hero (A1): headline and CTAs, the goal switch (Site, App, Game), the kernel
 * world with its info card, the code card with kernel.log, and the tray of the goal's pieces.
 * Rendered at build in the start state of the first goal, so the first paint explains the idea
 * without JS; the `kernel-world` island makes it playable.
 */
import type { VNode } from "preact";
import type { Goal } from "../data/assembly";
import { assemblyText, layers } from "../data/assembly";
import { initialAssembly } from "../lib/assembly";
import type { HeroPanel } from "../lib/hero-view";
import { heroPanel, worldScene } from "../lib/hero-view";
import type { HeroView } from "../lib/home-data";
import type { UrlBuilder } from "../lib/url-builder";
import { CubeIcon } from "./cube-icon";
import { KernelWorld } from "./kernel-world";

/** Props of {@link Hero}. */
type HeroProperties = {
  /** The goals and the installed versions. */
  hero: HeroView;
  /** Route link builder. */
  url: UrlBuilder;
};

/**
 * The headline, the sub, the Try-it line and the two CTAs.
 *
 * @param props - Component props.
 * @param props.url - Route link builder.
 * @returns The intro block.
 */
function Intro(props: { url: UrlBuilder }): VNode {
  const { url } = props;
  return (
    <div data-part="intro">
      <h1>{assemblyText.headline}</h1>
      <p data-part="sub">{assemblyText.sub}</p>
      <p data-part="how">
        <strong>{assemblyText.tryIt.lead}</strong> {assemblyText.tryIt.text}
      </p>
      <div data-part="actions">
        <a data-component="button" data-variant="primary" href={url("docsHub")}>
          {assemblyText.docsCta}
        </a>
        <a data-component="button" data-variant="ghost" href={`${url("home")}#start`}>
          {assemblyText.claudeCta}
        </a>
      </div>
    </div>
  );
}

/**
 * The goal switch: a radio group of the goals; the island moves it with the arrow keys.
 *
 * @param props - Component props.
 * @param props.goals - The goals in switch order.
 * @param props.current - The goal shown.
 * @returns The radio group.
 */
function GoalSwitch(props: { goals: readonly Goal[]; current: string }): VNode {
  return (
    <div data-part="switch" role="radiogroup" aria-label={assemblyText.goalSwitch}>
      {props.goals.map(goal => {
        const isCurrent = goal.id === props.current;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a segmented switch of buttons; the island gives it radio keys
          <button
            key={goal.id}
            type="button"
            role="radio"
            data-goal={goal.id}
            aria-checked={isCurrent ? "true" : "false"}
            tabIndex={isCurrent ? 0 : -1}
          >
            {goal.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The info card of a cube, socket or chip: empty and hidden; the island fills and places it.
 *
 * @returns The card.
 */
function InfoCard(): VNode {
  const { info } = assemblyText;
  return (
    <section data-part="info" aria-label={info.region} hidden>
      <div data-part="info-head">
        <CubeIcon tone="piece" glyph="page" size={30} />
        <div>
          <b data-part="info-name" />
          <span data-part="info-source" />
        </div>
        <button type="button" data-part="info-close" aria-label={info.close}>
          {info.closeMark}
        </button>
      </div>
      <p data-part="info-does" />
      <dl>
        <dt>{info.layer}</dt>
        <dd data-part="info-layer" />
        <dt>{info.needs}</dt>
        <dd data-part="info-needs" />
        <dt>{info.neededBy}</dt>
        <dd data-part="info-needed-by" />
      </dl>
      <p data-part="info-status" hidden />
      <button type="button" data-part="info-add" hidden />
    </section>
  );
}

/**
 * The code card: kernel.log with the file name and Start over, the code with line numbers and
 * the newest log lines.
 *
 * @param props - Component props.
 * @param props.panel - What the hero shows.
 * @returns The console.
 */
function CodeCard(props: { panel: HeroPanel }): VNode {
  const { panel } = props;
  return (
    <div data-part="console">
      <div data-part="console-bar">
        <span>{assemblyText.codeTabs.log}</span>
        <span data-part="file">{assemblyText.codeTabs.code}</span>
        <button type="button" data-part="reset">
          {assemblyText.startOver}
        </button>
      </div>
      <ol data-part="code" aria-label={assemblyText.code}>
        {panel.code.map(row => (
          <li key={row.number} data-new={row.isNew ? "" : undefined}>
            <span data-part="line-number">{row.number}</span>
            <code>
              {row.tokens.length === 0
                ? " "
                : row.tokens.map((token, index) =>
                    token.kind === undefined ? (
                      token.text
                    ) : (
                      <span key={index} data-token={token.kind}>
                        {token.text}
                      </span>
                    )
                  )}
            </code>
            {row.isNew ? <span data-visually-hidden> {assemblyText.newLine}</span> : undefined}
          </li>
        ))}
      </ol>
      <ol data-part="log" aria-live="polite">
        {panel.log.map((line, index) => (
          <li key={index} data-kind={line.kind}>
            {line.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The tray: heading and hint, one card per piece, the phone's verdict line and the standing
 * chips.
 *
 * @param props - Component props.
 * @param props.panel - What the hero shows.
 * @returns The tray.
 */
function Tray(props: { panel: HeroPanel }): VNode {
  const { panel } = props;
  return (
    <div data-part="tray">
      <p data-part="tray-head">
        <span data-part="tray-heading">{panel.heading}</span>
        <span data-part="hint">{panel.hint}</span>
      </p>
      <ul data-part="cards">
        {panel.cards.map(card => (
          <li key={card.id}>
            <button
              type="button"
              data-plug={card.id}
              data-state={card.state}
              disabled={card.state === "placed"}
              aria-disabled={card.state === "waiting" ? "true" : undefined}
              aria-label={card.label}
            >
              <CubeIcon tone="piece" glyph={card.glyph} size={36} />
              <b>{card.id}</b>
              <small>{card.note}</small>
            </button>
          </li>
        ))}
      </ul>
      <p data-part="verdict" data-kind={panel.verdict?.kind} aria-hidden="true">
        {panel.verdict?.text}
      </p>
      <div data-part="standing">
        <p>{panel.standingLead}</p>
        <ul data-part="chips">
          {panel.chips.map(chip => (
            <li key={chip.id}>
              <button type="button" data-chip={chip.id} aria-label={chip.label}>
                {chip.id}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The hero section. Its `data-props` carry the goals and the installed versions (D9), so the
 * island runs the same rules on the same data the build drew.
 *
 * @param props - Component props.
 * @param props.hero - The goals in switch order and the installed versions; the first goal is
 *   drawn in its start state.
 * @param props.url - Route link builder, for the two CTAs.
 * @returns The `<section data-component="hero" data-island="kernel-world">`.
 * @example
 * ```tsx
 * <Hero hero={view.hero} url={url} />
 * ```
 */
export function Hero(props: HeroProperties): VNode {
  const { hero, url } = props;
  const [goal] = hero.goals;
  if (goal === undefined) {
    return (
      <section data-component="hero" aria-label={assemblyText.region}>
        <Intro url={url} />
      </section>
    );
  }
  const state = initialAssembly(goal, hero.versions);
  const panel = heroPanel(goal, state, hero.versions);
  const scene = worldScene({ goal, state, versions: hero.versions, motion: { intro: true } });
  return (
    <section
      data-component="hero"
      data-island="kernel-world"
      data-props={JSON.stringify(hero)}
      aria-label={assemblyText.region}
    >
      <Intro url={url} />
      <GoalSwitch goals={hero.goals} current={goal.id} />
      <div data-part="stage">
        <div data-part="world-wrap">
          <div data-part="world-frame">
            <KernelWorld scene={scene} />
            <InfoCard />
          </div>
          <div data-part="under">
            <ol data-part="layer-key" aria-label={assemblyText.layerKey}>
              {layers.map(layer => (
                <li key={layer.id}>
                  <i data-layer={layer.id} />
                  {layer.name}
                </li>
              ))}
            </ol>
            <span data-part="tap-hint">{assemblyText.tapHint}</span>
          </div>
        </div>
        <CodeCard panel={panel} />
      </div>
      <Tray panel={panel} />
      <div data-part="flyer" aria-hidden="true" hidden>
        <CubeIcon tone="piece" glyph="page" size={48} />
        <span />
      </div>
    </section>
  );
}
