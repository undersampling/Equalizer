import React, { useState, useEffect } from "react";
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

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
      const response = await fetch(`${API_BASE_URL}/api/separate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: inputSignal.data,
          sampleRate: inputSignal.sampleRate,
          stems: ["drums", "bass", "vocals", "piano", "guitar", "other"],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();
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
