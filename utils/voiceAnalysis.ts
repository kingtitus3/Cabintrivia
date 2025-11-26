// utils/voiceAnalysis.ts

export interface VoiceProfile {
  id: string;
  name: string;
  pitch: number; // Average pitch in Hz
  formants: number[]; // Formant frequencies
  spectralCentroid: number; // Average frequency
  zeroCrossingRate: number; // Voice activity indicator
}

// Analyze audio to extract voice characteristics
export async function analyzeVoice(audioBuffer: AudioBuffer): Promise<Partial<VoiceProfile>> {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  
  // Calculate pitch (fundamental frequency)
  const pitch = calculatePitch(channelData, sampleRate);
  
  // Calculate formants (vowel characteristics)
  const formants = calculateFormants(channelData, sampleRate);
  
  // Calculate spectral centroid
  const spectralCentroid = calculateSpectralCentroid(channelData, sampleRate);
  
  // Calculate zero crossing rate
  const zeroCrossingRate = calculateZeroCrossingRate(channelData);
  
  return {
    pitch,
    formants,
    spectralCentroid,
    zeroCrossingRate,
  };
}

// Calculate fundamental frequency (pitch) using autocorrelation
function calculatePitch(audioData: Float32Array, sampleRate: number): number {
  const minPeriod = Math.floor(sampleRate / 800); // Max 800 Hz
  const maxPeriod = Math.floor(sampleRate / 80); // Min 80 Hz
  
  let maxCorrelation = 0;
  let bestPeriod = minPeriod;
  
  for (let period = minPeriod; period < maxPeriod && period < audioData.length / 2; period++) {
    let correlation = 0;
    for (let i = 0; i < audioData.length - period; i++) {
      correlation += audioData[i] * audioData[i + period];
    }
    
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestPeriod = period;
    }
  }
  
  return sampleRate / bestPeriod;
}

// Calculate formant frequencies (simplified)
function calculateFormants(audioData: Float32Array, sampleRate: number): number[] {
  // Simplified formant calculation - use pitch harmonics as approximation
  const pitch = calculatePitch(audioData, sampleRate);
  const formants: number[] = [];
  
  // Approximate formants based on pitch harmonics
  if (pitch > 0) {
    for (let i = 1; i <= 3; i++) {
      formants.push(pitch * (i * 2 + 1)); // Approximate formant frequencies
    }
  }
  
  return formants.slice(0, 3);
}

// Calculate spectral centroid (simplified - use RMS as approximation)
function calculateSpectralCentroid(audioData: Float32Array, sampleRate: number): number {
  // Simplified: use RMS energy weighted by frequency
  let rms = 0;
  let weightedSum = 0;
  
  for (let i = 0; i < audioData.length; i++) {
    const value = Math.abs(audioData[i]);
    rms += value * value;
    weightedSum += value * (i / audioData.length) * sampleRate;
  }
  
  rms = Math.sqrt(rms / audioData.length);
  return rms > 0 ? weightedSum / (rms * audioData.length) : 0;
}

// Calculate zero crossing rate
function calculateZeroCrossingRate(audioData: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < audioData.length; i++) {
    if ((audioData[i - 1] >= 0 && audioData[i] < 0) || 
        (audioData[i - 1] < 0 && audioData[i] >= 0)) {
      crossings++;
    }
  }
  return crossings / audioData.length;
}


// Match incoming voice to closest profile
export function matchVoice(
  incomingProfile: Partial<VoiceProfile>,
  profiles: VoiceProfile[]
): VoiceProfile | null {
  if (profiles.length === 0) return null;
  
  let bestMatch: VoiceProfile | null = null;
  let bestScore = Infinity;
  
  for (const profile of profiles) {
    let score = 0;
    
    // Compare pitch (weighted heavily)
    if (incomingProfile.pitch && profile.pitch) {
      score += Math.abs(incomingProfile.pitch - profile.pitch) * 2;
    }
    
    // Compare spectral centroid
    if (incomingProfile.spectralCentroid && profile.spectralCentroid) {
      score += Math.abs(incomingProfile.spectralCentroid - profile.spectralCentroid) / 100;
    }
    
    // Compare formants
    if (incomingProfile.formants && profile.formants) {
      const minLength = Math.min(incomingProfile.formants.length, profile.formants.length);
      for (let i = 0; i < minLength; i++) {
        score += Math.abs(incomingProfile.formants[i] - profile.formants[i]) / 50;
      }
    }
    
    // Compare zero crossing rate
    if (incomingProfile.zeroCrossingRate && profile.zeroCrossingRate) {
      score += Math.abs(incomingProfile.zeroCrossingRate - profile.zeroCrossingRate) * 1000;
    }
    
    if (score < bestScore) {
      bestScore = score;
      bestMatch = profile;
    }
  }
  
  // Only return match if score is below threshold (voice is similar enough)
  return bestScore < 500 ? bestMatch : null;
}

