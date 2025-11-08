import React, { useState, useRef, useEffect, useCallback } from "react";
import EqualizerSlider from "../components/EqualizerSlider";
import SliderCreationModal from "../components/SliderCreationModal";
import SignalViewer from "../components/SignalViewer";
import Spectrogram from "../components/Spectrogram";
import FourierGraph from "../components/FourierGraph";
import AIModelSection from "../components/AIModelSection";
import UnifiedMusicController from "../components/UnifiedMusicController";
import {
  getAllModeConfigs,
  getModeConfig,
  clearCache,
  getFallbackConfig,
  allowsCustomSliders,
  autoSyncSliders,
} from "../utils/modeConfigs";
import { downsampleSignal, limitSignalSize } from "../utils/audioUtils";
import {
  saveSettings,
  loadSettings,
  importSettings,
  exportSettings,
  validateSettings,
  clearSettings,
} from "../utils/settingsManager";

function MainPage() {
  const [currentMode, setCurrentMode] = useState("generic");
  const [sliders, setSliders] = useState([]);
  const [modeConfigs, setModeConfigs] = useState(null);
  const [isLoadingModes, setIsLoadingModes] = useState(true);
  const [modeLoadError, setModeLoadError] = useState(null);

  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);
  const [apiSignal, setApiSignal] = useState(null);
  const [aiModelSignal, setAiModelSignal] = useState(null);
  const [inputFourierData, setInputFourierData] = useState(null);
  const [outputFourierData, setOutputFourierData] = useState(null);
  const [aiModelFourierData, setAiModelFourierData] = useState(null);
  const [isAIMode, setIsAIMode] = useState(false);
  const [aiStems, setAiStems] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSpectrograms, setShowSpectrograms] = useState(true);
  const [fftScale, setFftScale] = useState("linear");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [showSliderModal, setShowSliderModal] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(null);
  const [showAIGraphs, setShowAIGraphs] = useState(false);
  const [fftError, setFftError] = useState(null);
  const [isLoadingFFT, setIsLoadingFFT] = useState(false);

  const fileInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const equalizationTimeoutRef = useRef(null);
  const fftTimeoutRef = useRef(null);
  const backendSyncTimeoutRef = useRef(null);
  const isProcessingRef = useRef(false);
  const slidersRef = useRef(sliders);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const isAIModeEnabled = currentMode === "musical" || currentMode === "human";

  // Load mode configurations on mount
  useEffect(() => {
    const loadModeConfigs = async () => {
      setIsLoadingModes(true);
      setModeLoadError(null);

      try {
        console.log("Loading mode configurations from backend...");
        const configs = await getAllModeConfigs(API_BASE_URL);

        if (!configs || Object.keys(configs).length === 0) {
          throw new Error("No mode configurations received from backend");
        }

        console.log("Mode configs loaded successfully:", Object.keys(configs));
        setModeConfigs(configs);

        if (configs[currentMode]) {
          const savedSettings = loadSettings(currentMode);
          if (savedSettings && savedSettings.sliders) {
            console.log(
              `Loaded saved settings for ${currentMode} from localStorage`
            );
            setSliders(savedSettings.sliders);
            slidersRef.current = savedSettings.sliders;
          } else {
            setSliders(configs[currentMode].sliders);
            slidersRef.current = configs[currentMode].sliders;
          }
        }
      } catch (error) {
        console.error("Failed to load mode configs:", error);
        setModeLoadError(error.message);

        const fallback = getFallbackConfig(currentMode);
        console.warn("Using fallback configuration for", currentMode);
        setSliders(fallback.sliders);
        slidersRef.current = fallback.sliders;

        if (!sessionStorage.getItem("modeConfigErrorShown")) {
          alert(
            `Warning: Could not load mode configurations from server.
` +
              `Error: ${error.message}
` +
              `Using default settings. Please check if backend is running on ${API_BASE_URL}`
          );
          sessionStorage.setItem("modeConfigErrorShown", "true");
        }
      } finally {
        setIsLoadingModes(false);
      }
    };

    loadModeConfigs();
  }, []);

  // Update sliders ref whenever sliders change
  useEffect(() => {
    slidersRef.current = sliders;
  }, [sliders]);

  // ============================================
  // AUTO-SAVE: localStorage + Backend Sync
  // ============================================
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (sliders && sliders.length > 0) {
        saveSettings(currentMode, sliders);
        console.log(`✅ Auto-saved to localStorage: ${currentMode}`);

        if (backendSyncTimeoutRef.current) {
          clearTimeout(backendSyncTimeoutRef.current);
        }

        backendSyncTimeoutRef.current = setTimeout(async () => {
          try {
            const success = await autoSyncSliders(
              currentMode,
              sliders,
              API_BASE_URL
            );
            if (success) {
              console.log(
                `✅ Auto-synced to backend modes.json: ${currentMode}`
              );
            }
          } catch (error) {
            console.warn(
              `⚠️ Backend sync failed (continuing offline):`,
              error.message
            );
          }
        }, 2000);
      }
    }, 500);

    return () => {
      clearTimeout(saveTimeout);
      if (backendSyncTimeoutRef.current) {
        clearTimeout(backendSyncTimeoutRef.current);
      }
    };
  }, [sliders, currentMode, API_BASE_URL]);

  // ============================================
  // Recompute FFT when scale changes
  // ============================================
  useEffect(() => {
    if (apiSignal) {
      computeFourierTransform(apiSignal, "input");
    }
    if (outputSignal && apiSignal) {
      computeFourierTransform(apiSignal, "output");
    }
    if (aiModelSignal) {
      computeFourierTransform(aiModelSignal, "ai");
    }
  }, [fftScale]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (equalizationTimeoutRef.current) {
        clearTimeout(equalizationTimeoutRef.current);
      }
      if (fftTimeoutRef.current) {
        clearTimeout(fftTimeoutRef.current);
      }
      if (backendSyncTimeoutRef.current) {
        clearTimeout(backendSyncTimeoutRef.current);
      }
    };
  }, []);

  // Handle mode change
  const handleModeChange = async (e) => {
    const newMode = e.target.value;
    setCurrentMode(newMode);

    try {
      const savedSettings = loadSettings(newMode);

      if (savedSettings && savedSettings.sliders) {
        console.log(`Switching to ${newMode} mode - loaded saved settings`);
        setSliders(savedSettings.sliders);
        slidersRef.current = savedSettings.sliders;
      } else if (modeConfigs && modeConfigs[newMode]) {
        console.log(`Switching to ${newMode} mode - using backend config`);
        setSliders(modeConfigs[newMode].sliders);
        slidersRef.current = modeConfigs[newMode].sliders;
      } else {
        console.log(`Fetching fresh config for ${newMode} mode`);
        const config = await getModeConfig(newMode, API_BASE_URL);
        setSliders(config.sliders);
        slidersRef.current = config.sliders;
      }

      setAiModelSignal(null);
      setAiModelFourierData(null);
      setComparisonMode(null);
      setShowAIGraphs(false);

      if (inputSignal && apiSignal) {
        setTimeout(() => applyEqualization(), 100);
      }
    } catch (error) {
      console.error(`Failed to load config for ${newMode}:`, error);

      const fallback = getFallbackConfig(newMode);
      setSliders(fallback.sliders);
      slidersRef.current = fallback.sliders;
    }
  };

  // ============================================
  // RESET TO DEFAULTS
  // ============================================
  const handleRefreshModeConfigs = async () => {
    const confirmReset = confirm(
      `🔄 Reset to Default Configuration?
` +
        `This will:
` +
        `• Reset backend modes.json to default values
` +
        `• Clear all localStorage settings
` +
        `• Remove all custom sliders in Generic mode
` +
        `• Reset all slider values to 1.0
` +
        `Your presets in Settings will NOT be affected.
` +
        `Do you want to continue?`
    );

    if (!confirmReset) {
      return;
    }

    clearCache();
    setIsLoadingModes(true);
    setModeLoadError(null);

    try {
      console.log("Resetting to default configuration...");

      const resetResponse = await fetch(`${API_BASE_URL}/api/modes/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!resetResponse.ok) {
        throw new Error("Failed to reset backend configuration");
      }

      const resetResult = await resetResponse.json();
      console.log("Backend reset successful:", resetResult);

      const modes = ["generic", "musical", "animal", "human"];
      modes.forEach((mode) => {
        clearSettings(mode);
      });
      console.log("✅ Cleared all localStorage settings");

      const configs = await getAllModeConfigs(API_BASE_URL, true);
      setModeConfigs(configs);

      if (configs[currentMode]) {
        setSliders(configs[currentMode].sliders);
        slidersRef.current = configs[currentMode].sliders;
        console.log(`✅ Reset ${currentMode} mode to defaults`);
      }

      alert(
        "✅ Reset Successful!" +
          "All modes have been reset to default configuration:" +
          "• Generic mode: No sliders" +
          "• All other modes: Slider values reset to 1.0"
      );

      if (inputSignal && apiSignal) {
        setTimeout(() => applyEqualization(), 100);
      }
    } catch (error) {
      console.error("Failed to reset mode configs:", error);
      setModeLoadError(error.message);
      alert(
        `❌ Reset Failed
` +
          `Error: ${error.message}
` +
          `Please check if backend is running on ${API_BASE_URL}`
      );
    } finally {
      setIsLoadingModes(false);
    }
  };
const handleAIToggle = (enabled, stems) => {
  setIsAIMode(enabled);
  setAiStems(stems);
  
  if (enabled && stems) {
    // Apply AI mixing when AI mode is enabled
    applyAIMixing();
  } else {
    // Fall back to frequency-based equalization
    applyEqualization();
  }
};

// Add new function for AI mixing (after applyEqualization):
const applyAIMixing = useCallback(async () => {
  if (!inputSignal || !aiStems) return;

  if (isProcessingRef.current) return;
  isProcessingRef.current = true;

  try {
    const currentSliders = slidersRef.current;
    
    // Map sliders to stems with gains
    const stemsWithGains = {};
    currentSliders.forEach(slider => {
      const stemName = slider.aiStem; // e.g., "drums", "bass", etc.
      if (stemName && aiStems[stemName]) {
        stemsWithGains[stemName] = {
          data: aiStems[stemName].data,
          gain: slider.value
        };
      }
    });

    const response = await fetch(`${API_BASE_URL}/api/music/mix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stems: stemsWithGains,
        sampleRate: inputSignal.sampleRate
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to mix AI stems");
    }

    const result = await response.json();

    const newOutputSignal = {
      data: result.mixedSignal,
      sampleRate: result.sampleRate,
      duration: inputSignal.duration,
    };

    setOutputSignal(newOutputSignal);
    setAiModelSignal(newOutputSignal);
    setShowAIGraphs(true);

    // Compute FFT for AI output
    if (fftTimeoutRef.current) {
      clearTimeout(fftTimeoutRef.current);
    }

    fftTimeoutRef.current = setTimeout(() => {
      computeFourierTransform(newOutputSignal, "output");
      computeFourierTransform(newOutputSignal, "ai");
    }, 200);

  } catch (error) {
    console.error("Error applying AI mixing:", error);
  } finally {
    isProcessingRef.current = false;
  }
}, [inputSignal, aiStems, API_BASE_URL]);
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            window.webkitAudioContext)();
        }

        const arrayBuffer = event.target.result;
        const audioBuffer = await audioContextRef.current.decodeAudioData(
          arrayBuffer
        );

        const channelData = audioBuffer.getChannelData(0);

        const originalSignal = {
          data: Array.from(channelData),
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
        };

        const downsampled = downsampleSignal(
          channelData,
          audioBuffer.sampleRate,
          16000,
          100000
        );

        const apiSignal = {
          data: downsampled.data,
          sampleRate: downsampled.sampleRate,
          duration: audioBuffer.duration,
        };

        setInputSignal(originalSignal);
        setOutputSignal(originalSignal);
        setApiSignal(apiSignal);
        setCurrentTime(0);
        setAiModelSignal(null);
        setAiModelFourierData(null);
        setComparisonMode(null);
        setShowAIGraphs(false);

        computeFourierTransform(apiSignal, "input");
        computeFourierTransform(apiSignal, "output");
      } catch (error) {
        console.error("Error loading audio file:", error);
        alert("Error loading file. Please try a different audio file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ============================================
  // Compute Fourier Transform with Scale Support
  // ============================================
  const computeFourierTransform = async (signal, type) => {
    if (!signal || !signal.data || signal.data.length === 0) {
      console.warn("No signal data to compute FFT");
      setFftError(null);
      return;
    }

    const limitedSignal = limitSignalSize(signal.data, 100000);

    if (limitedSignal.length === 0) {
      console.warn("Signal is empty after limiting");
      setFftError("Signal is too large or empty");
      setIsLoadingFFT(false);
      return;
    }

    setIsLoadingFFT(true);
    setFftError(null);

    try {
      const requestBody = {
        signal: limitedSignal,
        sampleRate: signal.sampleRate,
        scale: fftScale, // Include scale parameter
      };

      const requestSize = JSON.stringify(requestBody).length;
      if (requestSize > 50 * 1024 * 1024) {
        throw new Error(
          "Signal is too large to process. Please use a shorter audio file."
        );
      }

      const response = await fetch(`${API_BASE_URL}/api/fft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.frequencies || !result.magnitudes) {
        console.error("Invalid FFT response format:", result);
        throw new Error("Invalid response format from FFT API");
      }

      if (result.frequencies.length === 0 || result.magnitudes.length === 0) {
        console.warn("FFT returned empty arrays");
        setFftError("FFT returned empty arrays");
        setIsLoadingFFT(false);
        return;
      }

      console.log(`FFT computed for ${type} with ${fftScale} scale:`, {
        frequencies: result.frequencies.length,
        magnitudes: result.magnitudes.length,
      });

      try {
        if (type === "input") {
          setInputFourierData(result);
        } else if (type === "output") {
          setOutputFourierData(result);
        } else if (type === "ai") {
          setAiModelFourierData(result);
        }
        setIsLoadingFFT(false);
        setFftError(null);
      } catch (stateError) {
        console.error("Error updating FFT state:", stateError);
        setIsLoadingFFT(false);
        setFftError("Failed to display FFT data. Data may be too large.");
      }
    } catch (error) {
      console.error("Error computing FFT:", error);
      setIsLoadingFFT(false);
      const errorMsg =
        error.message ||
        "Failed to fetch FFT data. Make sure the backend is running on " +
          API_BASE_URL;
      setFftError(errorMsg);

      if (type === "input") {
        setInputFourierData(null);
      } else if (type === "output") {
        setOutputFourierData(null);
      } else if (type === "ai") {
        setAiModelFourierData(null);
      }
    }
  };

const handleSliderChange = (sliderId, newValue) => {
  setSliders((prev) =>
    prev.map((slider) =>
      slider.id === sliderId ? { ...slider, value: newValue } : slider
    )
  );

  if (inputSignal && apiSignal) {
    if (equalizationTimeoutRef.current) {
      clearTimeout(equalizationTimeoutRef.current);
    }

    equalizationTimeoutRef.current = setTimeout(() => {
      // Use AI mixing if in AI mode, otherwise frequency-based
      if (isAIMode && aiStems) {
        applyAIMixing();
      } else {
        applyEqualization();
      }
    }, 150);
  }
};

  const applyEqualization = useCallback(async () => {
    if (!inputSignal || !apiSignal) return;

    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;

    try {
      const currentSliders = slidersRef.current;

      const response = await fetch(`${API_BASE_URL}/api/equalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: apiSignal.data,
          sampleRate: apiSignal.sampleRate,
          sliders: currentSliders,
          mode: currentMode,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.outputSignal || !Array.isArray(result.outputSignal)) {
        throw new Error("Invalid response from equalization API");
      }

      const newOutputApiSignal = {
        data: result.outputSignal,
        sampleRate: apiSignal.sampleRate,
        duration: inputSignal.duration,
      };

      setOutputSignal({
        data: result.outputSignal,
        sampleRate: apiSignal.sampleRate,
        duration: inputSignal.duration,
      });

      if (fftTimeoutRef.current) {
        clearTimeout(fftTimeoutRef.current);
      }

      fftTimeoutRef.current = setTimeout(() => {
        computeFourierTransform(newOutputApiSignal, "output");
      }, 200);
    } catch (error) {
      console.error("Error applying equalization:", error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [inputSignal, apiSignal, currentMode, API_BASE_URL]);

  const handleAddSlider = () => {
    const currentConfig = modeConfigs?.[currentMode];
    if (currentConfig && !allowsCustomSliders(currentConfig)) {
      alert(`${currentConfig.name} does not allow custom sliders.`);
      return;
    }
    setShowSliderModal(true);
  };

  const handleCreateSlider = (newSlider) => {
    setSliders([...sliders, newSlider]);
    setShowSliderModal(false);
    if (equalizationTimeoutRef.current) {
      clearTimeout(equalizationTimeoutRef.current);
    }
    equalizationTimeoutRef.current = setTimeout(() => {
      applyEqualization();
    }, 100);
  };

  const handleRemoveSlider = (sliderId) => {
    setSliders((prev) => prev.filter((s) => s.id !== sliderId));
    if (equalizationTimeoutRef.current) {
      clearTimeout(equalizationTimeoutRef.current);
    }
    equalizationTimeoutRef.current = setTimeout(() => {
      applyEqualization();
    }, 100);
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
  };

  const handleSpeedChange = (e) => {
    setPlaybackSpeed(parseFloat(e.target.value));
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.5, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setPan(0);
    setCurrentTime(0);
  };

  const handlePlayInputAudio = () => {
    if (inputSignal) {
      playAudio(inputSignal);
    }
  };

  const handlePlayOutputAudio = () => {
    if (outputSignal) {
      playAudio(outputSignal);
    }
  };

  const handlePlayAIAudio = () => {
    if (aiModelSignal) {
      playAudio(aiModelSignal);
    }
  };

  const playAudio = (signal) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    const audioBuffer = audioContext.createBuffer(
      1,
      signal.data.length,
      signal.sampleRate
    );
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < signal.data.length; i++) {
      channelData[i] = signal.data[i];
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
  };

  const handleSaveSettings = () => {
    const presetName = prompt("Enter preset name (optional):");
    exportSettings(currentMode, sliders, presetName || null);
  };

  const handleLoadSettings = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const settings = await importSettings(file);

      if (!validateSettings(settings)) {
        alert("Invalid settings file format");
        return;
      }

      setCurrentMode(settings.mode);
      setSliders(settings.sliders);
      slidersRef.current = settings.sliders;

      saveSettings(settings.mode, settings.sliders);

      if (inputSignal && apiSignal) {
        setTimeout(() => applyEqualization(), 100);
      }

      alert("Settings loaded successfully!");
    } catch (error) {
      console.error("Error loading settings:", error);
      alert(`Failed to load settings: ${error.message}`);
    }
  };

  const handleAIModelResult = (aiSignal) => {
    setAiModelSignal(aiSignal);
    setShowAIGraphs(true);
    setComparisonMode(null);

    if (aiSignal.fourierData) {
      setAiModelFourierData(aiSignal.fourierData);
    } else {
      computeFourierTransform(aiSignal, "ai");
    }
  };

  const handleComparisonChange = (mode) => {
    setComparisonMode(mode);
  };

  const getGridColumns = () => {
    if (comparisonMode) {
      return "1fr 1fr";
    }
    if (showAIGraphs && aiModelSignal) {
      return "repeat(3, 1fr)";
    }
    return "1fr 1fr";
  };

  const canAddCustomSliders = () => {
    if (!modeConfigs || !modeConfigs[currentMode]) return false;
    return allowsCustomSliders(modeConfigs[currentMode]);
  };

  return (
    <div className="App">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎵 Signal Equalizer</h1>

            {isLoadingModes ? (
              <div className="mode-loading">⏳ Loading modes...</div>
            ) : (
              <div className="mode-selector-container">
                <select
                  className="mode-selector"
                  value={currentMode}
                  onChange={handleModeChange}
                  disabled={isLoadingModes}
                >
                  <option value="generic">⚙️ Generic Mode</option>
                  <option value="musical">🎵 Musical Instruments</option>
                  <option value="animal">🐾 Animal Sounds</option>
                  <option value="human">👤 Human Voices</option>
                </select>

                {modeLoadError && (
                  <span
                    className="mode-error"
                    title={`Error: ${modeLoadError}
Using fallback configuration`}
                  >
                    ⚠️ Offline Mode
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="header-buttons">
            <button
              className="btn"
              onClick={() => fileInputRef.current.click()}
            >
              📁 Load Signal
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="file-input"
              accept="audio/*,.wav,.mp3"
              onChange={handleFileUpload}
            />

            <button
              className="btn btn-secondary"
              onClick={handleRefreshModeConfigs}
              disabled={isLoadingModes}
              title="Reset all modes to default configuration"
            >
              🔄 Reset to Defaults
            </button>

            <button className="btn btn-secondary" onClick={handleSaveSettings}>
              💾 Export Settings
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => document.getElementById("loadSettings").click()}
            >
              📂 Import Settings
            </button>
            <input
              id="loadSettings"
              type="file"
              className="file-input"
              accept=".json"
              onChange={handleLoadSettings}
            />
          </div>
        </div>
      </header>

      {showSliderModal && (
        <SliderCreationModal
          onCreate={handleCreateSlider}
          onCancel={() => setShowSliderModal(false)}
        />
      )}

      <div className="main-container">
        {isAIModeEnabled && (
          <AIModelSection
            mode={currentMode}
            inputSignal={inputSignal}
            sliderOutputSignal={outputSignal}
            inputFourierData={inputFourierData}
            sliderFourierData={outputFourierData}
            onModelResult={handleAIModelResult}
            onComparisonChange={handleComparisonChange}
          />
        )}
        {currentMode === "musical" && (
          <UnifiedMusicController
            inputSignal={inputSignal}
            sliders={sliders}
            onSliderChange={handleSliderChange}
            onAIToggle={handleAIToggle}
            isAIEnabled={isAIMode}
          />
        )}
        
        <section className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="section-title">
              {modeConfigs?.[currentMode]?.icon || "⚙️"} Equalizer -{" "}
              {modeConfigs?.[currentMode]?.name || "Unknown Mode"}
            </h2>
            
            {currentMode === "musical" && inputSignal && (
              <button
                className={`btn ${isAIMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  const newMode = !isAIMode;
                  setIsAIMode(newMode);
                  handleAIToggle(newMode, aiStems);
                }}
                style={{
                  background: isAIMode 
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' 
                    : undefined
                }}
              >
                {isAIMode ? '🤖 AI Mode (ON)' : '🎛️ Switch to AI Mode'}
              </button>
            )}
          </div>

          {modeConfigs?.[currentMode]?.description && (
            <p className="mode-description">
              {modeConfigs[currentMode].description}
              {currentMode === "musical" && (
                <span style={{ display: 'block', marginTop: '8px', fontStyle: 'italic', opacity: 0.9 }}>
                  {isAIMode 
                    ? "🤖 Using AI stem separation - sliders control individual instruments" 
                    : "🎛️ Using frequency-based equalization"}
                </span>
              )}
            </p>
          )}

          <div className="equalizer-sliders">
            {sliders.map((slider) => (
              <EqualizerSlider
                key={slider.id}
                slider={slider}
                onChange={handleSliderChange}
                onRemove={canAddCustomSliders() ? handleRemoveSlider : null}
              />
            ))}
          </div>

          {canAddCustomSliders() && (
            <button className="add-slider-btn" onClick={handleAddSlider}>
              ➕ Add Custom Slider
            </button>
          )}
        </section>
        <section className="controls-panel">
          <div className="controls-row">
            <button className="control-btn play" onClick={handlePlay}>
              ▶ Play
            </button>
            <button className="control-btn" onClick={handlePause}>
              ⏸ Pause
            </button>
            <button className="control-btn stop" onClick={handleStop}>
              ⏹ Stop
            </button>
            <div className="speed-control">
              <label>Speed:</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={playbackSpeed}
                onChange={handleSpeedChange}
              />
              <span>{playbackSpeed.toFixed(1)}x</span>
            </div>
            <button className="control-btn" onClick={handleZoomIn}>
              🔍+ Zoom In
            </button>
            <button className="control-btn" onClick={handleZoomOut}>
              🔍- Zoom Out
            </button>
            <button className="control-btn" onClick={handleReset}>
              🔄 Reset
            </button>
          </div>
        </section>

        <div
          className="audio-buttons"
          style={{
            gridTemplateColumns:
              showAIGraphs && aiModelSignal ? "1fr 1fr 1fr" : "1fr 1fr",
          }}
        >
          <button className="audio-btn" onClick={handlePlayInputAudio}>
            🔊 Play Input Audio
          </button>
          <button className="audio-btn" onClick={handlePlayOutputAudio}>
            🔊 Play Slider Output
          </button>
          {showAIGraphs && aiModelSignal && (
            <button
              className="audio-btn"
              onClick={handlePlayAIAudio}
              style={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
              }}
            >
              🔊 Play AI Model Output
            </button>
          )}
        </div>

        <div
          className="viewers-grid"
          style={{
            gridTemplateColumns: getGridColumns(),
          }}
        >
          <SignalViewer
            signal={inputSignal}
            title="Input Signal (Original)"
            isPlaying={isPlaying}
            currentTime={currentTime}
            zoom={zoom}
            pan={pan}
          />
          {comparisonMode === "ai" && aiModelSignal ? (
            <SignalViewer
              signal={aiModelSignal}
              title="AI Model Output"
              isPlaying={isPlaying}
              currentTime={currentTime}
              zoom={zoom}
              pan={pan}
            />
          ) : comparisonMode === "slider" ? (
            <SignalViewer
              signal={outputSignal}
              title="Equalizer Output"
              isPlaying={isPlaying}
              currentTime={currentTime}
              zoom={zoom}
              pan={pan}
            />
          ) : (
            <>
              <SignalViewer
                signal={outputSignal}
                title="Slider Output Signal"
                isPlaying={isPlaying}
                currentTime={currentTime}
                zoom={zoom}
                pan={pan}
              />
              {showAIGraphs && aiModelSignal && (
                <SignalViewer
                  signal={aiModelSignal}
                  title="AI Model Output"
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  zoom={zoom}
                  pan={pan}
                />
              )}
            </>
          )}
        </div>

        <section className="section">
          <div className="fourier-section">
            <h2 className="section-title">📊 Fourier Transform</h2>
            <div className="scale-toggle">
              <label>Scale:</label>
              <select
                value={fftScale}
                onChange={(e) => setFftScale(e.target.value)}
                className="mode-selector"
              >
                <option value="linear">Linear</option>
                <option value="audiogram">Audiogram</option>
              </select>
            </div>
          </div>

          <div
            className="fourier-graphs-grid"
            style={{
              gridTemplateColumns: getGridColumns(),
            }}
          >
            <FourierGraph
              fourierData={inputFourierData}
              scale={fftScale}
              title="Input FFT (Original)"
              isLoading={isLoadingFFT}
              error={fftError}
            />
            {comparisonMode === "ai" && aiModelFourierData ? (
              <FourierGraph
                fourierData={aiModelFourierData}
                scale={fftScale}
                title="AI Model FFT"
                isLoading={isLoadingFFT}
                error={fftError}
              />
            ) : comparisonMode === "slider" ? (
              <FourierGraph
                fourierData={outputFourierData}
                scale={fftScale}
                title="Equalizer FFT"
                isLoading={isLoadingFFT}
                error={fftError}
              />
            ) : (
              <>
                <FourierGraph
                  fourierData={outputFourierData}
                  scale={fftScale}
                  title="Slider Output FFT"
                  isLoading={isLoadingFFT}
                  error={fftError}
                />
                {showAIGraphs && aiModelFourierData && (
                  <FourierGraph
                    fourierData={aiModelFourierData}
                    scale={fftScale}
                    title="AI Model FFT"
                    isLoading={isLoadingFFT}
                    error={fftError}
                  />
                )}
              </>
            )}
          </div>
        </section>

        <section className="spectrograms-controls">
          <h2 className="section-title">📈 Spectrograms</h2>
          <button
            className={`toggle-btn ${showSpectrograms ? "active" : ""}`}
            onClick={() => setShowSpectrograms(!showSpectrograms)}
          >
            {showSpectrograms ? "👁️ Hide" : "👁️ Show"}
          </button>
        </section>

        {showSpectrograms && (
          <div
            className="spectrograms-grid"
            style={{
              gridTemplateColumns: getGridColumns(),
            }}
          >
            <Spectrogram
              signal={inputSignal}
              title="Input Spectrogram (Original)"
              visible={showSpectrograms}
            />
            {comparisonMode === "ai" && aiModelSignal ? (
              <Spectrogram
                signal={aiModelSignal}
                title="AI Model Spectrogram"
                visible={showSpectrograms}
              />
            ) : comparisonMode === "slider" ? (
              <Spectrogram
                signal={outputSignal}
                title="Equalizer Spectrogram"
                visible={showSpectrograms}
              />
            ) : (
              <>
                <Spectrogram
                  signal={outputSignal}
                  title="Slider Output Spectrogram"
                  visible={showSpectrograms}
                />
                {showAIGraphs && aiModelSignal && (
                  <Spectrogram
                    signal={aiModelSignal}
                    title="AI Model Spectrogram"
                    visible={showSpectrograms}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MainPage;
