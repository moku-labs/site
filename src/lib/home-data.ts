/**
 * @file Build-time data of the home page: the hero tray and its kernel messages, the check
 * cards, the layers code, the package family, the demos and the Claude section.
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
import type { KernelError, TrayMessages, TrayRule } from "./kernel-errors";
import type { ResolvedPackage } from "./packages";

/** The kernel checks shown as cards, in card order. */
const CARD_CHECKS = ["duplicate-name", "missing-dependency", "reserved-name"] as const;

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
    /** Every kernel check with its exact message. */
    errors(): Promise<KernelError[]>;
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
  /** The check cards, in card order, with the kernel's exact messages. */
  checks: readonly KernelError[];
  /** How many checks the kernel runs. */
  checkCount: number;
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
 * The card checks out of every check, in card order.
 *
 * @param errors - Every kernel check.
 * @returns The three card checks.
 * @throws {Error} When the kernel no longer has one of them.
 */
function cardChecks(errors: readonly KernelError[]): KernelError[] {
  return CARD_CHECKS.map(id => {
    const check = errors.find(error => error.id === id);
    if (check === undefined) {
      throw new Error(
        `[site] Kernel check "${id}" is gone.\n  Update the check cards in src/lib/home-data.ts.`
      );
    }
    return check;
  });
}

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
 * Load the home page at build: the real kernel's messages for the hero and the cards, the layers
 * code through the docs pipeline, and the family with installed versions.
 *
 * @param sources - The kernel and content plugin APIs and the resolved family.
 * @returns The home view.
 * @throws {Error} When a card check is gone or a kernel check stopped throwing.
 * @example
 * ```ts
 * // route("/").load(async ctx => loadHome({ kernel: ctx.require(kernelReference), content: ctx.require(contentReference), packages }))
 * const view = await loadHome({ kernel: app.kernel, content: app.content, packages: installedSources().packages });
 * view.checks.map(check => check.id); // ["duplicate-name", "missing-dependency", "reserved-name"]
 * ```
 */
export async function loadHome(sources: HomeSources): Promise<HomeView> {
  const [errors, messages, layersCode] = await Promise.all([
    sources.kernel.errors(),
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
    checks: cardChecks(errors),
    checkCount: errors.length,
    layersCode,
    packages: sources.packages.map(({ id, name, version, tagline, group }) => ({
      id,
      name,
      version,
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
