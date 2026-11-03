/**
 * @file Build-time data of the home page: the hero's goals with the installed versions, the
 * layers code, the package family, the demos and the Claude section.
 *
 * `routes.tsx` imports this module lazily inside the home loader, which runs only at build. The
 * Markdown renderer comes in as a plugin API (`ctx.require`), the versions from the docs loader's
 * `installedSources()`, so nothing here imports Node code. Everything the page renders is in the
 * returned view, which the build also writes as the page's data sidecar.
 */

import { goals } from "../data/assembly";
import type { DemoEntry } from "../data/demos";
import { demos } from "../data/demos";
import type { PackageGroup } from "../data/packages";
import { claudeInstallCommands, LANDING_PROMPT_COUNT, landingPrompts } from "../data/prompts";
import type { HeroData } from "./hero-props";
import type { ResolvedPackage } from "./packages";

/**
 * The three-layer sample, one line per layer: config makes a framework, a framework makes apps.
 * Code line N is layer N, so the page shows no imports; the compile test supplies them.
 */
export const LAYERS_LINES: readonly string[] = [
  'const config = createCoreConfig<Config, Events>("my-site", { config: { title: "Hi" } });',
  "const framework = config.createCore(config, { plugins: [routerPlugin] });",
  "const app = framework.createApp({ plugins: [blogPlugin] });"
];

/** The sample as the Markdown the docs pipeline renders. */
const LAYERS_CODE = ['```ts file="my-site.ts"', ...LAYERS_LINES, "```"].join("\n");

/** What the home loader reads. */
export type HomeSources = {
  /** The content plugin's Markdown renderer. */
  content: {
    /** Render Markdown with the docs pipeline. */
    renderMarkdown(markdown: string): Promise<string>;
  };
  /** The family with installed versions, in family order. */
  packages: readonly ResolvedPackage[];
};

/** A package as the home page shows it. */
export type HomePackage = {
  /** Package id; also its docs path segment and art file name. */
  id: string;
  /** Display name. */
  name: string;
  /** Installed version. */
  version: string;
  /** The version as cards and tooltips show it, e.g. `moku 0.85.6`. */
  versionLabel: string;
  /** One-line tagline. */
  tagline: string;
  /** Docs group. */
  group: PackageGroup;
};

/** What the hero shows and hands its island: the three goals and the installed versions. */
export type HeroView = HeroData;

/** Everything the home page renders. */
export type HomeView = {
  /** The hero's goals and the versions it shows. */
  hero: HeroView;
  /** The layers code, rendered by the docs pipeline. */
  layersCode: string;
  /** The family in family order. */
  packages: readonly HomePackage[];
  /** The demos in display order. */
  demos: readonly DemoEntry[];
  /** The Claude section. */
  claude: {
    /** Version of the Claude plugin. */
    version: string;
    /** The install commands. */
    install: readonly string[];
    /** The example prompts the server renders: the first `LANDING_PROMPT_COUNT` of the landing pool. */
    prompts: readonly string[];
  };
};

/**
 * The version of one package of the family, or `""` when it is missing.
 *
 * @param packages - The family.
 * @param id - Package id.
 * @returns The installed version.
 */
function versionOf(packages: readonly ResolvedPackage[], id: string): string {
  return packages.find(entry => entry.id === id)?.version ?? "";
}

/**
 * Load the home page at build: the hero's goals with the installed versions of core, common and
 * the three frameworks, the layers code through the docs pipeline, and the family.
 *
 * @param sources - The content plugin API and the resolved family.
 * @returns The home view.
 * @example
 * ```ts
 * // route("/").load(async ctx => loadHome({ content: ctx.require(contentReference), packages }))
 * const view = await loadHome({ content: app.content, packages: installedSources().packages });
 * view.hero.versions.web; // "2.4.15", read from node_modules/@moku-labs/web/package.json
 * ```
 */
export async function loadHome(sources: HomeSources): Promise<HomeView> {
  const { packages } = sources;
  const layersCode = await sources.content.renderMarkdown(LAYERS_CODE);
  return {
    hero: {
      goals,
      versions: {
        core: versionOf(packages, "core"),
        common: versionOf(packages, "common"),
        web: versionOf(packages, "web"),
        worker: versionOf(packages, "worker"),
        game: versionOf(packages, "game")
      }
    },
    layersCode,
    packages: sources.packages.map(({ id, name, version, versionLabel, tagline, group }) => ({
      id,
      name,
      version,
      versionLabel,
      tagline,
      group
    })),
    demos,
    claude: {
      version: versionOf(sources.packages, "claude"),
      install: claudeInstallCommands,
      prompts: landingPrompts.slice(0, LANDING_PROMPT_COUNT)
    }
  };
}
