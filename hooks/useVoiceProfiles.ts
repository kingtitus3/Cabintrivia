// hooks/useVoiceProfiles.ts

import { useState, useCallback, useRef } from "react";
import type { VoiceProfile } from "../utils/voiceAnalysis";
import { analyzeVoice, matchVoice } from "../utils/voiceAnalysis";

export function useVoiceProfiles() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startRecording = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      return stream;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, []);

  const recordVoiceSample = useCallback(
    async (playerId: string, playerName: string): Promise<VoiceProfile | null> => {
      try {
        const stream = await startRecording();
        const audioContext = audioContextRef.current!;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        return new Promise((resolve) => {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Float32Array(bufferLength);
          const samples: Float32Array[] = [];
          let sampleCount = 0;
          const maxSamples = 50; // ~1 second at 50 samples/sec

          const collectSample = () => {
            analyser.getFloatTimeDomainData(dataArray);
            samples.push(new Float32Array(dataArray));
            sampleCount++;

            if (sampleCount < maxSamples) {
              requestAnimationFrame(collectSample);
            } else {
              stopRecording();
              
              // Combine samples into audio buffer
              const totalLength = samples.reduce((sum, arr) => sum + arr.length, 0);
              const combined = new Float32Array(totalLength);
              let offset = 0;
              samples.forEach((sample) => {
                combined.set(sample, offset);
                offset += sample.length;
              });

              const audioBuffer = audioContext.createBuffer(1, combined.length, audioContext.sampleRate);
              audioBuffer.copyToChannel(combined, 0);

              analyzeVoice(audioBuffer)
                .then((voiceData) => {
                  const profile: VoiceProfile = {
                    id: playerId,
                    name: playerName,
                    pitch: voiceData.pitch || 0,
                    formants: voiceData.formants || [],
                    spectralCentroid: voiceData.spectralCentroid || 0,
                    zeroCrossingRate: voiceData.zeroCrossingRate || 0,
                  };
                  
                  setProfiles((prev) => [...prev, profile]);
                  resolve(profile);
                })
                .catch((error) => {
                  console.error("Error analyzing voice:", error);
                  resolve(null);
                });
            }
          };

          setTimeout(() => {
            requestAnimationFrame(collectSample);
          }, 100); // Small delay to start recording
        });
      } catch (error) {
        console.error("Error recording voice sample:", error);
        return null;
      }
    },
    [startRecording, stopRecording]
  );

  const identifySpeaker = useCallback(
    async (audioBuffer: AudioBuffer): Promise<VoiceProfile | null> => {
      const voiceData = await analyzeVoice(audioBuffer);
      return matchVoice(voiceData, profiles);
    },
    [profiles]
  );

  const removeProfile = useCallback((playerId: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== playerId));
  }, []);

  return {
    profiles,
    recordVoiceSample,
    identifySpeaker,
    removeProfile,
  };
}

