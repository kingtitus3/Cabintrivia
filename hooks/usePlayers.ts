// hooks/usePlayers.ts

import { useState, useCallback } from "react";
import type { Player } from "../types/player";

const PLAYER_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);

  const addPlayer = useCallback((name: string) => {
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return null; // Player already exists
    }

    const newPlayer: Player = {
      id: `player-${Date.now()}-${Math.random()}`,
      name: name.trim(),
      color: PLAYER_COLORS[players.length % PLAYER_COLORS.length],
      score: 0,
    };

    setPlayers((prev) => [...prev, newPlayer]);
    return newPlayer;
  }, [players]);

  const removePlayer = useCallback((playerId: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    if (activePlayer === playerId) {
      setActivePlayer(null);
    }
  }, [activePlayer]);

  const setActivePlayerById = useCallback((playerId: string | null) => {
    setActivePlayer(playerId);
  }, []);

  const setActivePlayerByName = useCallback((name: string) => {
    const player = players.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (player) {
      setActivePlayer(player.id);
      return player;
    }
    return null;
  }, [players]);

  const addScore = useCallback((playerId: string, points: number = 1) => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId ? { ...p, score: p.score + points } : p
      )
    );
  }, []);

  const resetScores = useCallback(() => {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
  }, []);

  return {
    players,
    activePlayer,
    addPlayer,
    removePlayer,
    setActivePlayerById,
    setActivePlayerByName,
    addScore,
    resetScores,
  };
}

