/**
 * @file The landing (A1, U5): hero, the kernel's checks, three layers, the pyramid, the package
 * family and Start with Claude.
 */
import type { VNode } from "preact";
import { Hero } from "../components/hero";
import { KernelChecks } from "../components/kernel-checks";
import { LandingSection } from "../components/landing-section";
import { LayersStack } from "../components/layers-stack";
import { PackageGrid } from "../components/package-grid";
import { Pyramid } from "../components/pyramid";
import { ClaudeInstall, ClaudePrompts } from "../components/start-claude";
import type { HomeView } from "../lib/home-data";
import type { UrlBuilder } from "../lib/url-builder";

/** Props of {@link HomePage}. */
type HomePageProperties = {
  /** The home view loaded at build. */
  view: HomeView;
  /** Route link builder. */
  url: UrlBuilder;
};

/**
 * The home page. Everything it shows comes from the view the home loader built: versions from
 * the installed packages, messages from the real kernel.
 *
 * @param props - Component props.
 * @returns The page root.
 * @example
 * ```tsx
 * route("/").render(ctx => <HomePage view={ctx.data} url={ctx.url} />);
 * ```
 */
export function HomePage(props: HomePageProperties): VNode {
  const { view, url } = props;
  return (
    <div data-page="home">
      <Hero hero={view.hero} packages={view.packages} url={url} />
      <LandingSection
        id="checks"
        title="Errors at startup, not in production."
        lede="createApp checks the whole plugin list before anything runs. A bad plugin is a startup error with a sentence you can read, not a bug in production."
      >
        <KernelChecks
          checks={view.checks}
          count={view.checkCount}
          href={url("docsPage", { pkg: "concepts", page: "kernel-checks" })}
        />
      </LandingSection>
      <LandingSection
        id="layers"
        title="Three layers. Nothing reaches back down."
        lede="Config makes a framework. A framework makes apps. Each layer can only add plugins on top of the one below. Hover or tap a layer."
      >
        <LayersStack code={view.layersCode} />
      </LandingSection>
      <LandingSection
        id="stack"
        title="Everything stands on one kernel."
        lede="The kernel on top, eleven packages under it, six demo apps at the base. Hover or tap a demo to see what it is built from, or a package to see what was built with it."
      >
        <Pyramid packages={view.packages} demos={view.demos} url={url} />
      </LandingSection>
      <LandingSection
        id="packages"
        title="Packages"
        lede="Each one is built on @moku-labs/core, and each one refuses the same mistakes. Pick a block to read its docs."
      >
        <PackageGrid packages={view.packages} url={url} />
      </LandingSection>
      <LandingSection
        id="start"
        title="Start with Claude"
        lede="Install the plugin in Claude Code, then say what you want."
        aside={<ClaudePrompts prompts={view.claude.prompts} />}
      >
        <ClaudeInstall claude={view.claude} />
      </LandingSection>
    </div>
  );
}
