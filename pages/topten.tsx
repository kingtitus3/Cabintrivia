// pages/topten.tsx

import { useRouter } from "next/router";
import React, { useEffect, useState, useCallback } from "react";
import type { GameMode } from "../types/gameMode";
import type { TopTenRound } from "../types/topTenRound";
import { useVoiceRecognition } from "../hooks/useVoiceRecognition";

// Helper to strip obvious repetition/noise from the running transcript
const condenseTranscript = (input: string): string => {
  if (!input) return "";
  const words = input.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return input.trim();

  const condensed: string[] = [];
  for (const word of words) {
    const last = condensed[condensed.length - 1];
    if (!last || last.toLowerCase() !== word.toLowerCase()) {
      condensed.push(word);
    }
  }
  return condensed.join(" ");
};

// Normalization helpers for matching
const normalizeForMatch = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP_WORDS = new Set(["the", "and", "of", "in", "on", "at", "for", "to", "a", "an"]);

export default function TopTenPage() {
  const router = useRouter();
  const { mode, category, subcategory } = router.query;
  const [round, setRound] = useState<TopTenRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [foundItems, setFoundItems] = useState<Set<string>>(new Set());
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [fullTranscript, setFullTranscript] = useState<string>(""); // Running transcript of everything said
  const [showAllAnswers, setShowAllAnswers] = useState(false);

  const gameMode = (mode as GameMode) || "party";
  const modeDisplay = gameMode === "party" ? "🎉 Party Mode" : "🏆 Competitive Mode";

  // Find all clearly matching items in the transcript (prioritizing clear word hits)
  const matchVoiceAnswers = useCallback(
    (transcript: string, listItems: string[], alreadyFound: Set<string>): string[] => {
      const cleanTranscript = normalizeForMatch(transcript);
      
      if (cleanTranscript.length < 1) {
        if (process.env.NODE_ENV === "development") {
          console.log(`❌ Transcript too short: "${transcript}"`);
        }
        return [];
      }

      const phraseWords = cleanTranscript
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

      if (!phraseWords.length) {
        if (process.env.NODE_ENV === "development") {
          console.log(`⚠️ No strong words in phrase: "${cleanTranscript}"`);
        }
        return [];
      }

      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Matching words:", phraseWords, "against", listItems);
      }
      const matches: string[] = [];

      const tryAddMatch = (item: string, reason: string) => {
        if (alreadyFound.has(item)) return;
        if (matches.includes(item)) return;
        if (process.env.NODE_ENV === "development") {
          console.log(`✅ ${reason}: "${transcript}" → "${item}"`);
        }
        matches.push(item);
      };

      for (const item of listItems) {
        if (alreadyFound.has(item)) continue;

        const normalizedItem = normalizeForMatch(item);
        const itemWords = normalizedItem
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

        if (!itemWords.length) continue;

        // If this is a simple one-word item (e.g. "Snickers", "Twix"), then
        // a single exact word hit is enough to count it as found.
        if (itemWords.length === 1 && phraseWords.includes(itemWords[0])) {
          tryAddMatch(item, "Single-word exact hit");
          continue;
        }

        // For multi-word items, count overlaps and require at least ~half the key words
        let overlap = 0;
        for (const iWord of itemWords) {
          if (phraseWords.includes(iWord)) {
            overlap++;
          }
        }

        if (overlap === 0) continue;

        const coverage = overlap / itemWords.length;
        if (coverage >= 0.5) {
          tryAddMatch(item, `Multi-word coverage ${overlap}/${itemWords.length} (${coverage.toFixed(2)})`);
        }
      }

      if (!matches.length) {
        console.log(`❌ No match for "${transcript}". Available: ${listItems.join(", ")}`);
      } else {
        console.log(`📦 Matches this phrase: ${matches.join(", ")}`);
      }

      // Safety: avoid lighting up everything from one noisy phrase; cap to 4 per shout.
      return matches.slice(0, 4);
    },
    []
  );

  // Handle voice recognition result
  const handleVoiceResult = useCallback(
    (transcript: string) => {
      if (!round) {
        console.log("⚠️ No round available");
        return;
      }

      console.log("🎤 Voice result received:", transcript);
      const cleanedPhrase = condenseTranscript(transcript);

      // Ignore extremely short/noisy phrases
      if (cleanedPhrase.replace(/[^a-z0-9]/gi, "").length < 2) {
        console.log(`⚠️ Ignoring very short/noisy phrase: "${cleanedPhrase}"`);
        return;
      }

      setVoiceTranscript(cleanedPhrase);
      const combinedTranscript = fullTranscript
        ? condenseTranscript(`${fullTranscript} ${cleanedPhrase}`)
        : cleanedPhrase;
      setFullTranscript((prev) =>
        prev ? condenseTranscript(`${prev} ${cleanedPhrase}`) : cleanedPhrase
      );
      
      // Find all clear matches in just this phrase, ignoring already-found items
      setFoundItems((prev) => {
        const matches = matchVoiceAnswers(cleanedPhrase, round.listItems, prev);

        if (!matches.length) {
          console.log(`❌ No new matches for: "${transcript}"`);
          console.log("📋 Available items:", round.listItems);
          return prev;
        }

        const newSet = new Set(prev);
        for (const item of matches) {
          if (!newSet.has(item)) {
            newSet.add(item);
          }
        }

        console.log(`📊 Progress: ${newSet.size} / ${round.listItems.length} found`);

        // Update database when all items are found
        if (round.id && newSet.size === round.listItems.length) {
          console.log("🏆 All items found! Updating database...");
          fetch("/api/question-result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: round.id,
              answeredCorrectly: true,
            }),
          }).catch((err) => console.error("Error saving question result:", err));
        }

        return newSet;
      });

      // Clear only the last-phrase view; keep full transcript visible for the round
      setVoiceTranscript("");
    },
    [round, matchVoiceAnswers, fullTranscript]
  );

  const { isListening, isSupported, startListening, stopListening } =
    useVoiceRecognition({
      onResult: handleVoiceResult,
      continuous: true, // Keep listening for multiple answers
      interimResults: false,
    });

  // Auto-start voice recognition when round loads - always start for new rounds
  useEffect(() => {
    if (round && isSupported) {
      // Stop any existing listening first
      stopListening();
      
      // Small delay to ensure everything is ready, then start
      const timer = setTimeout(() => {
        console.log("🎤 Auto-starting voice recognition for new round");
        startListening();
      }, 300);
      return () => clearTimeout(timer);
    }
    // Use round.id to trigger on new rounds only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, isSupported, startListening, stopListening]);

  useEffect(() => {
    if (!router.isReady) {
      setLoading(true);
      return;
    }

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
        setFoundItems(new Set());
        setVoiceTranscript("");
        setFullTranscript(""); // Clear transcript for new round
        
        if (process.env.NODE_ENV === "development") {
          console.log("Fetching top ten list with:", { category, subcategory });
        }
        
        const response = await fetch("/api/topten", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category: category as string,
            subcategory: subcategory as string,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("API error:", errorData);
          throw new Error(errorData.error || `Failed to fetch list (${response.status})`);
        }

        const roundData = await response.json();
        if (isMounted) {
          setRound(roundData);
        }
      } catch (err) {
        console.error("Error fetching top ten list:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "An error occurred");
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
  }, [router.isReady, category, subcategory]);

  const handleNextRound = useCallback(() => {
    setFoundItems(new Set());
    setVoiceTranscript("");
    setFullTranscript(""); // Clear transcript for new round
    setShowAllAnswers(false); // Reset show answers for new round
    setLoading(true);
    stopListening();
    
    fetch("/api/topten", {
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

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-4">
        <div className="cabin-panel px-8 py-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">🔟</div>
          <p className="text-xl font-semibold text-slate-100">Loading top 10 list...</p>
          <p className="text-sm text-slate-400 mt-4">
            Category: {category || "..."} | Subcategory: {subcategory || "..."}
          </p>
          <p className="text-xs text-slate-500 mt-2">Check browser console (F12) for details</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center px-4">
        <div className="cabin-panel px-8 py-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-xl font-semibold text-red-300 mb-2">Something went wrong</p>
          <p className="text-sm text-red-200 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                // Retry fetch
                fetch("/api/topten", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    category: category as string,
                    subcategory: subcategory as string,
                  }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.error) {
                      setError(data.error);
                    } else {
                      setRound(data);
                      setError(null);
                    }
                    setLoading(false);
                  })
                  .catch((err) => {
                    setError(err.message);
                    setLoading(false);
                  });
              }}
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/categories")}
              className="inline-flex items-center justify-center rounded-lg bg-slate-800/90 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
            >
              Back to Categories
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!round) {
    return null;
  }

  const progress = foundItems.size;
  const allFound = progress === 10;

  return (
    <div className="min-h-[calc(100vh-6rem)] py-4">
      <div className="cabin-panel px-5 py-6 md:px-8 md:py-8 max-w-3xl mx-auto">
        {/* Header / Controls */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <button
              onClick={() => router.push("/mode")}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <span className="text-sm">←</span>
              <span>Back to start</span>
            </button>

            <div className="text-right">
              <div className="cabin-chip mb-1 inline-flex">
                <span className="mr-1">🔥</span>
                {modeDisplay}
              </div>
              <div className="flex flex-wrap justify-end gap-1 text-[11px] text-slate-400">
                {category && (
                  <span className="cabin-tag">
                    <span className="text-emerald-300">Category</span>· {category}
                  </span>
                )}
                {subcategory && (
                  <span className="cabin-tag">
                    <span className="text-sky-300">Pack</span>· {subcategory}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="text-center mb-4">
            <div className="text-2xl font-bold text-amber-300">
              {progress} / 10 Found
            </div>
          </div>
        </div>

        {/* Voice Status */}
        {isSupported && (
          <div className="mb-4 rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {isListening && foundItems.size < 10 ? (
                  <>
                    <span className="text-xl animate-pulse">🔴</span>
                    <div className="text-sm">
                      <p className="font-semibold text-slate-100">
                        Listening for your next shout… ({foundItems.size} found)
                      </p>
                      {voiceTranscript && (
                        <p className="mt-1 text-xs text-slate-400 italic">
                          Heard: &quot;{voiceTranscript}&quot;
                        </p>
                      )}
                    </div>
                  </>
                ) : allFound ? (
                  <>
                    <span className="text-xl">🎉</span>
                    <p className="text-sm font-semibold text-slate-300">
                      All items found — get ready for the next list!
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-xl">🎤</span>
                    <p className="text-sm font-semibold text-slate-300">
                      Tap restart if the cabin gets too loud.
                    </p>
                  </>
                )}
              </div>
              {!allFound && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline"
                >
                  {isListening ? "Pause listening" : "Restart listening"}
                </button>
              )}
            </div>
            {fullTranscript && (
              <div className="mt-2 max-h-16 overflow-y-auto rounded-md bg-slate-950/70 px-3 py-2 text-[11px] text-slate-400">
                <div className="mb-1 font-semibold text-slate-300 text-[11px]">
                  Cabin transcript
                </div>
                <p>{fullTranscript}</p>
              </div>
            )}
          </div>
        )}
        {!isSupported && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-100">
            Voice recognition isn't available in this browser. Try Chrome or Edge for the full
            Cabin Trivia experience.
          </div>
        )}

        {/* Question */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 px-5 py-6 mb-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight flex-1 text-slate-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {round.question}
            </h2>
            {!allFound && (
              <button
                onClick={() => setShowAllAnswers(!showAllAnswers)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                title={showAllAnswers ? "Hide answers" : "Show all answers"}
              >
                <span>{showAllAnswers ? "🙈" : "👁️"}</span>
                <span>{showAllAnswers ? "Hide options" : "Show options"}</span>
              </button>
            )}
          </div>

          {/* Top 10 List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {round.listItems.map((item, index) => {
              const isFound = foundItems.has(item);
              const shouldShow = isFound || showAllAnswers;
              return (
                <div
                  key={index}
                  className={`p-3.5 md:p-4 rounded-xl border-2 transition-all ${
                    isFound
                      ? "bg-emerald-500/15 border-emerald-400 text-emerald-100 shadow-md shadow-emerald-500/20"
                      : showAllAnswers
                      ? "bg-amber-500/10 border-amber-400/60 text-amber-200"
                      : "bg-slate-900/80 border-slate-700/80 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base md:text-lg font-bold mr-2">#{index + 1}</span>
                    <span className="flex-1 text-sm md:text-base">{shouldShow ? item : "???"}</span>
                    {isFound && <span className="text-xl ml-2">✓</span>}
                    {showAllAnswers && !isFound && (
                      <span className="text-xs ml-2 text-amber-400">(not found)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion Message */}
        {allFound && (
          <div className="rounded-2xl border border-emerald-500/60 bg-emerald-500/15 px-6 py-6 mb-4 text-center shadow-md shadow-emerald-500/20">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-2xl font-bold text-emerald-100">All 10 items found!</p>
          </div>
        )}

        {/* Next Round Button */}
        {allFound && (
          <div className="text-center">
            <button
              onClick={handleNextRound}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-8 py-3 text-sm md:text-base font-semibold text-slate-900 hover:bg-amber-400"
            >
              <span>New List</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

