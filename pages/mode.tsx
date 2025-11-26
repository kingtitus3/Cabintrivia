// pages/mode.tsx

import React from "react";
import { useRouter } from "next/router";
import { gameModes } from "../data/gameModes";
import GameModeCard from "../components/GameModeCard";
import type { GameModeInfo } from "../types/gameMode";

export default function ModeSelectionPage() {
  const router = useRouter();

  const handleModeSelect = (mode: GameModeInfo) => {
    router.push({
      pathname: "/categories",
      query: {
        mode: mode.id,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-center mb-8">Choose Your Game Mode</h1>

      <div className="flex flex-col md:flex-row gap-8 max-w-4xl w-full justify-center">
        {gameModes.map((mode) => (
          <GameModeCard key={mode.id} mode={mode} onSelect={handleModeSelect} />
        ))}
      </div>
    </div>
  );
}

