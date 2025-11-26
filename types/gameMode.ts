// types/gameMode.ts

export type GameMode = "party" | "competitive";

export interface GameModeInfo {
  id: GameMode;
  name: string;
  description: string;
  emoji: string;
}

