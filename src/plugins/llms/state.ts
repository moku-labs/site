/**
 * @file Initial state of the llms plugin.
 */
import type { LlmsState } from "./types";

/**
 * Create the empty state: no build has written the agent files yet.
 *
 * @returns State with no write in hand.
 */
export function createLlmsState(): LlmsState {
  return { pending: undefined };
}
