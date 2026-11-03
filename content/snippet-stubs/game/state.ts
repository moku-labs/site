import { defineGame } from "@moku-labs/game";
import type { Strings } from "./generated/strings";

export type Player = { coins: number; lastRoll: number };
export type Session = { rolls: number };

export const {
  defineNode,
  defineFlow,
  defineFeature,
  projection,
  defineComponent,
  defineAnimation,
  defineTextStyles,
  defineScene,
  popup,
  tr
} = defineGame<{
  player: Player;
  session: Session;
  assets: string;
  strings: Strings;
}>();
