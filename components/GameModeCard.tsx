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
      className="bg-white shadow-md hover:shadow-xl transition rounded-xl p-8 text-center border border-gray-200 flex flex-col items-center justify-center cursor-pointer w-full max-w-sm"
    >
      <div className="text-5xl mb-4">{mode.emoji}</div>
      <div className="text-2xl font-bold mb-2">{mode.name}</div>
      <div className="text-gray-600 text-sm">{mode.description}</div>
    </button>
  );
}

