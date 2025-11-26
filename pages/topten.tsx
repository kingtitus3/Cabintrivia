// pages/topten.tsx

import { useRouter } from "next/router";
import React, { useEffect, useState, useCallback } from "react";
import type { GameMode } from "../types/gameMode";
import type { TopTenRound } from "../types/topTenRound";
import { useDeepgramRecognition } from "../hooks/useDeepgramRecognition";

export default function TopTenPage() {
  const router = useRouter();
  const { mode, category, subcategory } = router.query;
  const [round, setRound] = useState<TopTenRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [foundItems, setFoundItems] = useState<Set<string>>(new Set());
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [showAllAnswers, setShowAllAnswers] = useState(false);

  const gameMode = (mode as GameMode) || "party";
  const modeDisplay = gameMode === "party" ? "🎉 Party Mode" : "🏆 Competitive Mode";

  // Function to match spoken answer with list items (ultra-lenient matching)
  const matchVoiceAnswer = useCallback(
    (transcript: string, listItems: string[]): string | null => {
      const normalizedTranscript = transcript.toLowerCase().trim();
      
      // Remove common filler words and punctuation
      const cleanTranscript = normalizedTranscript
        .replace(/^(the|a|an|its|it's|i|is|are|was|were)\s+/i, "")
        .replace(/[.,!?;:]/g, "")
        .trim();
      
      if (cleanTranscript.length < 1) return null;
      
      console.log("🔍 Matching transcript:", cleanTranscript, "against", listItems);
      
      // Try exact match first
      for (const item of listItems) {
        const normalizedItem = item.toLowerCase().trim();
        if (normalizedItem === normalizedTranscript || normalizedItem === cleanTranscript) {
          console.log("✅ Exact match:", item);
          return item;
        }
      }

      // Try ANY substring match - if transcript appears anywhere in item or vice versa
      for (const item of listItems) {
        const normalizedItem = item.toLowerCase().trim();
        const cleanItem = normalizedItem.replace(/^(the|a|an)\s+/i, "").trim();
        
        // If ANY part matches, return it (even 1 character if long enough)
        if (cleanTranscript.length >= 2 && cleanItem.length >= 2) {
          if (
            cleanItem.includes(cleanTranscript) ||
            cleanTranscript.includes(cleanItem) ||
            normalizedItem.includes(normalizedTranscript) ||
            normalizedTranscript.includes(normalizedItem)
          ) {
            console.log("✅ Substring match:", item, "for transcript:", cleanTranscript);
            return item;
          }
        }
      }

      // Try word-by-word matching - ANY word match triggers
      const transcriptWords = cleanTranscript.split(/\s+/).filter(w => w.length >= 1);
      
      for (const item of listItems) {
        const normalizedItem = item.toLowerCase().trim();
        const itemWords = normalizedItem.split(/\s+/).filter(w => w.length >= 1);
        
        // Check if ANY word from transcript matches ANY word in item
        for (const tWord of transcriptWords) {
          for (const iWord of itemWords) {
            // Ultra-lenient: if words share ANY characters or one contains the other
            const firstTwoMatch = tWord.length >= 1 && iWord.length >= 1 && 
              iWord.substring(0, Math.min(2, iWord.length)) === tWord.substring(0, Math.min(2, tWord.length));
            const firstThreeMatch = tWord.length >= 1 && iWord.length >= 1 && 
              iWord.substring(0, Math.min(3, iWord.length)) === tWord.substring(0, Math.min(3, tWord.length));
            const endsWithMatch1 = iWord.length >= 3 && tWord.length >= 3 && 
              iWord.endsWith(tWord.substring(Math.max(0, tWord.length - 3)));
            const endsWithMatch2 = tWord.length >= 3 && iWord.length >= 3 && 
              tWord.endsWith(iWord.substring(Math.max(0, iWord.length - 3)));
            
            if (
              iWord === tWord ||
              iWord.includes(tWord) ||
              tWord.includes(iWord) ||
              iWord.startsWith(tWord) ||
              tWord.startsWith(iWord) ||
              firstTwoMatch ||
              firstThreeMatch ||
              endsWithMatch1 ||
              endsWithMatch2
            ) {
              console.log("✅ Word match:", item, "matched word:", tWord, "with", iWord);
              return item; // Return immediately on ANY match
            }
          }
        }
      }

      // Try character-level matching - if first few characters match
      if (cleanTranscript.length >= 1) {
        for (const item of listItems) {
          const normalizedItem = item.toLowerCase().trim();
          const cleanItem = normalizedItem.replace(/^(the|a|an)\s+/i, "").trim();
          
          // Check if first 2-4 characters match (very lenient)
          for (let len = 2; len <= Math.min(4, cleanTranscript.length, cleanItem.length); len++) {
            const transcriptStart = cleanTranscript.substring(0, len);
            const itemStart = cleanItem.substring(0, len);
            
            if (transcriptStart === itemStart && transcriptStart.length >= 2) {
              console.log("✅ Start match:", item, "start:", transcriptStart);
              return item;
            }
          }
          
          // Check if transcript ends match
          if (cleanTranscript.length >= 2 && cleanItem.length >= 2) {
            for (let len = 2; len <= Math.min(4, cleanTranscript.length, cleanItem.length); len++) {
              const transcriptEnd = cleanTranscript.substring(Math.max(0, cleanTranscript.length - len));
              const itemEnd = cleanItem.substring(Math.max(0, cleanItem.length - len));
              if (transcriptEnd === itemEnd) {
                console.log("✅ End match:", item, "end:", transcriptEnd);
                return item;
              }
            }
          }
        }
      }

      // Last resort: check if any part of any word matches
      const allTranscriptChars = cleanTranscript.replace(/\s+/g, "");
      for (const item of listItems) {
        const normalizedItem = item.toLowerCase().trim();
        const allItemChars = normalizedItem.replace(/\s+/g, "");
        
        // If transcript characters appear in order in item (fuzzy sequence match)
        if (allTranscriptChars.length >= 2 && allItemChars.includes(allTranscriptChars.substring(0, Math.min(3, allTranscriptChars.length)))) {
          console.log("✅ Character sequence match:", item);
          return item;
        }
      }

      console.log("❌ No match found for:", cleanTranscript);
      return null;
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
      setVoiceTranscript(transcript);
      
      const matchedItem = matchVoiceAnswer(transcript, round.listItems);

      if (matchedItem) {
        console.log(`✅ Match found: "${transcript}" → "${matchedItem}"`);
        
        // Add to found items using functional update to avoid dependency
        setFoundItems((prev) => {
          if (prev.has(matchedItem)) {
            console.log(`⚠️ Item "${matchedItem}" already found, skipping`);
            return prev; // Already found, don't update
          }
          
          // Found a new item!
          console.log(`🎉 Adding new item to found list: "${matchedItem}"`);
          const newSet = new Set([...prev, matchedItem]);
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
      } else {
        // Log when no match is found for debugging
        console.log(`❌ No match for: "${transcript}"`);
        console.log("📋 Available items:", round.listItems);
        console.log("🔍 Trying to match against:", round.listItems.map(item => item.toLowerCase()));
      }
    },
    [round, matchVoiceAnswer]
  );

  const { isListening, isSupported, error: voiceError, startListening, stopListening } =
    useDeepgramRecognition({
      onResult: handleVoiceResult,
      continuous: true, // Keep listening for multiple answers
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
        // Don't stop listening here - it will restart automatically when new round loads
        setFoundItems(new Set());
        
        console.log("Fetching top ten list with:", { category, subcategory });
        
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

        console.log("Response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("API error:", errorData);
          throw new Error(errorData.error || `Failed to fetch list (${response.status})`);
        }

        const roundData = await response.json();
        console.log("Top ten list data received:", roundData);
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
  }, [category, subcategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔟</div>
          <p className="text-xl text-gray-700">Loading top 10 list...</p>
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
          <p className="text-xl text-red-600 mb-4 font-bold">Error Loading List</p>
          <p className="text-sm text-red-500 mb-4 bg-red-50 p-3 rounded">{error}</p>
          <p className="text-xs text-gray-500 mb-4">
            Category: {category || "N/A"} | Subcategory: {subcategory || "N/A"}
          </p>
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
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/categories")}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
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
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2">Top 10 Lists</h1>
          <p className="text-gray-600">{modeDisplay}</p>
          <div className="mt-4 text-2xl font-bold text-blue-600">
            {progress} / 10 Found
          </div>
        </div>

        {/* Voice Status */}
        {isSupported && (
          <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isListening ? (
                  <>
                    <span className="text-2xl animate-pulse">🔴</span>
                    <span className="text-lg font-semibold text-gray-700">
                      Listening for answers... ({foundItems.size} found)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🎤</span>
                    <span className="text-lg font-semibold text-gray-600">
                      Voice recognition stopped. Click Start to resume.
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={isListening ? stopListening : startListening}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                {isListening ? "Stop" : "Start Listening"}
              </button>
            </div>
            {voiceTranscript && (
              <div className="mt-2 text-sm text-gray-600 italic">
                Heard: &quot;{voiceTranscript}&quot;
              </div>
            )}
            {!isListening && foundItems.size < 10 && (
              <div className="mt-2 text-xs text-yellow-600">
                ⚠️ Voice recognition stopped. Click &quot;Start Listening&quot; to continue.
              </div>
            )}
            {voiceError && (
              <div className="mt-2 text-xs text-red-600">
                ⚠️ {voiceError}
              </div>
            )}
          </div>
        )}
        {!isSupported && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-center text-sm text-yellow-800">
            Voice recognition not supported in this browser. Please use a modern browser with microphone access.
          </div>
        )}

        {/* Question */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-center flex-1">{round.question}</h2>
            <button
              onClick={() => setShowAllAnswers(!showAllAnswers)}
              className="ml-4 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition whitespace-nowrap"
              title={showAllAnswers ? "Hide answers" : "Show all answers"}
            >
              {showAllAnswers ? "🙈 Hide" : "👁️ Show All"}
            </button>
          </div>

          {/* Top 10 List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {round.listItems.map((item, index) => {
              const isFound = foundItems.has(item);
              const shouldShow = isFound || showAllAnswers;
              return (
                <div
                  key={index}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    isFound
                      ? "bg-green-100 border-green-500 text-green-800 font-semibold"
                      : showAllAnswers
                      ? "bg-yellow-50 border-yellow-400 text-yellow-800"
                      : "bg-gray-50 border-gray-300 text-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold mr-3">#{index + 1}</span>
                    <span className="flex-1">{shouldShow ? item : "???"}</span>
                    {isFound && <span className="text-2xl ml-2">✓</span>}
                    {showAllAnswers && !isFound && (
                      <span className="text-sm ml-2 text-yellow-600">(not found)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion Message */}
        {allFound && (
          <div className="bg-green-100 border-2 border-green-500 rounded-xl p-6 mb-4 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-2xl font-bold text-green-800">All 10 items found!</p>
          </div>
        )}

        {/* Next Round Button */}
        <div className="text-center">
          <button
            onClick={handleNextRound}
            className="bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 text-lg font-semibold"
          >
            New List
          </button>
        </div>
      </div>
    </div>
  );
}

