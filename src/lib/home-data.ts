/**
 * @file Build-time data of the home page: the hero tray and its kernel messages, the layers
 * code, the package family, the demos and the Claude section.
 *
 * `routes.tsx` imports this module lazily inside the home loader, which runs only at build. The
 * kernel and the Markdown renderer come in as plugin APIs (`ctx.require`), the versions from the
 * docs loader's `installedSources()`, so nothing here imports Node code. Everything the page
 * renders is in the returned view, which the build also writes as the page's data sidecar.
 */
import type { DemoEntry } from "../data/demos";
import { demos } from "../data/demos";
import type { PackageGroup } from "../data/packages";
import { claudeInstallCommands, claudePrompts } from "../data/prompts";
import type { TrayPlugin } from "../data/tray";
import { trayPlugins, traySeed } from "../data/tray";
import type { TrayMessages, TrayRule } from "./kernel-errors";
import type { ResolvedPackage } from "./packages";

/** The three-layer sample: config makes a framework, a framework makes apps. */
const LAYERS_CODE = [
  '```ts file="my-site.ts"',
  'const config = createCoreConfig<Config, Events>("my-site", { config: { title: "Hi" } });',
  "const framework = createCore(config, { plugins: [routerPlugin] });",
  "const app = framework.createApp({ plugins: [blogPlugin] });",
  "```"
].join("\n");

/** What the home loader reads. */
export type HomeSources = {
  /** The kernel plugin's API. */
  kernel: {
    /** The hero tray's messages. */
    trayMessages(tray: readonly TrayRule[]): Promise<TrayMessages>;
  };
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

/** What the hero world island needs. */
export type HeroView = {
  /** The tray in display order. */
  tray: readonly TrayPlugin[];
  /** The kernel's messages for the tray. */
  messages: TrayMessages;
  /** Tray items plugged in before first paint. */
  seed: readonly string[];
  /** Installed `@moku-labs/core` version, shown on the kernel's tooltip. */
  kernelVersion: string;
};

/** Everything the home page renders. */
export type HomeView = {
  /** The hero tray and its kernel messages. */
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
    /** Example prompts. */
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
 * Load the home page at build: the real kernel's messages for the hero tray, the layers
 * code through the docs pipeline, and the family with installed versions.
 *
 * @param sources - The kernel and content plugin APIs and the resolved family.
 * @returns The home view.
 * @throws {Error} When a kernel check stopped throwing.
 * @example
 * ```ts
 * // route("/").load(async ctx => loadHome({ kernel: ctx.require(kernelReference), content: ctx.require(contentReference), packages }))
 * const view = await loadHome({ kernel: app.kernel, content: app.content, packages: installedSources().packages });
 * view.hero.tray.length; // 6
 * ```
 */
export async function loadHome(sources: HomeSources): Promise<HomeView> {
  const [messages, layersCode] = await Promise.all([
    sources.kernel.trayMessages(trayPlugins),
    sources.content.renderMarkdown(LAYERS_CODE)
  ]);
  return {
    hero: {
      tray: trayPlugins,
      messages,
      seed: traySeed,
      kernelVersion: versionOf(sources.packages, "core")
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
      prompts: claudePrompts
    }
  };
}
