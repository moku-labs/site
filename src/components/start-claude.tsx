/**
 * @file "Start with Claude" (A1): the conductor line and install terminal, and four prompts.
 * The `code-block` island on each part adds the Copy buttons (the terminal copies the `$` lines).
 */
import type { VNode } from "preact";
import type { HomeView } from "../lib/home-data";

/**
 * The conductor line and the install terminal.
 *
 * @param props - Component props.
 * @param props.claude - Plugin version and install commands.
 * @returns The `<div data-component="claude-install">`.
 * @example
 * ```tsx
 * <ClaudeInstall claude={view.claude} />
 * ```
 */
export function ClaudeInstall(props: { claude: HomeView["claude"] }): VNode {
  const { claude } = props;
  const [addMarketplace, install] = claude.install;
  return (
    <div data-component="claude-install" data-island="code-block">
      <div data-part="conductor">
        <img
          loading="lazy"
          decoding="async"
          src="/art/icon-claude-256.webp"
          srcset="/art/icon-claude-256.webp 256w, /art/icon-claude-512.webp 512w"
          sizes="88px"
          width={88}
          height={88}
          alt=""
        />
        <p>
          The conductor goes idea → plan → build → verify → release. The kernel checks every plugin
          it writes.
        </p>
      </div>
      <figure data-component="terminal" data-copy={claude.install.join("\n")}>
        <figcaption data-part="title">Claude Code</figcaption>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must take keyboard focus (WCAG 2.1.1) */}
        <pre data-part="screen" tabIndex={0}>
          <span data-kind="command">{addMarketplace}</span>
          {"\n"}
          <span data-kind="ok">✓ marketplace added</span>
          {"\n"}
          <span data-kind="command">{install}</span>
          {"\n"}
          <span data-kind="ok">✓ installed moku {claude.version}</span>
        </pre>
      </figure>
    </div>
  );
}

/**
 * The example prompts, each with a Copy button.
 *
 * @param props - Component props.
 * @param props.prompts - The prompts.
 * @returns The `<div data-component="claude-prompts">`.
 * @example
 * ```tsx
 * <ClaudePrompts prompts={view.claude.prompts} />
 * ```
 */
export function ClaudePrompts(props: { prompts: readonly string[] }): VNode {
  return (
    <div data-component="claude-prompts" data-island="code-block">
      <h3>Then ask for something</h3>
      <ul>
        {props.prompts.map(prompt => (
          <li key={prompt}>
            <figure data-component="prompt" data-copy={prompt}>
              <p data-part="text">{prompt}</p>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
