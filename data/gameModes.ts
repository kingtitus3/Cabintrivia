// data/gameModes.ts

import type { GameModeInfo } from "../types/gameMode";

export const gameModes: GameModeInfo[] = [
  {
    id: "party",
    name: "Party Mode",
    description: "Fun, casual gameplay for groups",
    emoji: "🎉",
  },
  {
    id: "competitive",
    name: "Competitive Mode",
    description: "Score-based competition with rankings",
    emoji: "🏆",
  },
];

