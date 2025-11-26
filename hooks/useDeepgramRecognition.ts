// hooks/useDeepgramRecognition.ts

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

interface UseDeepgramRecognitionOptions {
  onResult: (transcript: string) => void;
  onMultipleResults?: (transcripts: string[]) => void;
  continuous?: boolean;
  apiKey?: string;
}

export function useDeepgramRecognition({
  onResult,
  onMultipleResults,
  continuous = false,
  apiKey,
}: UseDeepgramRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const connectionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const shouldRestartRef = useRef<boolean>(false);

  // Check for browser support
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        setIsSupported(true);
      } else {
        setIsSupported(false);
        setError("Browser does not support microphone access");
      }
    };
    checkSupport();
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError("Microphone not supported");
      return;
    }

    // Get API key from environment or parameter
    const key = apiKey || process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!key) {
      setError("Deepgram API key not found. Please add NEXT_PUBLIC_DEEPGRAM_API_KEY to your .env.local file");
      return;
    }

    try {
      // Stop any existing connection
      if (connectionRef.current) {
        connectionRef.current.finish();
        connectionRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Create Deepgram client
      const deepgram = createClient(key);
      
      // Create live transcription connection
      const connection = deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000, // End utterance after 1 second of silence
        vad_events: true, // Voice activity detection
      });

      connectionRef.current = connection;

      // Handle connection open
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("🔵 Deepgram connection opened");
        setIsListening(true);
        setError(null);
        shouldRestartRef.current = continuous;
      });

      // Handle transcripts
      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const isFinal = data.is_final || false;

        if (transcript && transcript.trim()) {
          console.log(`🎤 Deepgram transcript (${isFinal ? "final" : "interim"}):`, transcript);
          
          // Only process final transcripts (or interim if continuous)
          if (isFinal) {
            onResult(transcript.trim());
          } else if (continuous) {
            // In continuous mode, also process interim results for faster feedback
            // But mark them as interim so they can be refined
          }
        }
      });

      // Handle metadata (includes utterance end)
      connection.on(LiveTranscriptionEvents.Metadata, (data) => {
        if (data.utterance_end) {
          console.log("🔵 Utterance ended");
        }
      });

      // Handle errors
      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error("Deepgram error:", error);
        setError(error.message || "Deepgram connection error");
        setIsListening(false);
      });

      // Handle close
      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log("🔵 Deepgram connection closed");
        setIsListening(false);
        
        // Auto-restart if continuous mode
        if (shouldRestartRef.current && continuous) {
          setTimeout(() => {
            if (shouldRestartRef.current) {
              startListening();
            }
          }, 500);
        }
      });

      // Start the connection
      connection.start();

      // Stream audio to Deepgram using AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      
      // Use AudioWorkletNode if available, otherwise fall back to ScriptProcessorNode
      let processor: ScriptProcessorNode | AudioWorkletNode;
      
      try {
        // Try to use AudioWorklet (modern, preferred)
        // For now, we'll use ScriptProcessorNode as it's more compatible
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        (processor as ScriptProcessorNode).onaudioprocess = (e) => {
          if (connection.getReadyState() === 1) { // OPEN
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm = new Int16Array(inputData.length);
            
            // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            connection.send(pcm.buffer);
          }
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
      } catch (err) {
        console.error("Error setting up audio processing:", err);
        throw err;
      }

      // Store for cleanup
      (connectionRef.current as any).processor = processor;
      (connectionRef.current as any).audioContext = audioContext;

    } catch (err: any) {
      console.error("Error starting Deepgram:", err);
      setError(err.message || "Failed to start voice recognition");
      setIsListening(false);
    }
  }, [isSupported, apiKey, continuous, onResult]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    
    if (connectionRef.current) {
      try {
        const connection = connectionRef.current;
        if ((connection as any).processor) {
          (connection as any).processor.disconnect();
        }
        if ((connection as any).audioContext) {
          (connection as any).audioContext.close();
        }
        connection.finish();
      } catch (err) {
        console.error("Error stopping connection:", err);
      }
      connectionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
  };
}

