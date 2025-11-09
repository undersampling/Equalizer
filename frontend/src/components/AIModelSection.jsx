import React, { useState, useRef } from "react";
import "../styles/AIModelSection.css";

function AIModelSection({ mode, inputSignal, outputSignal, onModelResult, onComparisonChange }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(null);
  const [separatedVoices, setSeparatedVoices] = useState(null);
  const [voiceGains, setVoiceGains] = useState({});
  const [isRemixing, setIsRemixing] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(null);
  const audioContextRef = useRef(null);
  const audioSourceRefs = useRef({});
  const previousComparisonModeRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const processWithAI = async () => {
    if (!inputSignal) {
      alert("Please load an audio file first.");
      return;
    }

    setIsProcessing(true);

    try {
      if (mode === "human") {
        // Human voice separation
        const response = await fetch(`${API_BASE_URL}/api/separate-voices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signal: inputSignal.data,
            sampleRate: inputSignal.sampleRate,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }

        const result = await response.json();
        setSeparatedVoices(result.voices);
        
        // Initialize gains to 1.0 for all voices
        const initialGains = {};
        Object.keys(result.voices).forEach((voiceKey) => {
          initialGains[voiceKey] = 1.0;
        });
        setVoiceGains(initialGains);

        // Initial mix with all voices at 1.0
        await remixVoices(result.voices, initialGains);
      } else {
        // Original mock processing for other modes
        setTimeout(() => {
          const processedData = inputSignal.data.map((sample, i) => {
            if (i === 0 || i === inputSignal.data.length - 1) return sample;
            return (inputSignal.data[i - 1] + sample + inputSignal.data[i + 1]) / 3;
          });

          const aiSignal = {
            data: processedData,
            sampleRate: inputSignal.sampleRate,
            duration: inputSignal.duration,
          };

          onModelResult(aiSignal);
          setShowComparison(true);
          setIsProcessing(false);
        }, 1500);
        return;
      }
    } catch (error) {
      console.error("AI processing error:", error);
      alert(`Error processing with AI: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const remixVoices = async (voices, gains) => {
    if (!voices) return;
    
    setIsRemixing(true);
    try {
      // Prepare voices with gains
      const voicesWithGains = {};
      Object.keys(voices).forEach((voiceKey) => {
        voicesWithGains[voiceKey] = {
          data: voices[voiceKey].data,
          gain: gains[voiceKey] !== undefined ? gains[voiceKey] : 1.0,
        };
      });

      const response = await fetch(`${API_BASE_URL}/api/mix-voices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voices: voicesWithGains,
          sampleRate: inputSignal.sampleRate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();

      const aiSignal = {
        data: result.mixedSignal,
        sampleRate: result.sampleRate,
        duration: inputSignal.duration,
      };

      onModelResult(aiSignal);
      setShowComparison(true);
      
      // Store current comparison mode before resetting
      const currentMode = comparisonMode;
      previousComparisonModeRef.current = currentMode;
      
      // Reset comparison mode when remixing to make buttons return to default
      setComparisonMode(null);
      onComparisonChange(null);
      
      // Automatically restore the previous comparison mode after a short delay
      // This allows the UI to update first, then restore the mode
      setTimeout(() => {
        if (previousComparisonModeRef.current) {
          setComparisonMode(previousComparisonModeRef.current);
          onComparisonChange(previousComparisonModeRef.current);
        }
      }, 100);
    } catch (error) {
      console.error("Remix error:", error);
      alert(`Error remixing voices: ${error.message}`);
    } finally {
      setIsRemixing(false);
      setIsProcessing(false);
    }
  };

  const handleVoiceGainChange = (voiceKey, gain) => {
    const newGains = { ...voiceGains, [voiceKey]: gain };
    setVoiceGains(newGains);
    
    // Remix with new gains
    if (separatedVoices) {
      remixVoices(separatedVoices, newGains);
    }
  };

  const playVoice = async (voiceKey) => {
    if (!separatedVoices || !separatedVoices[voiceKey]) return;

    // Stop currently playing voice if any
    if (playingVoice && audioSourceRefs.current[playingVoice]) {
      try {
        audioSourceRefs.current[playingVoice].stop();
      } catch (e) {
        // Already stopped
      }
      audioSourceRefs.current[playingVoice] = null;
    }

    // If clicking the same voice, stop it
    if (playingVoice === voiceKey) {
      setPlayingVoice(null);
      return;
    }

    try {
      // Initialize audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const voiceData = separatedVoices[voiceKey].data;
      const sampleRate = separatedVoices[voiceKey].sampleRate;

      // Create audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(1, voiceData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(voiceData);

      // Create and play audio source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        setPlayingVoice(null);
        audioSourceRefs.current[voiceKey] = null;
      };

      source.start(0);
      audioSourceRefs.current[voiceKey] = source;
      setPlayingVoice(voiceKey);
    } catch (error) {
      console.error("Error playing voice:", error);
      alert(`Error playing voice: ${error.message}`);
    }
  };

  const handleComparison = (type) => {
    const newMode = comparisonMode === type ? null : type;
    setComparisonMode(newMode);
    onComparisonChange(newMode);
  };

  return (
    <section className="section ai-model-section">
      <h2 className="section-title">
        🤖 AI Model - {mode === "musical" ? "Music" : "Voice"} Processing
      </h2>

      <div className="ai-controls">
        <div className="ai-status">
          <span className="status-indicator loaded">✓</span>
          <span className="status-text">
            {mode === "human" ? "Voice Separation Model Ready" : "Mock Model Ready"}
          </span>
        </div>

        <button
          className="btn ai-process-btn"
          onClick={processWithAI}
          disabled={!inputSignal || isProcessing || isRemixing}
        >
          {isProcessing ? "⏳ Processing..." : isRemixing ? "🔄 Remixing..." : "🚀 Process with AI"}
        </button>
      </div>

      {/* Voice separation controls for human mode */}
      {mode === "human" && separatedVoices && (
        <div className="voice-separation-controls">
          <h3 className="voice-separation-title">🎤 Separated Voices</h3>
          <div className="voice-sliders-container">
            {Object.keys(separatedVoices).map((voiceKey, index) => (
              <div key={voiceKey} className="voice-slider-item">
                <label className="voice-slider-label">
                  Voice {index + 1}
                </label>
                <div className="voice-slider-wrapper">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={voiceGains[voiceKey] !== undefined ? voiceGains[voiceKey] : 1.0}
                    onChange={(e) => handleVoiceGainChange(voiceKey, parseFloat(e.target.value))}
                    className="voice-slider"
                  />
                  <span className="voice-slider-value">
                    {(voiceGains[voiceKey] !== undefined ? voiceGains[voiceKey] : 1.0).toFixed(2)}
                  </span>
                  <button
                    className="voice-play-btn"
                    onClick={() => playVoice(voiceKey)}
                    title={playingVoice === voiceKey ? "Stop" : "Play"}
                  >
                    {playingVoice === voiceKey ? "⏸️" : "▶️"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showComparison && (
        <div className="comparison-section">
          <h3 className="comparison-title">📊 Compare Results</h3>

          <div className="comparison-buttons">
            <button
              className={`comparison-btn ${comparisonMode === "ai" ? "active" : ""}`}
              onClick={() => handleComparison("ai")}
            >
              <span className="comparison-icon">🤖</span>
              <div className="comparison-btn-content">
                <div className="comparison-btn-title">Original vs AI</div>
                <div className="comparison-btn-subtitle">AI processed output</div>
              </div>
            </button>

            <button
              className={`comparison-btn ${comparisonMode === "slider" ? "active" : ""}`}
              onClick={() => handleComparison("slider")}
            >
              <span className="comparison-icon">⚙️</span>
              <div className="comparison-btn-content">
                <div className="comparison-btn-title">Original vs Equalizer</div>
                <div className="comparison-btn-subtitle">Slider processed output</div>
              </div>
            </button>

            {outputSignal && (
              <button
                className={`comparison-btn ${comparisonMode === "equalizer_vs_ai" ? "active" : ""}`}
                onClick={() => handleComparison("equalizer_vs_ai")}
              >
                <span className="comparison-icon">🔄</span>
                <div className="comparison-btn-content">
                  <div className="comparison-btn-title">Equalizer vs AI</div>
                  <div className="comparison-btn-subtitle">Compare processed outputs</div>
                </div>
              </button>
            )}
          </div>

          {comparisonMode && (
            <div className="comparison-info">
              <div className="info-badge">
                Viewing: {
                  comparisonMode === "ai" ? "Original vs AI Model" :
                  comparisonMode === "slider" ? "Original vs Equalizer" :
                  "Equalizer vs AI"
                }
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default AIModelSection;
