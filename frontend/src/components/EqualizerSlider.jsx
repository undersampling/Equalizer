// components/EqualizerSlider.jsx
import React, { useMemo } from "react";
import "./EqualizerSlider.css";

function EqualizerSlider({ slider, onChange, onRemove }) {
  const handleValueChange = (e) => {
    onChange(slider.id, parseFloat(e.target.value));
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
          <div className="freq-range-display">
            {slider.freqRanges[0][0].toLocaleString()} -{" "}
            {slider.freqRanges[0][1].toLocaleString()} Hz
          </div>
        )}
      </div>

      {/* Vertical Magnitude Slider with Amplitude Axis */}
      <div className="slider-container">
        <label className="slider-magnitude-label">Amplitude</label>
        
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
            onChange={handleValueChange}
            className="slider-input"
          />
        </div>

        <div className="slider-value">{slider.value.toFixed(2)}</div>
      </div>
    </div>
  );
}

export default EqualizerSlider;