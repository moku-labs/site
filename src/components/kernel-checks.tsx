/**
 * @file "The kernel says no": three check cards with the kernel's exact messages (A1).
 */
import type { VNode } from "preact";
import type { KernelError } from "../lib/kernel-errors";

/** Title and one line per card, by kernel check id. */
const CARD_COPY: Readonly<Record<string, { title: string; text: string }>> = {
  "duplicate-name": {
    title: "Registered twice",
    text: "The agent wrote the same plugin in two files."
  },
  "missing-dependency": {
    title: "Missing dependency",
    text: "A plugin needs another one that is not in the list."
  },
  "reserved-name": { title: "Reserved name", text: "The name would shadow the app's own API." }
};

/** Props of {@link KernelChecks}. */
type KernelChecksProperties = {
  /** The card checks, in card order, with the kernel's messages. */
  checks: readonly KernelError[];
  /** How many checks the kernel runs. */
  count: number;
  /** The "What the kernel checks" docs page. */
  href: string;
};

/**
 * The check cards and the link to every check. The messages are captured from the real kernel
 * at build, never typed.
 *
 * @param props - Component props.
 * @returns The cards and the link.
 * @example
 * ```tsx
 * <KernelChecks checks={view.checks} count={view.checkCount} href={url("docsPage", { pkg: "concepts", page: "kernel-checks" })} />
 * ```
 */
export function KernelChecks(props: KernelChecksProperties): VNode {
  return (
    <div data-component="kernel-checks">
      <ul>
        {props.checks.map(check => (
          <li key={check.id}>
            <h3>{CARD_COPY[check.id]?.title ?? check.id}</h3>
            <p>{CARD_COPY[check.id]?.text ?? check.hint}</p>
            <code>{check.message}</code>
          </li>
        ))}
      </ul>
      <a data-part="more" href={props.href}>
        Read all {props.count} checks
      </a>
    </div>
  );
}
