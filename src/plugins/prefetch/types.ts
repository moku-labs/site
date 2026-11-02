/**
 * @file Config and state of the browser `prefetch` plugin.
 */
import type { LinkWarmer } from "../../lib/link-prefetch";

/** Plugin config. */
export type PrefetchConfig = {
  /** Milliseconds a mouse rests on a link before its page is warmed. */
  hoverDelay: number;
  /** How many links in view are warmed per page, without a sign of intent. */
  viewportBudget: number;
  /** Longest wait, in milliseconds, for an idle moment before links in view are watched. */
  idleTimeout: number;
};

/** Plugin state: the warmer and the resources `onStop` releases. */
export type PrefetchState = {
  /** Remembers what was warmed; set by `onStart`. */
  warmer: LinkWarmer | undefined;
  /** Aborts the document listeners of the current start; set by `onStart`. */
  listeners: AbortController | undefined;
  /** Watches the links of the current page. */
  observer: IntersectionObserver | undefined;
  /** The pending hover warm-up. */
  hover: ReturnType<typeof setTimeout> | undefined;
};
