import React, { useState, useRef, useEffect } from "react";
import EqualizerSlider from "../components/EqualizerSlider";
import SignalViewer from "../components/SignalViewer";
import Spectrogram from "../components/Spectrogram";
import FourierGraph from "../components/FourierGraph";
import { getModeConfig } from "../utils/modeConfigs";

function MainPage() {
  const [currentMode, setCurrentMode] = useState("generic");
  const [sliders, setSliders] = useState([]);
  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);
  const [fourierData, setFourierData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSpectrograms, setShowSpectrograms] = useState(true);
  const [fftScale, setFftScale] = useState("linear");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);

  const fileInputRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    const config = getModeConfig(currentMode);
    setSliders(config.sliders);
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
        const signalData = {
          data: Array.from(channelData),
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
        };

        setInputSignal(signalData);
        setOutputSignal(signalData);
        setCurrentTime(0);

        computeFourierTransform(signalData);
      } catch (error) {
        console.error("Error loading audio file:", error);
        alert("Error loading file. Please try a different audio file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const computeFourierTransform = async (signal) => {
    try {
      const response = await fetch("http://localhost:5000/api/fft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: signal.data,
          sampleRate: signal.sampleRate,
        }),
      });

      const result = await response.json();
      setFourierData(result);
    } catch (error) {
      console.error("Error computing FFT:", error);
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

  const handleFreqChange = (sliderId, field, value) => {
    setSliders((prev) =>
      prev.map((slider) => {
        if (slider.id === sliderId) {
          const updated = { ...slider, [field]: value };
          if (field === "minFreq" || field === "width") {
            const minFreq = field === "minFreq" ? value : slider.minFreq;
            const width = field === "width" ? value : slider.width;
            updated.freqRanges = [[minFreq, minFreq + width]];
          }
          return updated;
        }
        return slider;
      })
    );
  };

  const applyEqualization = async () => {
    if (!inputSignal) return;

    try {
      const response = await fetch("http://localhost:5000/api/equalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: inputSignal.data,
          sampleRate: inputSignal.sampleRate,
          sliders: sliders,
          mode: currentMode,
        }),
      });

      const result = await response.json();
      setOutputSignal({
        data: result.outputSignal,
        sampleRate: inputSignal.sampleRate,
        duration: inputSignal.duration,
      });
    } catch (error) {
      console.error("Error applying equalization:", error);
    }
  };

  const handleAddSlider = () => {
    const newSlider = {
      id: Date.now(),
      label: `Range ${sliders.length + 1}`,
      value: 1,
      min: 0,
      max: 2,
      minFreq: 0,
      width: 1000,
      freqRanges: [[0, 1000]],
    };
    setSliders([...sliders, newSlider]);
  };

  const handleRemoveSlider = (sliderId) => {
    setSliders((prev) => prev.filter((s) => s.id !== sliderId));
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
      } catch (error) {
        console.error("Error loading settings:", error);
        alert("Invalid settings file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
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

      <div className="main-container">
        {/* Equalizer Sliders */}
        <section className="section">
          <h2 className="section-title">
            🎚️ Equalizer -{" "}
            {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode
          </h2>
          <div className="equalizer-sliders">
            {sliders.map((slider) => (
              <EqualizerSlider
                key={slider.id}
                slider={slider}
                onChange={handleSliderChange}
                onRemove={currentMode === "generic" ? handleRemoveSlider : null}
                showFreqControls={currentMode === "generic"}
                onFreqChange={handleFreqChange}
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
        <div className="audio-buttons">
          <button className="audio-btn" onClick={handlePlayInputAudio}>
            🔊 Play Input Audio
          </button>
          <button className="audio-btn" onClick={handlePlayOutputAudio}>
            🔊 Play Output Audio
          </button>
        </div>

        {/* Signal Viewers */}
        <div className="viewers-grid">
          <SignalViewer
            signal={inputSignal}
            title="Input Signal"
            isPlaying={isPlaying}
            currentTime={currentTime}
            zoom={zoom}
            pan={pan}
          />
          <SignalViewer
            signal={outputSignal}
            title="Output Signal"
            isPlaying={isPlaying}
            currentTime={currentTime}
            zoom={zoom}
            pan={pan}
          />
        </div>

        {/* Fourier Transform Graph - MOVED HERE */}
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
          <FourierGraph fourierData={fourierData} scale={fftScale} />
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
          <div className="spectrograms-grid">
            <Spectrogram
              signal={inputSignal}
              title="Input Spectrogram"
              visible={showSpectrograms}
            />
            <Spectrogram
              signal={outputSignal}
              title="Output Spectrogram"
              visible={showSpectrograms}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default MainPage;
