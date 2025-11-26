// components/GameModeCard.tsx

import React from "react";
import type { GameModeInfo } from "../types/gameMode";

interface Props {
  mode: GameModeInfo;
  onSelect: (mode: GameModeInfo) => void;
}

export default function GameModeCard({ mode, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(mode)}
      className="cabin-panel w-full max-w-sm px-7 py-7 text-left transition transform hover:-translate-y-1 hover:shadow-2xl hover:border-amber-400/60"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-800/90 border border-slate-700/80 text-2xl">
          {mode.emoji}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-50 mb-1">
            {mode.name}
          </h2>
          <p className="text-xs uppercase tracking-[0.16em] text-amber-300 mb-2">
            {mode.id === "party" ? "Laid-back • All play" : "Head-to-head • Scoreboard"}
          </p>
          <p className="text-sm text-slate-300 leading-snug">{mode.description}</p>
        </div>
      </div>
    </button>
  );
}

