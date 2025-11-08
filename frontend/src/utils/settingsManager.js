/**
 * Settings Manager - Handles localStorage operations and file import/export
 */

const STORAGE_PREFIX = "equalizer_";

/**
 * Save settings to localStorage
 */
export const saveSettings = (mode, sliders) => {
  try {
    const settings = {
      mode,
      sliders,
      timestamp: new Date().toISOString(),
      version: "1.0",
    };

    const key = `${STORAGE_PREFIX}${mode}`;
    localStorage.setItem(key, JSON.stringify(settings));

    console.log(`Settings saved for ${mode} mode`);
    return true;
  } catch (error) {
    console.error("Error saving settings to localStorage:", error);
    return false;
  }
};

/**
 * Load settings from localStorage
 */
export const loadSettings = (mode) => {
  try {
    const key = `${STORAGE_PREFIX}${mode}`;
    const saved = localStorage.getItem(key);

    if (!saved) {
      console.log(`No saved settings found for ${mode} mode`);
      return null;
    }

    const settings = JSON.parse(saved);
    console.log(`Settings loaded for ${mode} mode`);
    return settings;
  } catch (error) {
    console.error("Error loading settings from localStorage:", error);
    return null;
  }
};

/**
 * Clear settings from localStorage
 */
export const clearSettings = (mode) => {
  try {
    const key = `${STORAGE_PREFIX}${mode}`;
    localStorage.removeItem(key);
    console.log(`Settings cleared for ${mode} mode`);
    return true;
  } catch (error) {
    console.error("Error clearing settings:", error);
    return false;
  }
};

/**
 * Export settings to JSON file (download)
 */
export const exportSettings = (mode, sliders, presetName = null) => {
  try {
    const settings = {
      mode,
      sliders,
      presetName,
      timestamp: new Date().toISOString(),
      version: "1.0",
      metadata: {
        createdAt: new Date().toISOString(),
        application: "Signal Equalizer",
      },
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const filename = presetName
      ? `equalizer_${mode}_${presetName}_${Date.now()}.json`
      : `equalizer_${mode}_${Date.now()}.json`;

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Settings exported: ${filename}`);
    return true;
  } catch (error) {
    console.error("Error exporting settings:", error);
    return false;
  }
};

/**
 * Import settings from JSON file
 */
export const importSettings = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file provided"));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const settings = JSON.parse(event.target.result);

        // Validate settings structure
        if (!validateSettings(settings)) {
          reject(new Error("Invalid settings file format"));
          return;
        }

        console.log("Settings imported successfully");
        resolve(settings);
      } catch (error) {
        reject(new Error(`Failed to parse settings file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
};

/**
 * Validate settings structure
 */
export const validateSettings = (settings) => {
  try {
    // Check required fields
    if (!settings.mode || !settings.sliders) {
      console.error("Missing required fields: mode or sliders");
      return false;
    }

    // Check mode is valid
    const validModes = ["generic", "musical", "animal", "human"];
    if (!validModes.includes(settings.mode)) {
      console.error(`Invalid mode: ${settings.mode}`);
      return false;
    }

    // Check sliders is array
    if (!Array.isArray(settings.sliders)) {
      console.error("Sliders must be an array");
      return false;
    }

    // Validate each slider
    for (const slider of settings.sliders) {
      if (!slider.id || !slider.label || slider.value === undefined) {
        console.error("Invalid slider structure:", slider);
        return false;
      }

      // Check value range
      if (slider.value < 0 || slider.value > 2) {
        console.error(`Invalid slider value: ${slider.value}`);
        return false;
      }

      // Check frequency ranges
      if (!slider.freqRanges || !Array.isArray(slider.freqRanges)) {
        console.error("Invalid freqRanges:", slider.freqRanges);
        return false;
      }

      // Validate each frequency range
      for (const range of slider.freqRanges) {
        if (!Array.isArray(range) || range.length !== 2) {
          console.error("Invalid frequency range:", range);
          return false;
        }
        if (range[0] < 0 || range[1] < 0 || range[0] >= range[1]) {
          console.error("Invalid frequency range values:", range);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Validation error:", error);
    return false;
  }
};

/**
 * Get all saved modes from localStorage
 */
export const getAllSavedModes = () => {
  const modes = ["generic", "musical", "animal", "human"];
  const savedModes = [];

  modes.forEach((mode) => {
    const settings = loadSettings(mode);
    if (settings) {
      savedModes.push({
        mode,
        timestamp: settings.timestamp,
        sliderCount: settings.sliders.length,
      });
    }
  });

  return savedModes;
};

/**
 * Save settings to backend server
 */
export const saveSettingsToServer = async (
  mode,
  sliders,
  presetName = null,
  apiBaseUrl
) => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/settings/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode,
        sliders,
        presetName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save settings to server");
    }

    const result = await response.json();
    console.log("Settings saved to server:", result);
    return result;
  } catch (error) {
    console.error("Error saving settings to server:", error);
    throw error;
  }
};

/**
 * Load settings from backend server
 */
export const loadSettingsFromServer = async (
  mode,
  presetName = null,
  apiBaseUrl
) => {
  try {
    const params = new URLSearchParams({ mode });
    if (presetName) {
      params.append("presetName", presetName);
    }

    const response = await fetch(`${apiBaseUrl}/api/settings/load?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to load settings from server");
    }

    const settings = await response.json();
    console.log("Settings loaded from server:", settings);
    return settings;
  } catch (error) {
    console.error("Error loading settings from server:", error);
    throw error;
  }
};

/**
 * List all presets from backend server
 */
export const listPresetsFromServer = async (mode = null, apiBaseUrl) => {
  try {
    const params = mode ? `?mode=${mode}` : "";

    const response = await fetch(
      `${apiBaseUrl}/api/settings/presets${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list presets");
    }

    const result = await response.json();
    console.log("Presets loaded from server:", result);
    return result.presets;
  } catch (error) {
    console.error("Error listing presets from server:", error);
    throw error;
  }
};

/**
 * Delete preset from backend server
 */
export const deletePresetFromServer = async (mode, presetName, apiBaseUrl) => {
  try {
    const params = new URLSearchParams({ mode, presetName });

    const response = await fetch(
      `${apiBaseUrl}/api/settings/delete?${params}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete preset");
    }

    const result = await response.json();
    console.log("Preset deleted from server:", result);
    return result;
  } catch (error) {
    console.error("Error deleting preset from server:", error);
    throw error;
  }
};
