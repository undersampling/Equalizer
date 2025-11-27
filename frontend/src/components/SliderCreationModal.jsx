// components/SliderCreationModal.jsx
import React, { useState } from "react";
import "../styles/SliderCreationModal.css";

function SliderCreationModal({ onCreate, onCancel }) {
  const [sliderName, setSliderName] = useState("");
  const [minFreq, setMinFreq] = useState(0);
  const [maxFreq, setMaxFreq] = useState(5000);
  const [isDraggingMin, setIsDraggingMin] = useState(false);
  const [isDraggingMax, setIsDraggingMax] = useState(false);

  const MAX_FREQUENCY = 20000;

  const handleMouseDown = (type) => {
    if (type === "min") setIsDraggingMin(true);
    if (type === "max") setIsDraggingMax(true);
  };

  const handleMouseUp = () => {
    setIsDraggingMin(false);
    setIsDraggingMax(false);
  };

  const handleMouseMove = (e) => {
    if (!isDraggingMin && !isDraggingMax) return;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const frequency = Math.max(
      0,
      Math.min(percentage * MAX_FREQUENCY, MAX_FREQUENCY)
    );

    if (isDraggingMin && frequency < maxFreq) {
      setMinFreq(Math.round(frequency));
    }
    if (isDraggingMax && frequency > minFreq) {
      setMaxFreq(Math.round(frequency));
    }
  };

  const handleCreate = () => {
    if (minFreq >= maxFreq) {
      alert("Min frequency must be less than max frequency");
      return;
    }

    const defaultName = ` Range [${minFreq},${maxFreq}]`;

    const newSlider = {
      id: Date.now(),
      label: sliderName || defaultName,
      value: 1,
      min: 0,
      max: 2,
      minFreq: minFreq,
      width: maxFreq - minFreq,
      freqRanges: [[minFreq, maxFreq]],
    };

    onCreate(newSlider);
  };

  const minPercent = (minFreq / MAX_FREQUENCY) * 100;
  const maxPercent = (maxFreq / MAX_FREQUENCY) * 100;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Create New Slider</h2>

        {/* Name Input */}
        <div className="form-group">
          <label htmlFor="slider-name">Slider Name (Optional)</label>
          <input
            id="slider-name"
            type="text"
            placeholder="e.g., Bass, Treble, Midrange"
            value={sliderName}
            onChange={(e) => setSliderName(e.target.value)}
            className="name-input"
          />
        </div>

        {/* Frequency Range Selector */}
        <div className="form-group">
          <label>Select Frequency Range (0 - 20,000 Hz)</label>
          <p
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              marginTop: "4px",
              marginBottom: "8px",
            }}
          >
            ⓘ This range will be fixed for this slider. You'll control the
            amplitude (gain) factor separately.
          </p>

          {/* Visual Frequency Bar */}
          <div
            className="freq-crop-container"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="freq-crop-bar">
              {/* Left handle */}
              <div
                className="freq-handle freq-handle-min"
                style={{ left: `${minPercent}%` }}
                onMouseDown={() => handleMouseDown("min")}
                title="Drag to set minimum frequency"
              />

              {/* Selected range highlight */}
              <div
                className="freq-selected-crop"
                style={{
                  left: `${minPercent}%`,
                  right: `${100 - maxPercent}%`,
                }}
              />

              {/* Right handle */}
              <div
                className="freq-handle freq-handle-max"
                style={{ right: `${100 - maxPercent}%` }}
                onMouseDown={() => handleMouseDown("max")}
                title="Drag to set maximum frequency"
              />
            </div>
          </div>

          {/* Frequency Display */}
          <div className="freq-display">
            <div className="freq-info-box">
              <span className="freq-label">Min:</span>
              <span className="freq-value">{minFreq.toLocaleString()} Hz</span>
            </div>
            <div className="freq-info-box">
              <span className="freq-label">Max:</span>
              <span className="freq-value">{maxFreq.toLocaleString()} Hz</span>
            </div>
            <div className="freq-info-box">
              <span className="freq-label">Width:</span>
              <span className="freq-value">
                {(maxFreq - minFreq).toLocaleString()} Hz
              </span>
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div
          style={{
            fontSize: "12px",
            color: "#7dd3fc",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid rgba(125, 211, 252, 0.2)",
            marginTop: "10px",
          }}
        >
          <strong>Note:</strong> After creating, this slider will have a fixed
          frequency range. Use the amplitude slider to raise (value &gt; 1.0) or
          lower (value &lt; 1.0) the selected frequency range.
        </div>

        {/* Buttons */}
        <div className="modal-buttons">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-create" onClick={handleCreate}>
            Create Slider
          </button>
        </div>
      </div>
    </div>
  );
}

export default SliderCreationModal;
