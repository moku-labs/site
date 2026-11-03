/**
 * @file Types of the `kernel-world` island: its per-instance state and its context.
 */
import type { Spa } from "@moku-labs/web/browser";
import type { AssemblyState } from "../../lib/assembly";
import type { HeroData } from "../../lib/hero-props";
import type { ScreenPoint } from "../../lib/kernel-flight";

/** A tray card being dragged. */
export type Drag = {
  /** Piece id. */
  id: string;
  /** The captured pointer. */
  pointerId: number;
  /** The tray card. */
  button: HTMLButtonElement;
  /** Where the press started. */
  start: ScreenPoint;
  /** The ghost following the pointer, once the pointer moved far enough. */
  ghost: HTMLElement | undefined;
};

/** Per-instance state of the island. */
export type WorldState = {
  /** The hero's props; `undefined` when they are missing, and the hero stays at its first paint. */
  data: HeroData | undefined;
  /** The goal on show. */
  goalId: string;
  /** The progress of every goal, so a switch keeps it. */
  progress: Map<string, AssemblyState>;
  /** How many log lines of the goal on show kernel.log has shown, so a step adds only new ones. */
  logShown: number;
  /** The item whose info card is open. */
  selected: string | undefined;
  /** The element that opened the info card, as a selector, for focus on close. */
  opener: string | undefined;
  /** A piece is in flight; new drops wait. */
  busy: boolean;
  /** The finish of the goal on show is playing: the app is checked, not yet running. */
  finishing: boolean;
  /** Bumped by a switch and by Start over, so a flight or a finish step of before is dropped. */
  epoch: number;
  /** The finish steps waiting to play. */
  timers: Set<ReturnType<typeof setTimeout>>;
  /** The drag in progress. */
  drag: Drag | undefined;
  /** Swallow the click that follows a drag. */
  suppressClick: boolean;
};

/** The island context with its state. */
export type WorldContext = Spa.IslandContext<WorldState>;
