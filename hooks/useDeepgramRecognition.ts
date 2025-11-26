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

      // Set up audio streaming first
      let isConnectionOpen = false;
      let keepAliveInterval: NodeJS.Timeout | null = null;
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let audioChunkCount = 0;

      processor.onaudioprocess = (e) => {
        if (!connectionRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(inputData.length);
        
        // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Only send if connection is open
        if (isConnectionOpen) {
          try {
            const connection = connectionRef.current;
            const readyState = connection.getReadyState();
            if (readyState === 1) { // OPEN
              connection.send(pcm.buffer);
              audioChunkCount++;
              if (audioChunkCount === 1) {
                console.log("🎵 First audio chunk sent to Deepgram!");
              } else if (audioChunkCount % 50 === 0) {
                console.log(`📊 Sent ${audioChunkCount} audio chunks to Deepgram`);
              }
            } else {
              if (audioChunkCount === 0) {
                console.warn(`⚠️ Connection not ready (state: ${readyState}), waiting...`);
              }
            }
          } catch (err: any) {
            console.error("Error sending audio to Deepgram:", err);
            if (err.message) {
              console.error("Error message:", err.message);
            }
          }
        } else {
          if (audioChunkCount === 0) {
            console.log("⏳ Waiting for connection to open before sending audio...");
          }
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Store for cleanup
      (connectionRef.current as any).processor = processor;
      (connectionRef.current as any).audioContext = audioContext;

      // Handle connection open
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("🔵 Deepgram connection opened - ready to stream audio");
        (connectionRef.current as any)._openedAt = Date.now();
        isConnectionOpen = true;
        setIsListening(true);
        setError(null);
        shouldRestartRef.current = continuous;
        
        // Log connection state
        console.log("📡 Connection ready state:", connection.getReadyState());
        console.log("🎙️ Audio processor is active, streaming will begin...");
        
        // Don't send keep-alive - let real audio data flow instead
        // The audio processor will send continuous audio chunks
      });

      // Handle transcripts
      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        console.log("📝 Deepgram transcript event:", data);
        
        // Deepgram v4 SDK structure: data.channel.alternatives[0].transcript
        let transcript: string | undefined;
        let isFinal = false;
        
        // Try different possible paths for the transcript
        if (data.channel?.alternatives?.[0]?.transcript) {
          transcript = data.channel.alternatives[0].transcript;
          isFinal = data.is_final || false;
        } else if (data.alternatives?.[0]?.transcript) {
          transcript = data.alternatives[0].transcript;
          isFinal = data.is_final || false;
        } else if (data.transcript) {
          transcript = data.transcript;
          isFinal = data.is_final || false;
        } else {
          // Log the full structure to debug
          console.log("🔍 Full data structure:", JSON.stringify(data, null, 2));
        }

        if (transcript && transcript.trim()) {
          console.log(`🎤 Deepgram transcript (${isFinal ? "final" : "interim"}):`, transcript);
          
          // Process final transcripts always, and interim in continuous mode
          if (isFinal) {
            console.log("✅ Processing final transcript:", transcript);
            onResult(transcript.trim());
          } else if (continuous) {
            // In continuous mode, also process interim results for faster feedback
            console.log("⚡ Processing interim transcript (continuous mode):", transcript);
            onResult(transcript.trim());
          }
        } else if (data.channel || data.alternatives) {
          // There's a result but no transcript - might be silence or processing
          console.log("🔇 No transcript in result (might be silence or still processing)");
        }
      });

      // Handle metadata (includes utterance end)
      connection.on(LiveTranscriptionEvents.Metadata, (data) => {
        if (data.utterance_end) {
          console.log("🔵 Utterance ended");
        }
      });

      // Handle errors
      connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error("❌ Deepgram error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        isConnectionOpen = false;
        setError(error?.message || error?.type || "Deepgram connection error");
        setIsListening(false);
      });

      // Handle close
      connection.on(LiveTranscriptionEvents.Close, (event: any) => {
        console.log("🔵 Deepgram connection closed", event);
        console.log("Close code:", event.code, "Reason:", event.reason || "none");
        isConnectionOpen = false;
        setIsListening(false);
        
        const openedAt = (connectionRef.current as any)?._openedAt;
        const duration = openedAt ? Date.now() - openedAt : 0;
        console.log(`⏱️ Connection was open for ${duration}ms`);
        console.log(`📊 Total audio chunks sent: ${audioChunkCount}`);
        
        // Auto-restart if in continuous mode and connection was open for a reasonable time
        // Code 1000 = normal closure (might be timeout or server-side close)
        if (shouldRestartRef.current && continuous) {
          // Always restart in continuous mode, even if it closed quickly
          setTimeout(() => {
            if (shouldRestartRef.current) {
              console.log("🔄 Auto-restarting Deepgram connection...");
              startListening();
            }
          }, 1000);
        } else if (duration < 2000) {
          console.warn("⚠️ Connection closed quickly - might be API issue or network problem");
        }
      });

      // The connection starts automatically when created, no need to call .start()
      console.log("🚀 Deepgram connection created and starting...");

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
        
        // Clear keep-alive interval
        if ((connection as any).keepAliveInterval) {
          clearInterval((connection as any).keepAliveInterval);
        }
        
        // Clean up ScriptProcessorNode
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

