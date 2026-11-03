/**
 * @file The `kernel-world` island: the hero's assembly made playable.
 *
 * The hero is rendered at build in the start state of its first goal. The island keeps the
 * progress of every goal, runs a drop through the pure rules of `src/lib/assembly.ts`, and draws
 * the result with the same nodes the build drew (`src/lib/hero-view.ts`). Its parts live in
 * `./kernel-world/`: `render` paints, `info` runs the info card, `actions` adds pieces and plays
 * the finish, `drag` handles a drag, `flight` moves the flyer, `handlers` wires it all.
 */
import { createIsland } from "@moku-labs/web/browser";
import { createWorldState, mountWorld, worldEvents } from "./kernel-world/handlers";

/**
 * The hero's kernel world: pick a goal, add its pieces by tap, Enter or drag onto the kernel; a
 * piece lands on its layer or waits for its need, the code card grows the real `createApp`
 * call, and when every need is met the app cube rises. Listeners are declared in `events` (and
 * the page-wide click in `onMount`), so the framework removes them on destroy.
 */
export const kernelWorldIsland = createIsland("kernel-world", {
  state: createWorldState,
  onMount: mountWorld,
  events: worldEvents
});
