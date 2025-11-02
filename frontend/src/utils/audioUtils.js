/**
 * Downsample audio signal to reduce size for API calls
 * @param {Float32Array|Array} signal - Original signal data
 * @param {number} originalSampleRate - Original sample rate
 * @param {number} targetSampleRate - Target sample rate (default: 16000)
 * @param {number} maxSamples - Maximum number of samples to keep (default: 100000)
 * @returns {Object} - Downsampled signal and new sample rate
 */
export function downsampleSignal(signal, originalSampleRate, targetSampleRate = 16000, maxSamples = 100000) {
  if (!signal || signal.length === 0) {
    return { data: [], sampleRate: originalSampleRate };
  }

  const signalArray = Array.isArray(signal) ? signal : Array.from(signal);
  const signalLength = signalArray.length;

  // If signal is already small enough, return as is
  if (signalLength <= maxSamples && originalSampleRate <= targetSampleRate) {
    return { data: signalArray, sampleRate: originalSampleRate };
  }

  // Calculate downsampling factor
  const maxSampleRate = Math.min(targetSampleRate, (originalSampleRate * maxSamples) / signalLength);
  const downsampleFactor = Math.max(1, Math.floor(originalSampleRate / maxSampleRate));
  const newSampleRate = originalSampleRate / downsampleFactor;

  // Downsample by taking every Nth sample
  const downsampled = [];
  for (let i = 0; i < signalLength; i += downsampleFactor) {
    if (downsampled.length >= maxSamples) break;
    downsampled.push(signalArray[i]);
  }

  console.log(`Downsampled signal: ${signalLength} -> ${downsampled.length} samples, ${originalSampleRate}Hz -> ${newSampleRate.toFixed(0)}Hz`);

  return {
    data: downsampled,
    sampleRate: newSampleRate
  };
}

/**
 * Limit the number of samples in a signal
 * @param {Array|Float32Array} signal - Signal data
 * @param {number} maxSamples - Maximum samples to keep
 * @returns {Array} - Limited signal array
 */
export function limitSignalSize(signal, maxSamples = 100000) {
  if (!signal || signal.length === 0) return [];
  
  const signalArray = Array.isArray(signal) ? signal : Array.from(signal);
  
  if (signalArray.length <= maxSamples) {
    return signalArray;
  }

  // Take evenly spaced samples
  const step = signalArray.length / maxSamples;
  const limited = [];
  for (let i = 0; i < signalArray.length; i += step) {
    limited.push(signalArray[Math.floor(i)]);
  }

  return limited.slice(0, maxSamples);
}

