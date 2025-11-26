// hooks/useVoiceRecognition.ts

import { useState, useEffect, useRef } from "react";

interface UseVoiceRecognitionOptions {
  onResult: (transcript: string) => void;
  onMultipleResults?: (transcripts: string[]) => void;
  continuous?: boolean;
  interimResults?: boolean;
  detectMultipleSpeakers?: boolean;
}

export function useVoiceRecognition({
  onResult,
  onMultipleResults,
  continuous = false,
  interimResults = false,
  detectMultipleSpeakers = false,
}: UseVoiceRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const resultBufferRef = useRef<string[]>([]);
  const lastResultTimeRef = useRef<number>(0);
  const shouldRestartRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to split transcript into potential multiple speaker segments
  const splitMultipleSpeakers = (transcript: string): string[] => {
    // Look for common separators that might indicate different speakers
    const separators = [
      /\s+and\s+/i,
      /\s*,\s*/,
      /\s+then\s+/i,
      /\s+also\s+/i,
      /\s+plus\s+/i,
      /\s*\.\s*/,
    ];

    let segments = [transcript];
    
    for (const separator of separators) {
      const newSegments: string[] = [];
      segments.forEach((seg) => {
        const split = seg.split(separator);
        newSegments.push(...split.map((s) => s.trim()).filter((s) => s.length > 0));
      });
      segments = newSegments;
    }

    // Filter out very short segments (likely not separate answers)
    return segments.filter((seg) => seg.length > 2);
  };

  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = continuous || detectMultipleSpeakers;
    recognition.interimResults = interimResults || detectMultipleSpeakers;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      resultBufferRef.current = [];
      lastResultTimeRef.current = Date.now();
      // In continuous mode, keep the restart flag true (unless explicitly stopped)
      if (!continuous) {
        shouldRestartRef.current = false;
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Process any remaining buffered results
      if (resultBufferRef.current.length > 0 && onMultipleResults) {
        onMultipleResults([...resultBufferRef.current]);
        resultBufferRef.current = [];
      }
      
      // Auto-restart if continuous mode is enabled and we should keep listening
      // In continuous mode, shouldRestartRef should remain true unless explicitly stopped
      if (continuous && recognitionRef.current && shouldRestartRef.current) {
        // Clear any existing timeout
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        
        // Restart after a short delay to avoid immediate restart errors
        restartTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current && shouldRestartRef.current) {
            try {
              console.log("🔄 Auto-restarting voice recognition...");
              recognitionRef.current.start();
            } catch (error: any) {
              // If restart fails (e.g., already started), try again after a longer delay
              if (error?.message?.includes("already started") || error?.name === "InvalidStateError") {
                // Recognition is already running, ignore
                console.log("Recognition already running, skipping restart");
                return;
              }
              console.warn("Restart failed, retrying...", error);
              restartTimeoutRef.current = setTimeout(() => {
                if (recognitionRef.current && shouldRestartRef.current) {
                  try {
                    recognitionRef.current.start();
                  } catch (retryError) {
                    console.error("Error restarting recognition after retry:", retryError);
                    // Don't keep retrying forever - set flag to false after multiple failures
                    shouldRestartRef.current = false;
                  }
                }
              }, 1000);
            }
          }
        }, 300);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const now = Date.now();
      const results = Array.from(event.results);
      
      // Get final results (not interim)
      const finalResults = results.filter((r) => r.isFinal);
      
      if (finalResults.length > 0) {
        const transcripts = finalResults.map((result) => result[0].transcript.trim());
        
        if (detectMultipleSpeakers && onMultipleResults) {
          // Check if multiple results came in quickly (might be simultaneous speakers)
          const timeSinceLastResult = now - lastResultTimeRef.current;
          
          if (timeSinceLastResult < 500) {
            // Results came in within 500ms - likely simultaneous
            resultBufferRef.current.push(...transcripts);
          } else {
            // Process buffered results if any
            if (resultBufferRef.current.length > 0) {
              onMultipleResults([...resultBufferRef.current, ...transcripts]);
              resultBufferRef.current = [];
            } else {
              // Try to split single transcript for multiple speakers
              const allText = transcripts.join(" ");
              const segments = splitMultipleSpeakers(allText);
              
              if (segments.length > 1) {
                onMultipleResults(segments);
              } else {
                onResult(allText);
              }
            }
          }
          
          lastResultTimeRef.current = now;
        } else {
          // Standard single result processing
          const transcript = transcripts.join(" ");
          if (transcript) {
            onResult(transcript);
          }
        }
      } else if (interimResults || detectMultipleSpeakers) {
        // Process interim results for real-time feedback
        const interimTranscripts = results
          .filter((r) => !r.isFinal)
          .map((r) => r[0].transcript.trim());
        
        if (interimTranscripts.length > 0) {
          const transcript = interimTranscripts.join(" ");
          // Don't call onResult for interim, but we could add a callback for this
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      
      // Don't stop on "no-speech" errors in continuous mode - just restart
      if (event.error === "no-speech" && continuous) {
        // This is normal, the recognition will auto-restart via onend
        return;
      }
      
      // For "aborted" errors, it's usually because we're restarting - ignore
      if (event.error === "aborted" && continuous) {
        return;
      }
      
      // For other errors, log but don't necessarily stop in continuous mode
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Speech recognition error (may auto-restart):", event.error);
        // Don't set isListening to false here - let onend handle restart
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult, onMultipleResults, continuous, interimResults, detectMultipleSpeakers]);

  const startListening = () => {
    if (recognitionRef.current) {
      // Always set restart flag to true when manually starting
      shouldRestartRef.current = true;
      
      // Only start if not already listening
      if (!isListening) {
        try {
          recognitionRef.current.start();
        } catch (error: any) {
          // If already started, that's fine - just update state
          if (error?.message?.includes("already started") || error?.name === "InvalidStateError") {
            console.log("Recognition already running");
            setIsListening(true);
          } else {
            console.error("Error starting recognition:", error);
          }
        }
      }
    }
  };

  const stopListening = () => {
    shouldRestartRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}

