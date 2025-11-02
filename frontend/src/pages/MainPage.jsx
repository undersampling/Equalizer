
import React, { useState, useRef, useEffect } from "react";
import EqualizerSlider from "../components/EqualizerSlider";
import SliderCreationModal from "../components/SliderCreationModal";
import SignalViewer from "../components/SignalViewer";
import Spectrogram from "../components/Spectrogram";
import FourierGraph from "../components/FourierGraph";
import AIModelSection from "../components/AIModelSection";
import { getModeConfig } from "../utils/modeConfigs";
import { downsampleSignal, limitSignalSize } from "../utils/audioUtils";

function MainPage() {
  const [currentMode, setCurrentMode] = useState("generic");
  const [sliders, setSliders] = useState([]);
  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);
  const [apiSignal, setApiSignal] = useState(null); // Downsampled signal for API calls
  const [aiModelSignal, setAiModelSignal] = useState(null);
  const [inputFourierData, setInputFourierData] = useState(null);
  const [outputFourierData, setOutputFourierData] = useState(null);
  const [aiModelFourierData, setAiModelFourierData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSpectrograms, setShowSpectrograms] = useState(true);
  const [fftScale, setFftScale] = useState("linear");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [showSliderModal, setShowSliderModal] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(null); // 'ai' or 'slider' or null
  const [showAIGraphs, setShowAIGraphs] = useState(false); // New state to control AI graphs visibility
  const [fftError, setFftError] = useState(null); // Error state for FFT
  const [isLoadingFFT, setIsLoadingFFT] = useState(false); // Loading state for FFT

  const fileInputRef = useRef(null);
  const audioContextRef = useRef(null);

  // API base URL - try both ports
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Check if current mode supports AI
  const isAIModeEnabled = currentMode === "musical" || currentMode === "human";

  useEffect(() => {
    const config = getModeConfig(currentMode);
    setSliders(config.sliders);
    // Reset AI model signal and comparison mode when mode changes
    setAiModelSignal(null);
    setAiModelFourierData(null);
    setComparisonMode(null);
    setShowAIGraphs(false);
    // Note: apiSignal is preserved when mode changes to maintain FFT consistency
  }, [currentMode]);

  const handleModeChange = (e) => {
    const newMode = e.target.value;
    setCurrentMode(newMode);
    const config = getModeConfig(newMode);
    setSliders(config.sliders);
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
          16000, // Target sample rate
          100000 // Max samples
        );

        const apiSignal = {
          data: downsampled.data,
          sampleRate: downsampled.sampleRate,
          duration: audioBuffer.duration,
        };

        // Use original for display, but downsampled for API
        setInputSignal(originalSignal);
        setOutputSignal(originalSignal);
        setApiSignal(apiSignal); // Store downsampled signal for API calls
        setCurrentTime(0);
        // Reset AI model output and comparison when new file is loaded
        setAiModelSignal(null);
        setAiModelFourierData(null);
        setComparisonMode(null);
        setShowAIGraphs(false);

        // Use downsampled signal for API calls - both should use same signal
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
      console.warn('No signal data to compute FFT');
      setFftError(null);
      return;
    }

    // Limit signal size before sending
    const limitedSignal = limitSignalSize(signal.data, 100000);
    
    if (limitedSignal.length === 0) {
      console.warn('Signal is empty after limiting');
      setFftError('Signal is too large or empty');
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

      // Check request size
      const requestSize = JSON.stringify(requestBody).length;
      if (requestSize > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('Signal is too large to process. Please use a shorter audio file.');
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
          // If response isn't JSON, use status text
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Validate response structure
      if (!result.frequencies || !result.magnitudes) {
        console.error('Invalid FFT response format:', result);
        throw new Error('Invalid response format from FFT API');
      }

      // Ensure arrays are not empty
      if (result.frequencies.length === 0 || result.magnitudes.length === 0) {
        console.warn('FFT returned empty arrays');
        setFftError('FFT returned empty arrays');
        setIsLoadingFFT(false);
        return;
      }

      console.log(`FFT computed for ${type}:`, {
        frequencies: result.frequencies.length,
        magnitudes: result.magnitudes.length
      });

      // Safely update state with error handling
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
        console.error('Error updating FFT state:', stateError);
        setIsLoadingFFT(false);
        setFftError('Failed to display FFT data. Data may be too large.');
      }
    } catch (error) {
      console.error("Error computing FFT:", error);
      setIsLoadingFFT(false);
      const errorMsg = error.message || 'Failed to fetch FFT data. Make sure the backend is running on ' + API_BASE_URL;
      setFftError(errorMsg);
      
      // Clear the fourier data on error
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
      // Use downsampled signal for equalization API call to match FFT processing
      const response = await fetch(`${API_BASE_URL}/api/equalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: apiSignal.data, // Use downsampled signal for API consistency
          sampleRate: apiSignal.sampleRate,
          sliders: sliders,
          mode: currentMode,
        }),
      });

      const result = await response.json();
      
      // Create output signal with downsampled data from API
      const newOutputApiSignal = {
        data: result.outputSignal,
        sampleRate: apiSignal.sampleRate,
        duration: inputSignal.duration,
      };
      
      // For display, scale up the output to match original signal size
      // But for now, we'll use the downsampled version to match input FFT
      // The backend currently returns unchanged signal, so this maintains consistency
      setOutputSignal({
        data: result.outputSignal.length === apiSignal.data.length 
          ? result.outputSignal 
          : apiSignal.data, // Fallback if sizes don't match
        sampleRate: apiSignal.sampleRate,
        duration: inputSignal.duration,
      });
      
      // Compute Fourier transform for output signal using the same downsampled format
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
    // Apply equalization after creating slider
    setTimeout(() => applyEqualization(), 100);
  };

  const handleRemoveSlider = (sliderId) => {
    setSliders((prev) => prev.filter((s) => s.id !== sliderId));
    setTimeout(() => applyEqualization(), 100);
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
        // Apply equalization after loading settings
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
    setShowAIGraphs(true); // Show AI graphs when processing is complete
    setComparisonMode(null); // Reset comparison mode
    
    if (aiSignal.fourierData) {
      setAiModelFourierData(aiSignal.fourierData);
    } else {
      computeFourierTransform(aiSignal, "ai");
    }
  };

  const handleComparisonChange = (mode) => {
    setComparisonMode(mode);
  };

  // Determine grid layout based on comparison mode and AI graphs visibility
  const getGridColumns = () => {
    if (comparisonMode) {
      return '1fr 1fr'; // Show only 2 columns when comparing
    }
    if (showAIGraphs && aiModelSignal) {
      return 'repeat(3, 1fr)'; // Show 3 columns when AI output exists and graphs are visible
    }
    return '1fr 1fr'; // Default 2 columns
  };

  return (
    <div className="App">
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

        {/* Equalizer Sliders */}
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

        {/* Playback Controls */}
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

        {/* Audio Play Buttons */}
        <div
          className="audio-buttons"
          style={{
            gridTemplateColumns: showAIGraphs && aiModelSignal ? "1fr 1fr 1fr" : "1fr 1fr",
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

        {/* Signal Viewers */}
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

        {/* Fourier Transform Graphs */}
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

        {/* Spectrograms */}
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