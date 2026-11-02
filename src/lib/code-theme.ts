/**
 * @file Shiki theme whose colours are CSS variables, so one render serves light and dark.
 *
 * The variables are defined in `src/styles/code.css` with `light-dark()`.
 */

/** One TextMate scope rule. */
type TokenColor = {
  /** Scopes the rule applies to. */
  scope: string[];
  /** Style applied to the scopes. */
  settings: { foreground: string; fontStyle?: string };
};

/** The subset of Shiki's `ThemeRegistration` the site uses. */
export type CodeTheme = {
  /** Theme name. */
  name: string;
  /** Base colour scheme Shiki assumes. */
  type: "dark" | "light";
  /** Default foreground. */
  fg: string;
  /** Default background. */
  bg: string;
  /** Editor colours. */
  colors: Record<string, string>;
  /** Token scope rules. */
  settings: TokenColor[];
};

/**
 * The site's code theme. Every colour is a `var(--code-*)` token.
 *
 * @example
 * ```ts
 * fileSystemContent({ contentDir: "content/articles", trustedContent: true, shikiTheme: mokuCodeTheme });
 * ```
 */
export const mokuCodeTheme: CodeTheme = {
  name: "moku-css-vars",
  type: "dark",
  fg: "var(--code-fg)",
  bg: "var(--code-bg)",
  colors: { "editor.background": "var(--code-bg)", "editor.foreground": "var(--code-fg)" },
  settings: [
    { scope: ["comment"], settings: { foreground: "var(--code-comment)", fontStyle: "italic" } },
    { scope: ["keyword", "storage"], settings: { foreground: "var(--code-keyword)" } },
    { scope: ["string"], settings: { foreground: "var(--code-string)" } },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "var(--code-function)" }
    },
    { scope: ["entity.name.type", "support.type"], settings: { foreground: "var(--code-type)" } },
    { scope: ["constant.numeric"], settings: { foreground: "var(--code-number)" } }
  ]
};
