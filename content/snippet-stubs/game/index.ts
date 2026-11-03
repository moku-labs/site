import { defineGameApp } from "@moku-labs/game/app";
import { mainFlow } from "./flow";

export default defineGameApp({
  flow: mainFlow,
  safeNode: "home",
  player: { coins: 0, lastRoll: 0 },
  session: { rolls: 0 }
});
