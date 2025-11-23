import React, { useState, useEffect } from "react";
import apiService from "../services/api";
import "../styles/UnifiedMusicController.css";

function UnifiedMusicController({
  inputSignal,
  sliders,
  onSliderChange,
  onAIToggle,
  isAIEnabled,
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [separatedStems, setSeparatedStems] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");



  // Automatically trigger AI separation when toggled ON
  useEffect(() => {
    if (isAIEnabled && !separatedStems && inputSignal) {
      handleAISeparation();
    }
  }, [isAIEnabled]);

  const handleAISeparation = async () => {
    if (!inputSignal || !inputSignal.data) {
      setError("Please load an audio file first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress("🎧 Separating instruments with AI (1-3 minutes)...");

    try {
      const response = await apiService.separate(
        inputSignal.data,
        inputSignal.sampleRate
      );
      const result = response.data;
      setSeparatedStems(result.stems);
      setProgress("✅ AI separation complete!");

      // Notify parent that stems are ready
      if (onAIToggle) {
        onAIToggle(true, result.stems);
      }
    } catch (err) {
      console.error("Music separation error:", err);
      setError(err.message);
      setProgress("");
      if (onAIToggle) {
        onAIToggle(false, null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const getSliderMode = () => {
    if (isAIEnabled && separatedStems) {
      return "AI Stem Mixing";
    }
    return "Frequency-Based Equalization";
  };

  return (
    <div className="unified-music-controller">
      <div className="controller-header">
        <div className="mode-indicator">
          <span
            className={`mode-badge ${isAIEnabled ? "ai-mode" : "manual-mode"}`}
          >
            {isAIEnabled ? "🤖 AI Mode" : "🎛️ Manual Mode"}
          </span>
          <span className="mode-description">{getSliderMode()}</span>
        </div>

        {progress && <div className="progress-message">{progress}</div>}

        {error && <div className="error-message">❌ {error}</div>}
      </div>

      {isProcessing && (
        <div className="processing-overlay">
          <div className="spinner"></div>
          <p>Processing with Demucs AI...</p>
        </div>
      )}
    </div>
  );
}

export default UnifiedMusicController;
