// components/EqualizerSlider.jsx
import React, { useMemo } from "react";
import "../styles/EqualizerSlider.css";

function EqualizerSlider({ slider, onChange, onRemove, onMouseUp }) {
  // Handle input event for real-time visual feedback only (no equalization)
  const handleInput = (e) => {
    // Update immediately for visual feedback (onInput fires continuously while dragging)
    onChange(slider.id, parseFloat(e.target.value), false); // false = visual update only
  };

  // Handle change event (fires on mouse release in some browsers)
  const handleValueChange = (e) => {
    onChange(slider.id, parseFloat(e.target.value), false); // Still visual only, mouseUp will trigger equalization
  };

  // Handle mouse up - trigger equalization
  const handleMouseUp = (e) => {
    const value = parseFloat(e.target.value);
    onChange(slider.id, value, false); // Update visual state
    if (onMouseUp) {
      onMouseUp(slider.id, value); // Trigger equalization
    }
  };

  // Generate amplitude axis values
  const amplitudeValues = useMemo(() => {
    const min = slider.min || 0;
    const max = slider.max || 2;
    const step = (max - min) / 10;
    const values = [];
    
    for (let i = 0; i <= 10; i++) {
      values.push((min + i * step).toFixed(1));
    }
    
    return values.reverse(); // Reverse so max is at top
  }, [slider.min, slider.max]);

  return (
    <div className="equalizer-slider">
      {onRemove && (
        <button
          className="remove-btn"
          onClick={() => onRemove(slider.id)}
          title="Remove slider"
        >
          ✕
        </button>
      )}

      <div className="slider-header">
        <label className="slider-label">{slider.label}</label>
        {slider.freqRanges && slider.freqRanges[0] && (
          <div className="freq-range-display" title="Fixed frequency range for this slider">
            <span className="freq-range-label">Frequency Range (Fixed):</span>{" "}
            {slider.freqRanges[0][0].toLocaleString()} -{" "}
            {slider.freqRanges[0][1].toLocaleString()} Hz
          </div>
        )}
      </div>

      {/* Vertical Amplitude/Gain Slider */}
      <div className="slider-container">
        <label className="slider-magnitude-label">
          Amplitude Factor (Gain)
          <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", fontWeight: "400" }}>
            Adjust gain for the frequency range above
          </div>
        </label>
        
        {/* Slider Wrapper with Axis */}
        <div className="slider-wrapper">
          {/* Amplitude Axis */}
          <div className="amplitude-axis">
            {amplitudeValues.map((value, index) => (
              <div key={index} className="amplitude-tick">
                <span className="amplitude-value">{value}</span>
              </div>
            ))}
          </div>

          {/* Slider Input */}
          <input
            type="range"
            min={slider.min || 0}
            max={slider.max || 2}
            step="0.01"
            value={slider.value}
            onInput={handleInput}
            onChange={handleValueChange}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
            className="slider-input"
          />
        </div>

        <div className="slider-value">
          <div style={{ fontSize: "14px", fontWeight: "700" }}>
            {slider.value.toFixed(2)}x
          </div>
          <div style={{ fontSize: "10px", color: slider.value < 1.0 ? "#ef4444" : slider.value > 1.0 ? "#10b981" : "#94a3b8", marginTop: "4px" }}>
            {slider.value < 1.0 
              ? `↓ Lowering ${((1 - slider.value) * 100).toFixed(0)}%` 
              : slider.value > 1.0 
              ? `↑ Raising ${((slider.value - 1) * 100).toFixed(0)}%`
              : "Neutral (No Change)"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EqualizerSlider;