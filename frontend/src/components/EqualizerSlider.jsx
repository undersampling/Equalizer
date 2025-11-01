import React, { useState } from "react";
import "./EqualizerSlider.css";

function EqualizerSlider({
  slider,
  onChange,
  onRemove,
  showFreqControls,
  onFreqChange,
}) {
  const [isDragging, setIsDragging] = useState(null);

  const handleValueChange = (e) => {
    onChange(slider.id, parseFloat(e.target.value));
  };

  const handleLabelChange = (e) => {
    if (onFreqChange) {
      onFreqChange(slider.id, "label", e.target.value);
    }
  };

  // Visual frequency range selector
  const handleFreqSliderChange = (e, type) => {
    if (onFreqChange) {
      const value = parseFloat(e.target.value);
      if (type === "min") {
        onFreqChange(slider.id, "minFreq", value);
      } else {
        onFreqChange(slider.id, "width", value);
      }
    }
  };

  const maxFreq = 20000; // Maximum frequency range

  return (
    <div className="equalizer-slider">
      <div className="slider-header">
        {showFreqControls ? (
          <input
            type="text"
            className="slider-label-input"
            value={slider.label}
            onChange={handleLabelChange}
            placeholder="Slider Label"
          />
        ) : (
          <label className="slider-label">{slider.label}</label>
        )}
        {onRemove && (
          <button
            className="remove-btn"
            onClick={() => onRemove(slider.id)}
            title="Remove slider"
          >
            ✕
          </button>
        )}
      </div>

      {/* Generic Mode: Visual frequency selector */}
      {showFreqControls && (
        <div className="freq-visual-selector">
          <div className="freq-range-display">
            <span className="freq-value">
              {(slider.minFreq || 0).toFixed(0)} Hz
            </span>
            <span className="freq-separator">→</span>
            <span className="freq-value">
              {((slider.minFreq || 0) + (slider.width || 1000)).toFixed(0)} Hz
            </span>
          </div>

          <div className="freq-sliders">
            <div className="freq-slider-group">
              <label>Start Frequency</label>
              <input
                type="range"
                min="0"
                max={maxFreq - (slider.width || 1000)}
                step="10"
                value={slider.minFreq || 0}
                onChange={(e) => handleFreqSliderChange(e, "min")}
                className="freq-range-input"
              />
            </div>

            <div className="freq-slider-group">
              <label>Frequency Width</label>
              <input
                type="range"
                min="100"
                max={maxFreq - (slider.minFreq || 0)}
                step="10"
                value={slider.width || 1000}
                onChange={(e) => handleFreqSliderChange(e, "width")}
                className="freq-range-input"
              />
            </div>
          </div>

          {/* Visual frequency bar */}
          <div className="freq-visual-bar">
            <div
              className="freq-selected-range"
              style={{
                left: `${((slider.minFreq || 0) / maxFreq) * 100}%`,
                width: `${((slider.width || 1000) / maxFreq) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Other Modes: Show frequency ranges */}
      {!showFreqControls && slider.freqRanges && (
        <div className="freq-info">
          {slider.freqRanges.map((range, idx) => (
            <span key={idx} className="freq-range">
              {range[0]}-{range[1]} Hz
            </span>
          ))}
        </div>
      )}

      {/* Magnitude Slider */}
      <div className="slider-container">
        <label className="slider-magnitude-label">Magnitude</label>
        <input
          type="range"
          min={slider.min || 0}
          max={slider.max || 2}
          step="0.01"
          value={slider.value}
          onChange={handleValueChange}
          className="slider-input"
        />
        <div className="slider-value">{slider.value.toFixed(2)}</div>
      </div>
    </div>
  );
}

export default EqualizerSlider;
