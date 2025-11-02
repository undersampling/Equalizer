
import React, { useState } from "react";

function AIModelSection({ mode, inputSignal, onModelResult, onComparisonChange }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(null);

  const processWithAI = async () => {
    if (!inputSignal) {
      alert("Please load an audio file first.");
      return;
    }

    setIsProcessing(true);

    // Simulate AI processing delay
    setTimeout(() => {
      // Simple signal processing
      const processedData = inputSignal.data.map((sample, i) => {
        if (i === 0 || i === inputSignal.data.length - 1) return sample;
        return (inputSignal.data[i - 1] + sample + inputSignal.data[i + 1]) / 3;
      });

      // Create AI output signal
      const aiSignal = {
        data: processedData,
        sampleRate: inputSignal.sampleRate,
        duration: inputSignal.duration,
      };

      onModelResult(aiSignal);
      setShowComparison(true);
      setIsProcessing(false);
    }, 1500);
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
          <span className="status-text">Mock Model Ready</span>
        </div>

        <button
          className="btn ai-process-btn"
          onClick={processWithAI}
          disabled={!inputSignal || isProcessing}
        >
          {isProcessing ? "⏳ Processing..." : "🚀 Process with AI"}
        </button>
      </div>

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
          </div>

          {comparisonMode && (
            <div className="comparison-info">
              <div className="info-badge">
                Viewing: Original vs {comparisonMode === "ai" ? "AI Model" : "Equalizer"}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default AIModelSection;