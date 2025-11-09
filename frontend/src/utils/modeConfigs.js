let cachedConfigs = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const fetchModesFromBackend = async (apiBaseUrl) => {
  try {
    console.log(`Fetching mode configs from ${apiBaseUrl}/api/modes/all`);

    const response = await fetch(`${apiBaseUrl}/api/modes/all`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.modes || typeof data.modes !== "object") {
      throw new Error("Invalid response format from backend");
    }

    console.log("Mode configs fetched successfully:", Object.keys(data.modes));
    return data.modes;
  } catch (error) {
    console.error("Failed to fetch mode configs from backend:", error);
    throw error;
  }
};

/**
 * Get all mode configurations with caching
 */
export const getAllModeConfigs = async (apiBaseUrl, forceRefresh = false) => {
  const now = Date.now();

  // Return cached data if valid
  if (
    !forceRefresh &&
    cachedConfigs &&
    cacheTimestamp &&
    now - cacheTimestamp < CACHE_DURATION
  ) {
    console.log("Using cached mode configs");
    return JSON.parse(JSON.stringify(cachedConfigs));
  }

  // Fetch fresh data
  console.log("Fetching fresh mode configs from backend");
  cachedConfigs = await fetchModesFromBackend(apiBaseUrl);
  cacheTimestamp = now;

  // Return deep copy
  return JSON.parse(JSON.stringify(cachedConfigs));
};

/**
 * Get configuration for a specific mode
 */
export const getModeConfig = async (mode, apiBaseUrl, forceRefresh = false) => {
  const allConfigs = await getAllModeConfigs(apiBaseUrl, forceRefresh);

  if (!allConfigs[mode]) {
    console.warn(`Mode "${mode}" not found, falling back to generic`);
    return allConfigs.generic || getFallbackConfig(mode);
  }

  // Return deep copy
  return JSON.parse(JSON.stringify(allConfigs[mode]));
};

/**
 * Clear cache (useful after updating configs)
 */
export const clearCache = () => {
  cachedConfigs = null;
  cacheTimestamp = null;
  console.log("Mode config cache cleared");
};

/**
 * Get all available mode names
 */
export const getAllModes = async (apiBaseUrl) => {
  const configs = await getAllModeConfigs(apiBaseUrl);
  return Object.keys(configs);
};

/**
 * Update mode configuration on backend
 */
export const updateModeConfig = async (mode, config, apiBaseUrl) => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/modes/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode, config }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update mode config");
    }

    const result = await response.json();

    // Clear cache to force refresh on next fetch
    clearCache();

    console.log("Mode config updated successfully:", result);
    return result;
  } catch (error) {
    console.error("Error updating mode config:", error);
    throw error;
  }
};

/**
 * Update slider values for a mode
 * This updates the backend modes.json file
 */
export const updateSliderValues = async (mode, sliders, apiBaseUrl) => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/modes/update-sliders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode, sliders }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update sliders");
    }

    const result = await response.json();

    // Update cache with new values
    if (cachedConfigs && cachedConfigs[mode]) {
      cachedConfigs[mode].sliders = sliders;
    }

    console.log("Sliders updated on backend successfully:", result);
    return result;
  } catch (error) {
    console.error("Error updating sliders on backend:", error);
    throw error;
  }
};

/**
 * Auto-sync slider values to backend (debounced)
 * This should be called whenever sliders change
 * Silent sync - doesn't throw errors to avoid breaking UI
 */
export const autoSyncSliders = async (mode, sliders, apiBaseUrl) => {
  try {
    await updateSliderValues(mode, sliders, apiBaseUrl);
    console.log(`✅ Auto-synced ${mode} mode to backend JSON file`);
    return true;
  } catch (error) {
    console.warn(
      `⚠️ Backend auto-sync failed (will continue using localStorage):`,
      error.message
    );
    // Don't throw - allow app to continue working offline
    return false;
  }
};

/**
 * Validate mode configuration structure
 */
export const validateModeConfig = (config) => {
  if (!config || typeof config !== "object") {
    return false;
  }

  if (!config.mode || !config.name || !Array.isArray(config.sliders)) {
    return false;
  }

  for (const slider of config.sliders) {
    if (!slider.id || !slider.label || slider.value === undefined) {
      return false;
    }

    if (!Array.isArray(slider.freqRanges) || slider.freqRanges.length === 0) {
      return false;
    }

    for (const range of slider.freqRanges) {
      if (!Array.isArray(range) || range.length !== 2) {
        return false;
      }
      if (range[0] < 0 || range[1] < 0 || range[0] >= range[1]) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Check if mode allows custom sliders
 */
export const allowsCustomSliders = (config) => {
  return config?.allowCustomSliders === true;
};

/**
 * Get mode display information
 */
export const getModeInfo = (config) => {
  if (!config) {
    return {
      name: "Unknown Mode",
      description: "Mode not found",
    };
  }

  return {
    name: config.name,
    description: config.description,
    mode: config.mode,
    icon: config.icon || "⚙️",
  };
};

export const getFallbackConfig = (mode) => {
  console.warn(`Using minimal fallback for ${mode} `);
};

export default {
  getAllModeConfigs,
  getModeConfig,
  clearCache,
  getAllModes,
  updateModeConfig,
  updateSliderValues,
  autoSyncSliders,
  validateModeConfig,
  allowsCustomSliders,
  getModeInfo,
  getFallbackConfig,
};
