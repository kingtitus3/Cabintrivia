// components/PlayerSetup.tsx

import React, { useState } from "react";
import type { Player } from "../types/player";

interface Props {
  players: Player[];
  onAddPlayer: (name: string) => Player | null;
  onRemovePlayer: (playerId: string) => void;
  onStart: () => void;
  onRecordVoice?: (playerId: string, playerName: string) => Promise<void>;
  recordingPlayerId?: string | null;
}

export default function PlayerSetup({ 
  players, 
  onAddPlayer, 
  onRemovePlayer, 
  onStart,
  onRecordVoice,
  recordingPlayerId,
}: Props) {
  const [newPlayerName, setNewPlayerName] = useState("");

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlayerName.trim()) {
      const player = onAddPlayer(newPlayerName);
      if (!player) {
        alert("Player name already exists!");
      }
      setNewPlayerName("");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">Add Players</h2>

      <form onSubmit={handleAddPlayer} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Enter player name"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Add
          </button>
        </div>
      </form>

      <div className="space-y-2 mb-4">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between p-3 border rounded-lg"
            style={{ borderLeftColor: player.color, borderLeftWidth: "4px" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: player.color }}
              />
              <span className="font-semibold">{player.name}</span>
              {onRecordVoice && (
                <button
                  onClick={() => onRecordVoice(player.id, player.name)}
                  disabled={recordingPlayerId !== null}
                  className={`text-xs px-2 py-1 rounded ${
                    recordingPlayerId === player.id
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  {recordingPlayerId === player.id ? "🎤 Recording..." : "🎤 Record Voice"}
                </button>
              )}
            </div>
            <button
              onClick={() => onRemovePlayer(player.id)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {players.length > 0 && (
        <button
          onClick={onStart}
          className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 font-semibold text-lg"
        >
          Start Game ({players.length} {players.length === 1 ? "player" : "players"})
        </button>
      )}

      {players.length === 0 && (
        <p className="text-center text-gray-500 text-sm">
          Add at least one player to start
        </p>
      )}
    </div>
  );
}

