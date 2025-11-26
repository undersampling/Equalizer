import axios from "axios";

// Create axios instance with environment variable support
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
});

export const apiService = {
  // ============================================================================
  // MODE CONFIGURATION ENDPOINTS
  // ============================================================================

  /**
   * Get all mode configurations
   */
  getAllModes: (category = null) => {
    const url = category ? `/modes/${category}` : "/modes/all";
    return apiClient.get(url);
  },

  /**
   * Get specific mode config
   */
  getModeConfig: (modeName) => {
    return apiClient.get(`/modes/${modeName}`);
  },

  /**
   * Reset all modes to default configuration
   */
  resetModes: () => {
    return apiClient.post("/modes/reset");
  },

  /**
   * Update mode configuration
   */
  updateModeConfig: (mode, config) => {
    return apiClient.post("/modes/update", { mode, config });
  },

  /**
   * Update slider values for a mode
   */
  updateSliderValues: (mode, sliders) => {
    return apiClient.post("/modes/update-sliders", { mode, sliders });
  },

  // ============================================================================
  // SIGNAL PROCESSING ENDPOINTS
  // ============================================================================

  /**
   * Apply equalization to signal
   * CRITICAL UPDATE: 'preview' param enables fast graph updates
   */
  equalize: (signal, sampleRate, sliders, mode, preview = false) => {
    return apiClient.post("/equalize", {
      signal,
      sampleRate,
      sliders,
      mode,
      preview, // True = Fast Graph Update, False = Full Audio Update
    });
  },

  /**
   * Compute FFT (Fourier Transform) of signal
   */
  computeFFT: (signal, sampleRate, scale = "linear") => {
    return apiClient.post("/fft", {
      signal,
      sampleRate,
      scale,
    });
  },

  /**
   * Generate spectrogram from signal
   */
  generateSpectrogram: (
    signal,
    sampleRate,
    useMel = true,
    nMels = 128,
    fmax = 8000
  ) => {
    return apiClient.post("/spectrogram", {
      signal,
      sampleRate,
      use_mel: useMel,
      n_mels: nMels,
      fmax,
    });
  },

  // ============================================================================
  // MUSIC SEPARATION & MIXING ENDPOINTS
  // ============================================================================

  /**
   * Separate music into stems (vocals, drums, bass, other)
   */
  separateMusic: (signal, sampleRate) => {
    return apiClient.post("/separate-music", {
      signal,
      sampleRate,
    });
  },

  /**
   * Separate voices from music
   */
  separateVoices: (signal, sampleRate) => {
    return apiClient.post("/separate-voices", {
      signal,
      sampleRate,
    });
  },

  /**
   * Mix audio stems with individual gains
   */
  mixStems: (stems, sampleRate) => {
    return apiClient.post("/mix-stems", {
      stems,
      sampleRate,
    });
  },

  /**
   * Mix voices with individual gains
   */
  mixVoices: (voices, sampleRate) => {
    return apiClient.post("/mix-voices", {
      voices,
      sampleRate,
    });
  },

  /**
   * Mix music stems (Alias for mixStems if used by AI components)
   */
  mixMusic: (stems, sampleRate) => {
    return apiClient.post("/mix-stems", {
      stems,
      sampleRate,
    });
  },

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get base URL for the API
   */
  getBaseURL: () => {
    return apiClient.defaults.baseURL.replace("/api", "");
  },

  /**
   * Set custom base URL
   */
  setBaseURL: (url) => {
    apiClient.defaults.baseURL = url.endsWith("/api") ? url : `${url}/api`;
  },
};

export default apiService;
