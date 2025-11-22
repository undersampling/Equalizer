

/**
 * Limits the signal size for visualization/API calls by taking evenly spaced samples
 * @param {Array} data - The signal data array
 * @param {number} maxPoints - Maximum number of points to return (default 20000)
 * @returns {Array} - The downsampled array
 */
export const limitSignalSize = (data, maxPoints = 20000) => {
  if (!data || data.length <= maxPoints) {
    return data;
  }

  const step = Math.ceil(data.length / maxPoints);
  const limitedData = [];

  for (let i = 0; i < data.length; i += step) {
    limitedData.push(data[i]);
  }

  return limitedData;
};

/**
 * Process an uploaded audio file
 * @param {File} file - The uploaded file
 * @returns {Promise<AudioBuffer>} - The decoded audio buffer
 */
export const processAudioFile = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return await audioContext.decodeAudioData(arrayBuffer);
};


