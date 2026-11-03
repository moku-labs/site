/**
 * @file The hero's assembly as plain data: the three goals (Site, App, Game), their pieces and
 * standing plugins, the layers, the scenery, every word the hero shows and the final code.
 *
 * No version is typed here (decision D1). A text that shows one carries a placeholder (`{core}`,
 * `{common}`, `{version}`) that `src/lib/assembly.ts` fills with the installed versions. The rules
 * that read this data (what waits, what settles, the code of a state) live there too.
 */
import type { GlyphName } from "../lib/glyphs";

/** One of the three things the visitor can build. */
export type GoalId = "site" | "app" | "game";

/** The framework a goal stands on. */
export type FrameworkId = "web" | "worker" | "game";

/** One of the three stepped layers of the world. */
export type LayerId = "kernel" | "framework" | "app";

/** A cell of the 10×10 world grid: along x, along y. */
export type Cell = readonly [x: number, y: number];

/** A glyph a cube of the assembly carries: one of the shared lid glyphs. */
export type AssemblyGlyph = GlyphName;

/** One of the three layers, as the hero names it. */
export type Layer = {
  /** Layer id. */
  id: LayerId;
  /** Short name for the layer key and the brackets, e.g. `Framework`. */
  name: string;
  /** Where it is, for the info card, e.g. `Framework, the middle platform`. */
  place: string;
};

/**
 * The layers from the ground up.
 *
 * @example
 * ```ts
 * layers.map(layer => layer.name); // ["Kernel", "Framework", "Your app"]
 * ```
 */
export const layers: readonly Layer[] = [
  { id: "kernel", name: "Kernel", place: "Kernel, on the ground" },
  { id: "framework", name: "Framework", place: "Framework, the middle platform" },
  { id: "app", name: "Your app", place: "Your app, the top platform" }
];

/** A dimmed family package standing on the outer ring as scenery, without a label. */
export type SceneryPlace = {
  /** Package id; also its glyph. */
  package: GlyphName;
  /** Its cell. */
  cell: Cell;
};

/**
 * The scenery around the platforms. A goal whose own framework is in this list shows its
 * `sceneryStandIn` there instead, so no package appears twice.
 *
 * @example
 * ```ts
 * scenery.find(place => place.package === "worker")?.cell; // [6, 0]
 * ```
 */
export const scenery: readonly SceneryPlace[] = [
  { package: "system", cell: [0, 6] },
  { package: "native", cell: [0, 8] },
  { package: "editor", cell: [1, 9] },
  { package: "worker", cell: [6, 0] },
  { package: "room", cell: [8, 0] },
  { package: "ai", cell: [9, 1] }
];

/** The kernel, the same in every goal. */
export type KernelItem = {
  /** Name on the info card. */
  name: string;
  /** What it does, as the info card says it. */
  does: string;
  /** Where it comes from; `{core}` is the installed core version. */
  source: string;
};

/**
 * The kernel: the pink cube every goal stands on.
 *
 * @example
 * ```ts
 * kernelItem.source; // "@moku-labs/core {core}", filled with the installed version
 * ```
 */
export const kernelItem: KernelItem = {
  name: "kernel",
  does: "Micro-kernel: config, lifecycle, events. Checks every plugin before start.",
  source: "@moku-labs/core {core}"
};

/** The framework block of a goal. */
export type GoalFramework = {
  /** Framework id; also its name in the world. */
  id: FrameworkId;
  /** Glyph on its lid. */
  glyph: AssemblyGlyph;
  /** What it does. */
  does: string;
  /** Where it comes from; `{version}` is the installed framework version. */
  source: string;
};

/** A plugin that stands on the framework platform from the start. */
export type StandingPlugin = {
  /** Plugin name. */
  id: string;
  /** Glyph on its lid. */
  glyph: AssemblyGlyph;
  /** Its cell on the framework platform. */
  cell: Cell;
  /** What it does. */
  does: string;
  /** Where it comes from; `{common}` is the installed common version. */
  source: string;
  /** What it needs: the framework, or `core` for the kernel. */
  needs: string;
};

/** A piece of the tray: the visitor adds it. */
export type Piece = {
  /** Plugin name. */
  id: string;
  /** Glyph on its lid and on its tray card. */
  glyph: AssemblyGlyph;
  /** The cell of its socket. */
  cell: Cell;
  /** The layer it lands in. */
  layer: "framework" | "app";
  /** What it does, for the info card. */
  does: string;
  /** What it gives the app, for the log line. */
  gives: string;
  /** Where it comes from. */
  source: string;
  /** What it sits on: the framework or a standing plugin, always there. */
  sitsOn: string;
  /** What it needs besides: another piece or a standing plugin. It waits until that is in. */
  needs?: string;
};

/** The app a goal builds: the cube that rises at the finish. */
export type GoalApp = {
  /** App name, e.g. `Field Notes`. */
  name: string;
  /** Its label in the world, e.g. `field-notes.dev`. */
  label: string;
  /** Glyph on the app cube. */
  glyph: AssemblyGlyph;
  /** What it is. */
  does: string;
  /** Where it comes from. */
  source: string;
};

/** An entry of a code list: always there, or only once its piece is in. */
export type CodeItem = {
  /** The code text. */
  text: string;
  /** The piece that brings it. */
  piece?: string;
};

/**
 * One line of the code card: a fixed line (only once its piece is in, when it names one), or a
 * line with a comma list that grows as pieces come in.
 */
export type CodeLine =
  | {
      /** The whole line. */
      line: string;
      /** The piece that brings the line. */
      piece?: string;
    }
  | {
      /** Text before the list. */
      before: string;
      /** The list, joined with `, `. */
      items: readonly CodeItem[];
      /** Text after the list. */
      after: string;
      /** Leave the line out while its list is empty. */
      hideEmpty?: boolean;
    };

/** One thing to build. */
export type Goal = {
  /** Goal id, in the switch. */
  id: GoalId;
  /** Label in the goal switch. */
  label: string;
  /** The app it builds. */
  app: GoalApp;
  /** The framework it stands on. */
  framework: GoalFramework;
  /** Plugins standing from the start, in chip order. */
  standing: readonly StandingPlugin[];
  /** The three tray pieces, in tray order. */
  pieces: readonly Piece[];
  /** The code card as a template: what each piece adds. */
  code: readonly CodeLine[];
  /** The code once every piece is in, line by line. The compile test checks it. */
  finalCode: readonly string[];
  /** The scenery package shown where the scenery would repeat this goal's framework. */
  sceneryStandIn?: GlyphName;
};

/** Where `log` comes from, in a goal on `web`. */
const COMMON_ON_WEB = "from @moku-labs/common {common}, re-exported by web";

/** Where `log` comes from, in a goal on `worker`. */
const COMMON_ON_WORKER = "from @moku-labs/common {common}, re-exported by worker";

/** Where `log` comes from, in a goal on `game`. */
const COMMON_ON_GAME = "from @moku-labs/common {common}, re-exported by game";

/** Where a plugin of your own comes from. */
const YOUR_PLUGIN = "your plugin, in ./plugins";

/**
 * Site: the Field Notes blog on `web`. `comments` needs `content`, so it waits when it comes first.
 *
 * @example
 * ```ts
 * siteGoal.pieces.map(piece => piece.id); // ["content", "comments", "newsletter"]
 * ```
 */
export const siteGoal: Goal = {
  id: "site",
  label: "Site",
  app: {
    name: "Field Notes",
    label: "field-notes.dev",
    glyph: "window",
    does: "The blog, built from every piece below it.",
    source: "field-notes.dev, made with createApp"
  },
  framework: {
    id: "web",
    glyph: "web",
    does: "Static site + islands SPA.",
    source: "@moku-labs/web {version}"
  },
  standing: [
    {
      id: "site",
      glyph: "site",
      cell: [2, 4],
      does: "Name, url, author.",
      source: "comes with @moku-labs/web",
      needs: "web"
    },
    {
      id: "router",
      glyph: "route",
      cell: [2, 6],
      does: "Routes and links.",
      source: "comes with @moku-labs/web",
      needs: "web"
    },
    {
      id: "head",
      glyph: "head",
      cell: [2, 8],
      does: "Titles, meta, feeds.",
      source: "comes with @moku-labs/web",
      needs: "web"
    },
    {
      id: "spa",
      glyph: "spa",
      cell: [8, 2],
      does: "Client navigation and islands.",
      source: "comes with @moku-labs/web",
      needs: "web"
    },
    {
      id: "log",
      glyph: "log",
      cell: [3, 7],
      does: "One logger for every plugin.",
      source: COMMON_ON_WEB,
      needs: "core"
    },
    {
      id: "env",
      glyph: "env",
      cell: [7, 3],
      does: "Settings from the environment.",
      source: COMMON_ON_WEB,
      needs: "core"
    }
  ],
  pieces: [
    {
      id: "content",
      glyph: "page",
      cell: [4, 2],
      layer: "framework",
      does: "Markdown posts.",
      gives: "Markdown posts in content/posts",
      source: "@moku-labs/web, added by you",
      sitsOn: "web"
    },
    {
      id: "comments",
      glyph: "comments",
      cell: [4, 1],
      layer: "app",
      does: "Comments under each post.",
      gives: "comments under each post",
      source: YOUR_PLUGIN,
      sitsOn: "web",
      needs: "content"
    },
    {
      id: "newsletter",
      glyph: "mail",
      cell: [1, 4],
      layer: "app",
      does: "Email sign-up for new posts.",
      gives: "email sign-up for new posts",
      source: YOUR_PLUGIN,
      sitsOn: "web",
      needs: "site"
    }
  ],
  code: [
    {
      before: "import { ",
      items: [{ text: "createApp" }, { text: "contentPlugin", piece: "content" }],
      after: ' } from "@moku-labs/web";'
    },
    {
      before: "import { ",
      items: [
        { text: "commentsPlugin", piece: "comments" },
        { text: "newsletterPlugin", piece: "newsletter" }
      ],
      after: ' } from "./plugins";',
      hideEmpty: true
    },
    { line: "" },
    { line: "export const app = createApp({" },
    {
      before: "  plugins: [",
      items: [
        { text: "contentPlugin", piece: "content" },
        { text: "commentsPlugin", piece: "comments" },
        { text: "newsletterPlugin", piece: "newsletter" }
      ],
      after: "],"
    },
    { line: '  pluginConfigs: { site: { name: "Field Notes", url: "https://field-notes.dev" } }' },
    { line: "});" }
  ],
  finalCode: [
    'import { createApp, contentPlugin } from "@moku-labs/web";',
    'import { commentsPlugin, newsletterPlugin } from "./plugins";',
    "",
    "export const app = createApp({",
    "  plugins: [contentPlugin, commentsPlugin, newsletterPlugin],",
    '  pluginConfigs: { site: { name: "Field Notes", url: "https://field-notes.dev" } }',
    "});"
  ]
};

/**
 * App: the Tracker API on `worker`. `tasks` needs `d1`, so it waits when it comes first.
 *
 * @example
 * ```ts
 * appGoal.pieces.find(piece => piece.id === "tasks")?.needs; // "d1"
 * ```
 */
export const appGoal: Goal = {
  id: "app",
  label: "App",
  app: {
    name: "Tracker API",
    label: "Tracker API",
    glyph: "rack",
    does: "The task tracker backend, built from every piece below it.",
    source: "Tracker API, made with createApp"
  },
  framework: {
    id: "worker",
    glyph: "worker",
    does: "Cloudflare Workers backend.",
    source: "@moku-labs/worker {version}"
  },
  standing: [
    {
      id: "bindings",
      glyph: "bindings",
      cell: [2, 4],
      does: "The root of the Cloudflare bindings, d1 and kv hang off it.",
      source: "comes with @moku-labs/worker",
      needs: "worker"
    },
    {
      id: "server",
      glyph: "server",
      cell: [2, 6],
      does: "The HTTP server of the Worker.",
      source: "comes with @moku-labs/worker",
      needs: "worker"
    },
    {
      id: "log",
      glyph: "log",
      cell: [3, 7],
      does: "One logger for every plugin.",
      source: COMMON_ON_WORKER,
      needs: "core"
    },
    {
      id: "env",
      glyph: "env",
      cell: [7, 3],
      does: "Settings from the environment.",
      source: COMMON_ON_WORKER,
      needs: "core"
    }
  ],
  pieces: [
    {
      id: "d1",
      glyph: "d1",
      cell: [4, 2],
      layer: "framework",
      does: "Typed D1 queries.",
      gives: "typed D1 queries, rooted in bindings",
      source: "@moku-labs/worker, added by you",
      sitsOn: "worker"
    },
    {
      id: "kv",
      glyph: "kv",
      cell: [6, 2],
      layer: "framework",
      does: "One KV namespace.",
      gives: "one KV namespace",
      source: "@moku-labs/worker, added by you",
      sitsOn: "worker"
    },
    {
      id: "tasks",
      glyph: "tasks",
      cell: [4, 1],
      layer: "app",
      does: "The task list API.",
      gives: "the task list API",
      source: YOUR_PLUGIN,
      sitsOn: "worker",
      needs: "d1"
    }
  ],
  code: [
    {
      before: "import { ",
      items: [
        { text: "createApp" },
        { text: "d1Plugin", piece: "d1" },
        { text: "kvPlugin", piece: "kv" }
      ],
      after: ' } from "@moku-labs/worker";'
    },
    { line: 'import { tasksPlugin } from "./plugins";', piece: "tasks" },
    { line: "" },
    {
      before: "export const app = createApp({ plugins: [",
      items: [
        { text: "d1Plugin", piece: "d1" },
        { text: "kvPlugin", piece: "kv" },
        { text: "tasksPlugin", piece: "tasks" }
      ],
      after: "] });"
    }
  ],
  finalCode: [
    'import { createApp, d1Plugin, kvPlugin } from "@moku-labs/worker";',
    'import { tasksPlugin } from "./plugins";',
    "",
    "export const app = createApp({ plugins: [d1Plugin, kvPlugin, tasksPlugin] });"
  ],
  sceneryStandIn: "web"
};

/**
 * Game: TickToe on `game`. `board` needs `flow`, which stands from the start, so nothing waits.
 *
 * @example
 * ```ts
 * gameGoal.finalCode.at(-1); // 'export const board = defineFeature("board", {});'
 * ```
 */
export const gameGoal: Goal = {
  id: "game",
  label: "Game",
  app: {
    name: "TickToe",
    label: "TickToe",
    glyph: "grid",
    does: "A tic-tac-toe game, built from every piece below it.",
    source: "TickToe, made with createApp"
  },
  framework: {
    id: "game",
    glyph: "game",
    does: "The 2D game engine.",
    source: "@moku-labs/game {version}"
  },
  standing: [
    {
      id: "flow",
      glyph: "flow",
      cell: [2, 4],
      does: "The steps of play, as a graph.",
      source: "comes with @moku-labs/game",
      needs: "game"
    },
    {
      id: "time",
      glyph: "time",
      cell: [2, 6],
      does: "Time as now, so play can replay.",
      source: "comes with @moku-labs/game",
      needs: "game"
    },
    {
      id: "clock",
      glyph: "clock",
      cell: [2, 8],
      does: "Ticks the game forward.",
      source: "comes with @moku-labs/game",
      needs: "game"
    },
    {
      id: "lifecycle",
      glyph: "lifecycle",
      cell: [3, 9],
      does: "Start, pause and stop.",
      source: "comes with @moku-labs/game",
      needs: "game"
    },
    {
      id: "model",
      glyph: "model",
      cell: [8, 2],
      does: "The committed game state.",
      source: "comes with @moku-labs/game",
      needs: "game"
    },
    {
      id: "log",
      glyph: "log",
      cell: [3, 7],
      does: "One logger for every plugin.",
      source: COMMON_ON_GAME,
      needs: "core"
    },
    {
      id: "env",
      glyph: "env",
      cell: [7, 3],
      does: "Settings from the environment.",
      source: COMMON_ON_GAME,
      needs: "core"
    }
  ],
  pieces: [
    {
      id: "screen",
      glyph: "screen",
      cell: [4, 2],
      layer: "framework",
      does: "The nine screen plugins as one set: world, renderer, input, ui …",
      gives: "world, renderer, input, ui and the rest of the screen",
      source: "@moku-labs/game, nine plugins as one set",
      sitsOn: "game"
    },
    {
      id: "audio",
      glyph: "audio",
      cell: [6, 2],
      layer: "framework",
      does: "Opt-in: music and sound effects.",
      gives: "music and sound effects",
      source: "@moku-labs/game, opt-in",
      sitsOn: "game"
    },
    {
      id: "board",
      glyph: "board",
      cell: [1, 4],
      layer: "app",
      does: "Your feature: the tic-tac-toe board.",
      gives: "the tic-tac-toe board",
      source: "your feature, made with defineFeature",
      sitsOn: "game",
      needs: "flow"
    }
  ],
  code: [
    {
      before: "import { ",
      items: [
        { text: "createApp" },
        { text: "defineFeature", piece: "board" },
        { text: "screen", piece: "screen" },
        { text: "audioPlugin", piece: "audio" }
      ],
      after: ' } from "@moku-labs/game";'
    },
    { line: "" },
    {
      before: "export const app = createApp({ plugins: [",
      items: [
        { text: "...screen", piece: "screen" },
        { text: "audioPlugin", piece: "audio" }
      ],
      after: "] });"
    },
    { line: 'export const board = defineFeature("board", {});', piece: "board" }
  ],
  finalCode: [
    'import { createApp, defineFeature, screen, audioPlugin } from "@moku-labs/game";',
    "",
    "export const app = createApp({ plugins: [...screen, audioPlugin] });",
    'export const board = defineFeature("board", {});'
  ]
};

/**
 * The goals in switch order; the first is the default and the first paint.
 *
 * @example
 * ```ts
 * goals.map(goal => goal.label); // ["Site", "App", "Game"]
 * ```
 */
export const goals: readonly Goal[] = [siteGoal, appGoal, gameGoal];

/**
 * Every word of the hero's assembly. `{name}` marks a value filled in by `src/lib/assembly.ts`.
 *
 * @example
 * ```ts
 * // The tray heading of the Site goal, before and after the finish:
 * assemblyText.trayHeading; // "Pieces for {app}" → "Pieces for Field Notes"
 * assemblyText.trayHeadingDone; // "Now try another app"
 * ```
 */
export const assemblyText = {
  region: "Moku in one interaction",
  headline: "The agentic framework for reliable software.",
  sub: "Your LLM writes the plugins. A micro-kernel checks every one before the app starts. Sites, backends, games and native apps on one core.",
  docsCta: "Read the docs",
  claudeCta: "Start with Claude",
  tryIt: {
    lead: "Try it:",
    text: "tap a piece card to add it, or drag it onto the pink kernel."
  },
  goalSwitch: "What to build",
  world:
    "Three layers: the kernel on the ground, the framework on the middle platform, your app on the top platform",
  layerKey: "Layers, bottom up",
  code: "The composition code for the current state",
  kernelSign: "core {core}",
  frameworkSign: "{framework} {version}",
  trayHeading: "Pieces for {app}",
  trayHeadingDone: "Now try another app",
  trayHint: "tap a card, or drag it onto the kernel",
  trayHintDone: "{app} is running.",
  standingLead: "Already standing, from {framework} and @moku-labs/common:",
  tapHint: "Tap any cube to see what it does and needs.",
  codeTabs: { log: "kernel.log", code: "app.ts" },
  startOver: "Start over",
  newLine: "(new line)",
  waitingCallout: "{piece} needs {need}",
  completion: "{app} is running. Every need is met.",
  and: "and",
  card: {
    sitsOn: "Sits on {target}",
    needs: "Needs {need}",
    next: "Add this next",
    waiting: "Waiting for {need}",
    placed: "In place"
  },
  info: {
    layer: "Layer",
    needs: "Needs",
    neededBy: "Needed by",
    nothing: "nothing",
    nothingYet: "nothing yet",
    top: "nothing, it is the top",
    theApp: "{app}, the app",
    everyPlugin: "every plugin it checks",
    everyPieceUnder: "and every piece under them",
    notInYet: "Not in yet. Drop it on the kernel.",
    waiting: "Waiting for {need}.",
    notRunning: "Not running yet. Add every piece first.",
    add: "Add {piece}",
    region: "Details",
    close: "Close details",
    closeMark: "×"
  },
  aria: {
    kernel: "{name}, {source}. Drop pieces here. Show details",
    item: "{name}. {source}. Show details",
    waiting: "{name}, waiting. {source}. Show details",
    cardAdd: "{piece}. {note}. Add to the app",
    cardWaiting: "{piece}. {note}. Show details",
    cardPlaced: "{piece}. {note}."
  },
  log: {
    kernelUp: "kernel @moku-labs/core {core} is up.",
    frameworkUp: "{framework} {version} stands on it with {standing}.",
    appNeeds: "{app} needs {pieces}.",
    placed: "{piece} is in, on {on}: {gives}.",
    waiting: "{piece} needs {need}. Add {need} first.",
    settled: "{piece} settles in, on {on}: {gives}.",
    check: "kernel checks every plugin: names unique, every need met.",
    running: "app.start() → {app} is running."
  }
};
