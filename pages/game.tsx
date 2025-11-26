// pages/game.tsx

import { useRouter } from "next/router";
import React, { useEffect, useState, useCallback, useRef } from "react";
import type { GameMode } from "../types/gameMode";
import type { Round } from "../types/round";
import { useDeepgramRecognition } from "../hooks/useDeepgramRecognition";
import { usePlayers } from "../hooks/usePlayers";
import { useVoiceProfiles } from "../hooks/useVoiceProfiles";
import PlayerSetup from "../components/PlayerSetup";

export default function GamePage() {
  const router = useRouter();
  const { mode, category, subcategory } = router.query;
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [showAnswers, setShowAnswers] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  const gameMode = (mode as GameMode) || "party";
  const modeDisplay = gameMode === "party" ? "🎉 Party Mode" : "🏆 Competitive Mode";
  
  const {
    players,
    activePlayer,
    addPlayer,
    removePlayer,
    setActivePlayerByName,
    addScore,
  } = usePlayers();

  const {
    profiles,
    recordVoiceSample,
    identifySpeaker,
    removeProfile,
  } = useVoiceProfiles();

  const [recordingPlayerId, setRecordingPlayerId] = useState<string | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Function to extract player name from transcript (e.g., "John, Oreo" or "It's Sarah, Oreo")
  const extractPlayerName = useCallback(
    (transcript: string): { name: string | null; answer: string } => {
      const normalized = transcript.toLowerCase().trim();
      
      // Pattern 1: "Name, Answer" or "Name Answer"
      for (const player of players) {
        const playerName = player.name.toLowerCase();
        // Check if transcript starts with player name
        if (normalized.startsWith(playerName)) {
          const afterName = normalized.substring(playerName.length).trim();
          // Remove common separators: comma, colon, "says", "here", etc.
          const cleaned = afterName.replace(/^[,:\-]?\s*(says|here|is|answer|answers)?\s*/i, "").trim();
          return { name: player.name, answer: cleaned };
        }
        // Check if transcript contains "it's Name" or "I'm Name"
        const patterns = [
          new RegExp(`(?:it'?s|i'?m|this is|here'?s)\\s+${playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
          new RegExp(`${playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:says|here|answers|answer)`, 'i'),
        ];
        for (const pattern of patterns) {
          if (pattern.test(normalized)) {
            // Extract answer part (everything after the name pattern)
            const match = normalized.match(pattern);
            if (match) {
              const afterMatch = normalized.substring(normalized.indexOf(match[0]) + match[0].length).trim();
              const cleaned = afterMatch.replace(/^[,:\-]?\s*/i, "").trim();
              return { name: player.name, answer: cleaned };
            }
          }
        }
      }
      
      return { name: null, answer: normalized };
    },
    [players]
  );

  // Function to match spoken answer with displayed answers (ultra-lenient matching)
  const matchVoiceAnswer = useCallback(
    (transcript: string, answers: string[]) => {
      const normalizedTranscript = transcript.toLowerCase().trim();
      
      if (normalizedTranscript.length < 2) return null;
      
      // Try exact match first
      for (const answer of answers) {
        if (answer.toLowerCase().trim() === normalizedTranscript) {
          return answer;
        }
      }

      // Try ANY partial match - if transcript appears anywhere in answer or vice versa
      for (const answer of answers) {
        const normalizedAnswer = answer.toLowerCase().trim();
        if (
          normalizedAnswer.includes(normalizedTranscript) ||
          normalizedTranscript.includes(normalizedAnswer)
        ) {
          return answer; // Return immediately on ANY match
        }
      }

      // Try word-by-word matching - ANY word match triggers
      const transcriptWords = normalizedTranscript.split(/\s+/).filter(w => w.length >= 2);
      for (const answer of answers) {
        const answerWords = answer.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);
        
        // Check if ANY word from transcript matches ANY word in answer
        for (const tWord of transcriptWords) {
          for (const aWord of answerWords) {
            if (
              aWord === tWord ||
              aWord.includes(tWord) ||
              tWord.includes(aWord) ||
              aWord.startsWith(tWord) ||
              tWord.startsWith(aWord) ||
              // Even partial character matches
              (tWord.length >= 2 && aWord.length >= 2 && 
               (aWord.substring(0, 2) === tWord.substring(0, 2) ||
                aWord.substring(0, 3) === tWord.substring(0, 3)))
            ) {
              return answer; // Return immediately on ANY match
            }
          }
        }
      }

      // Try character-level matching - if first few characters match
      if (normalizedTranscript.length >= 2) {
        for (const answer of answers) {
          const normalizedAnswer = answer.toLowerCase().trim();
          const transcriptStart = normalizedTranscript.substring(0, Math.min(3, normalizedTranscript.length));
          const answerStart = normalizedAnswer.substring(0, Math.min(3, normalizedAnswer.length));
          
          if (transcriptStart === answerStart && transcriptStart.length >= 2) {
            return answer;
          }
        }
      }

      return null;
    },
    []
  );

  // Capture audio during speech recognition for speaker identification
  useEffect(() => {
    if (gameMode === "competitive" && gameStarted && profiles.length > 0) {
      const setupAudioCapture = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = stream;
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          analyserRef.current = analyser;
        } catch (error) {
          console.error("Error setting up audio capture:", error);
        }
      };
      setupAudioCapture();
    }

    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [gameMode, gameStarted, profiles.length]);

  // Handle voice recognition result with automatic speaker identification
  const handleVoiceResult = useCallback(
    async (transcript: string) => {
      if (!round || showResult) return;

      setVoiceTranscript(transcript);
      
      // In competitive mode, identify speaker automatically
      if (gameMode === "competitive" && players.length > 0 && profiles.length > 0 && analyserRef.current) {
        try {
          // Capture current audio buffer
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Float32Array(bufferLength);
          analyserRef.current.getFloatTimeDomainData(dataArray);
          
          // Create audio buffer for analysis
          const audioBuffer = audioContextRef.current!.createBuffer(
            1,
            bufferLength,
            audioContextRef.current!.sampleRate
          );
          audioBuffer.copyToChannel(dataArray, 0);
          
          // Identify speaker
          const identifiedProfile = await identifySpeaker(audioBuffer);
          
          const matchedAnswer = matchVoiceAnswer(transcript, round.answers);
          
          if (matchedAnswer && identifiedProfile) {
            // Found speaker automatically - give credit
            const player = players.find((p) => p.id === identifiedProfile.id);
            if (player && matchedAnswer === round.correctAnswer) {
              addScore(player.id, 1);
            }
            handleAnswerSelect(matchedAnswer);
          } else if (matchedAnswer) {
            // Answer matched but speaker not identified
            handleAnswerSelect(matchedAnswer);
          }
        } catch (error) {
          console.error("Error identifying speaker:", error);
          // Fallback to regular answer matching
          const matchedAnswer = matchVoiceAnswer(transcript, round.answers);
          if (matchedAnswer) {
            handleAnswerSelect(matchedAnswer);
          }
        }
      } else {
        // Party mode or no profiles - no player tracking
        const matchedAnswer = matchVoiceAnswer(transcript, round.answers);
        if (matchedAnswer) {
          handleAnswerSelect(matchedAnswer);
        }
      }
    },
    [round, showResult, gameMode, players, profiles, matchVoiceAnswer, identifySpeaker, addScore]
  );

  // Note: Deepgram handles multiple speakers through its own diarization if needed

  const { isListening, isSupported, error: voiceError, startListening, stopListening } =
    useDeepgramRecognition({
      onResult: handleVoiceResult,
      continuous: false,
    });

  // Auto-start voice recognition when round loads - always start for new questions
  useEffect(() => {
    if (round && isSupported) {
      // Stop any existing listening first
      stopListening();
      
      // Small delay to ensure everything is ready, then start
      const timer = setTimeout(() => {
        console.log("🎤 Auto-starting voice recognition for new question");
        startListening();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [round?.id, isSupported, startListening, stopListening]); // Use round.id to trigger on new questions

  useEffect(() => {
    // Wait for router to be ready and query params to be available
    if (!router.isReady) {
      setLoading(true);
      return;
    }

    // In competitive mode, wait for game to start
    if (gameMode === "competitive" && !gameStarted) {
      return;
    }

    // If no category/subcategory, redirect back to categories
    if (!category || !subcategory) {
      console.log("Missing category or subcategory, redirecting...", { category, subcategory });
      router.push("/categories");
      return;
    }

    let isMounted = true;

    const fetchRound = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        setError(null);
        stopListening(); // Stop any active listening
        
        console.log("Fetching round with:", { category, subcategory });
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch("/api/round", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category: category as string,
            subcategory: subcategory as string,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log("Response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("API error:", errorData);
          if (isMounted) {
            throw new Error(errorData.error || `Failed to fetch round (${response.status})`);
          }
          return;
        }

        const roundData = await response.json();
        console.log("Round data received:", roundData);
        if (isMounted) {
          setRound(roundData);
        }
      } catch (err) {
        console.error("Error fetching round:", err);
        if (isMounted) {
          if (err instanceof Error && err.name === "AbortError") {
            setError("Request timed out. Please try again.");
          } else {
            setError(err instanceof Error ? err.message : "An error occurred");
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRound();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, category, subcategory, gameMode, gameStarted]);

  const handleNextRound = useCallback(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setVoiceTranscript("");
    // Don't reset showAnswers - keep it in whatever state user set it
    setLoading(true);
    // Don't stop listening here - it will restart automatically when new round loads
    
    // Fetch a new round
    fetch("/api/round", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category: category as string,
        subcategory: subcategory as string,
      }),
    })
      .then((res) => res.json())
      .then((roundData) => {
        setRound(roundData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [category, subcategory, stopListening]);

  const handleAnswerSelect = useCallback((answer: string) => {
    if (showResult) return; // Prevent changing answer after reveal
    // Don't stop listening here - let it continue until next question loads
    setSelectedAnswer(answer);
    setShowResult(true);

    // Track question result in database
    if (round?.id) {
      const answeredCorrectly = answer === round.correctAnswer;
      fetch("/api/question-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: round.id,
          answeredCorrectly,
          playerId: gameMode === "competitive" && activePlayer ? activePlayer : undefined,
        }),
      }).catch((err) => console.error("Error saving question result:", err));
    }

    // Auto-advance to next question if answer is correct
    if (round && answer === round.correctAnswer) {
      setTimeout(() => {
        handleNextRound();
      }, 2000); // Wait 2 seconds to show the correct answer
    }
  }, [round, showResult, stopListening, handleNextRound, gameMode, activePlayer]);

  // Show final scores screen
  if (gameEnded) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">🏆 Final Scores</h1>
            <p className="text-gray-600">Game Over</p>
          </div>

          <div className="space-y-4 mb-8">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`p-4 rounded-lg flex items-center justify-between ${
                  index === 0 ? "bg-yellow-50 border-2 border-yellow-400" : "bg-gray-50"
                }`}
                style={{
                  borderLeft: `6px solid ${player.color}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold w-8">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`}
                  </div>
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="text-xl font-semibold">{player.name}</span>
                </div>
                <span className="text-2xl font-bold">{player.score} {player.score === 1 ? "point" : "points"}</span>
              </div>
            ))}
          </div>

          {winner && (
            <div className="text-center mb-6 p-4 bg-yellow-100 rounded-lg">
              <p className="text-2xl font-bold text-yellow-800">
                🎉 Winner: {winner.name} 🎉
              </p>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setGameEnded(false);
                setGameStarted(false);
                router.push("/mode");
              }}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
            >
              New Game
            </button>
            <button
              onClick={() => router.push("/mode")}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
            >
              Back to Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show player setup in competitive mode if game hasn't started
  if (gameMode === "competitive" && !gameStarted) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold mb-2">🏆 Competitive Mode</h1>
            <p className="text-gray-600">Register players to track scores</p>
          </div>
          <PlayerSetup
            players={players}
            onAddPlayer={addPlayer}
            onRemovePlayer={(playerId) => {
              removePlayer(playerId);
              removeProfile(playerId);
            }}
            onStart={() => setGameStarted(true)}
            onRecordVoice={async (playerId, playerName) => {
              setRecordingPlayerId(playerId);
              await recordVoiceSample(playerId, playerName);
              setRecordingPlayerId(null);
            }}
            recordingPlayerId={recordingPlayerId}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎮</div>
          <p className="text-xl text-gray-700">Loading question...</p>
          <p className="text-sm text-gray-500 mt-4">
            Category: {category || "..."} | Subcategory: {subcategory || "..."}
          </p>
          <p className="text-xs text-gray-400 mt-2">Check browser console (F12) for details</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-xl text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/categories")}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            Back to Categories
          </button>
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-xl text-gray-700">Preparing question...</p>
          <p className="text-sm text-gray-500 mt-2">Category: {category || "loading..."}</p>
          <p className="text-sm text-gray-500">Subcategory: {subcategory || "loading..."}</p>
        </div>
      </div>
    );
  }

  // Use answers in original order (no shuffling)
  const answers = round.answers;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                if (gameMode === "competitive") {
                  setGameEnded(true);
                } else {
                  router.push("/mode");
                }
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              {gameMode === "competitive" ? "End Game" : "Back to Start"}
            </button>
            <h1 className="text-3xl font-bold">Cabin Trivia</h1>
            <div className="w-24"></div> {/* Spacer for centering */}
          </div>
          <p className="text-gray-600">{modeDisplay}</p>
          
          {/* Scoreboard for competitive mode */}
          {gameMode === "competitive" && players.length > 0 && (
            <div className="mt-4 bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Scores</h3>
              <div className="flex flex-wrap gap-3 justify-center">
                {players
                  .sort((a, b) => b.score - a.score)
                  .map((player) => (
                    <div
                      key={player.id}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        activePlayer === player.id ? "ring-2 ring-blue-500" : ""
                      }`}
                      style={{
                        backgroundColor: `${player.color}20`,
                        borderLeft: `4px solid ${player.color}`,
                      }}
                    >
                      <span className="font-semibold">{player.name}</span>
                      <span className="text-lg font-bold">{player.score}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Voice Status */}
        {isSupported && (
          <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isListening && !showResult ? (
                  <>
                    <span className="text-2xl animate-pulse">🔴</span>
                    <span className="text-lg font-semibold text-gray-700">
                      Listening for your answer...
                    </span>
                  </>
                ) : showResult ? (
                  <>
                    <span className="text-2xl">🎤</span>
                    <span className="text-lg font-semibold text-gray-600">
                      Voice recognition paused
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🎤</span>
                    <span className="text-lg font-semibold text-gray-600">
                      Starting voice recognition...
                    </span>
                  </>
                )}
              </div>
              {!showResult && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {isListening ? "Stop" : "Restart"}
                </button>
              )}
            </div>
            {voiceTranscript && !showResult && (
              <div className="mt-2 text-sm text-gray-600 italic">
                Heard: &quot;{voiceTranscript}&quot;
              </div>
            )}
          </div>
        )}

        {!isSupported && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-center text-sm text-yellow-800">
            Voice recognition not supported in this browser. Please use a modern browser with microphone access.
          </div>
        )}
        {voiceError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-center text-sm text-red-800">
            ⚠️ {voiceError}
          </div>
        )}

        {/* Question */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-2xl font-semibold text-center flex-1">{round.question}</h2>
              {!showResult && (
                <button
                  onClick={() => setShowAnswers(!showAnswers)}
                  className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition whitespace-nowrap"
                  title={showAnswers ? "Hide answers" : "Show answers"}
                >
                  {showAnswers ? "🙈 Hide" : "👁️ Show"}
                </button>
              )}
            </div>
          </div>

          {/* Answers */}
          {showAnswers || showResult ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {answers.map((answer, index) => {
              const isSelected = selectedAnswer === answer;
              const isCorrect = answer === round.correctAnswer;
              const showCorrect = showResult && isCorrect;
              const showIncorrect = showResult && isSelected && !isCorrect;

              let buttonClass = "p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ";
              
              if (showResult) {
                if (showCorrect) {
                  buttonClass += "bg-green-100 border-green-500 text-green-800";
                } else if (showIncorrect) {
                  buttonClass += "bg-red-100 border-red-500 text-red-800";
                } else {
                  buttonClass += "bg-gray-50 border-gray-300 text-gray-600";
                }
              } else {
                buttonClass += isSelected
                  ? "bg-blue-100 border-blue-500"
                  : "bg-white border-gray-300 hover:border-blue-300";
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(answer)}
                  disabled={showResult}
                  className={buttonClass}
                >
                  <div className="flex items-center justify-between">
                    <span>{answer}</span>
                    {showCorrect && <span className="text-2xl">✓</span>}
                    {showIncorrect && <span className="text-2xl">✗</span>}
                  </div>
                </button>
              );
            })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">
                Answers are hidden. Answer by voice or click "Show" to reveal options.
              </p>
            </div>
          )}
        </div>

        {/* Next Round Button */}
        {showResult && (
          <div className="text-center">
            <button
              onClick={handleNextRound}
              className="bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 text-lg font-semibold"
            >
              Next Question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

