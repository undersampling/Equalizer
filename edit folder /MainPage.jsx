// MainPage.jsx
import React, { useState, useRef, useEffect } from "react";
import EqualizerSlider from "../components/EqualizerSlider";
import SliderCreationModal from "../components/SliderCreationModal";
import LinkedViewer from "../components/LinkedViewer";
import Spectrogram from "../components/Spectrogram";
import AIModelSection from "../components/AIModelSection";
import { getModeConfig } from "../utils/modeConfigs";
import { downsampleSignal, limitSignalSize } from "../utils/audioUtils";

function MainPage() {
  const [currentMode, setCurrentMode] = useState("generic");
  const [sliders, setSliders] = useState([]);
  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);
  const [apiSignal, setApiSignal] = useState(null);
  const [aiModelSignal, setAiModelSignal] = useState(null);
  const [inputFourierData, setInputFourierData] = useState(null);
  const [outputFourierData, setOutputFourierData] = useState(null);
  const [aiModelFourierData, setAiModelFourierData] = useState(null);
  const [comparisonMode, setComparisonMode] = useState(null);
  const [showAIGraphs, setShowAIGraphs] = useState(false);
  const [showSliderModal, setShowSliderModal] = useState(false);
  const [fftError, setFftError] = useState(null);
  const [isLoadingFFT, setIsLoadingFFT] = useState(false);
  const [showSpectrograms, setShowSpectrograms] = useState(true);

  const fileInputRef = useRef(null);
  const audioContextRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const isAIModeEnabled = currentMode === "musical" || currentMode === "human";

  // Initialize sliders based on mode
  useEffect(() => {
    const config = getModeConfig(currentMode);
    setSliders(config.sliders);
    setAiModelSignal(null);
    setAiModelFourierData(null);
    setComparisonMode(null);
    setShowAIGraphs(false);
  }, [currentMode]);

  const handleModeChange = (e) => {
    const newMode = e.target.value;
    setCurrentMode(newMode);
  };

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

        // Store original signal for display
        const originalSignal = {
          data: Array.from(channelData),
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
        };

        // Downsample for API calls to prevent memory issues
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
        setAiModelSignal(null);
        setAiModelFourierData(null);
        setComparisonMode(null);
        setShowAIGraphs(false);

        // Compute initial FFT
        computeFourierTransform(apiSignal, "input");
        computeFourierTransform(apiSignal, "output");
      } catch (error) {
        console.error("Error loading audio file:", error);
        alert("Error loading file. Please try a different audio file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

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

    if (inputSignal) {
      applyEqualization();
    }
  };

  const applyEqualization = async () => {
    if (!inputSignal || !apiSignal) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/equalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: apiSignal.data,
          sampleRate: apiSignal.sampleRate,
          sliders: sliders,
          mode: currentMode,
        }),
      });

      const result = await response.json();

      const newOutputApiSignal = {
        data: result.outputSignal,
        sampleRate: apiSignal.sampleRate,
        duration: inputSignal.duration,
      };

      setOutputSignal({
        data:
          result.outputSignal.length === apiSignal.data.length
            ? result.outputSignal
            : apiSignal.data,
        sampleRate: apiSignal.sampleRate,
        duration: inputSignal.duration,
      });

      computeFourierTransform(newOutputApiSignal, "output");
    } catch (error) {
      console.error("Error applying equalization:", error);
    }
  };

  const handleAddSlider = () => {
    setShowSliderModal(true);
  };

  const handleCreateSlider = (newSlider) => {
    setSliders([...sliders, newSlider]);
    setShowSliderModal(false);
    setTimeout(() => applyEqualization(), 100);
  };

  const handleRemoveSlider = (sliderId) => {
    setSliders((prev) => prev.filter((s) => s.id !== sliderId));
    setTimeout(() => applyEqualization(), 100);
  };

  const handleSaveSettings = () => {
    const settings = {
      mode: currentMode,
      sliders: sliders,
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equalizer_settings_${currentMode}.json`;
    a.click();
  };

  const handleLoadSettings = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const settings = JSON.parse(event.target.result);
        setCurrentMode(settings.mode);
        setSliders(settings.sliders);
        setTimeout(() => applyEqualization(), 100);
      } catch (error) {
        console.error("Error loading settings:", error);
        alert("Invalid settings file");
      }
    };
    reader.readAsText(file);
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

  return (
    <div className="App">
      {/* Header Section */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎵 Signal Equalizer</h1>
            <select
              className="mode-selector"
              value={currentMode}
              onChange={handleModeChange}
            >
              <option value="generic">Generic Mode</option>
              <option value="musical">Musical Instruments</option>
              <option value="animal">Animal Sounds</option>
              <option value="human">Human Voices</option>
            </select>
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
            <button className="btn btn-secondary" onClick={handleSaveSettings}>
              💾 Save Settings
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => document.getElementById("loadSettings").click()}
            >
              📂 Load Settings
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

      {/* Slider Creation Modal */}
      {showSliderModal && (
        <SliderCreationModal
          onCreate={handleCreateSlider}
          onCancel={() => setShowSliderModal(false)}
        />
      )}

      {/* Main Container */}
      <div className="main-container">
        {/* AI Model Section - Only show in musical or human mode */}
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

        {/* Equalizer Sliders Section */}
        <section className="section">
          <h2 className="section-title">
            ⚙️ Equalizer -{" "}
            {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode
          </h2>
          <div className="equalizer-sliders">
            {sliders.map((slider) => (
              <EqualizerSlider
                key={slider.id}
                slider={slider}
                onChange={handleSliderChange}
                onRemove={currentMode === "generic" ? handleRemoveSlider : null}
              />
            ))}
          </div>
          {currentMode === "generic" && (
            <button className="add-slider-btn" onClick={handleAddSlider}>
              ➕ Add Slider
            </button>
          )}
        </section>

        {/* LinkedViewer - Contains controller, signal viewers, and Fourier graphs */}
        {/* Audio playback is now handled internally by LinkedViewer */}
        <LinkedViewer
          inputSignal={inputSignal}
          outputSignal={outputSignal}
          aiModelSignal={aiModelSignal}
          comparisonMode={comparisonMode}
          showAIGraphs={showAIGraphs}
          sliders={sliders}
          currentMode={currentMode}
        />

        {/* Spectrograms Section - Remains separate in MainPage */}
        <section className="section">
          <h2 className="section-title">📈 Spectrograms</h2>
          <button
            className={`toggle-btn ${showSpectrograms ? "active" : ""}`}
            onClick={() => setShowSpectrograms(!showSpectrograms)}
          >
            {showSpectrograms ? "👁️ Hide" : "👁️ Show"}
          </button>

          {showSpectrograms && (
            <div
              className="spectrograms-grid"
              style={{
                gridTemplateColumns: comparisonMode
                  ? "1fr 1fr"
                  : showAIGraphs && aiModelSignal
                  ? "repeat(3, 1fr)"
                  : "1fr 1fr",
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
        </section>
      </div>
    </div>
  );
}

export default MainPage;
