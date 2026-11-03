import { type } from "@moku-labs/game";
import { defineNode } from "./state";

export const home = defineNode({
  outcomes: { roll: type(), reset: type() },
  rest: true,
  checkpoint: true
});

export const roll = defineNode({
  outcomes: { done: type() },
  run: ({ player, session, rng, out }) => {
    const face = rng.stream("dice").range(1, 6);

    player.coins += face;
    player.lastRoll = face;
    session.rolls += 1;
    return out.done();
  }
});

export const reset = defineNode({
  outcomes: { done: type() },
  run: ({ player, out }) => {
    player.coins = 0;
    return out.done();
  }
});
