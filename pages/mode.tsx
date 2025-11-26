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
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <p className="cabin-chip mx-auto mb-3">Choose Your Night</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            How do you want to play tonight?
          </h1>
          <p className="mt-3 text-slate-400 text-sm md:text-base">
            Cozy up in the cabin, grab some friends, and pick a vibe – chill
            party questions or full-on competitive chaos.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 md:gap-8 justify-center">
          {gameModes.map((mode) => (
            <GameModeCard key={mode.id} mode={mode} onSelect={handleModeSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

