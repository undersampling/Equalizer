import React from 'react';
import './CineController.css';

function CineController({
  isPlaying,
  isPaused,
  playbackSpeed,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onZoomIn,
  onZoomOut,
  onReset,
  currentTime,
  duration
}) {
  return (
    <div className="cine-controller">
      <div className="controls-row">
        {/* Playback Controls */}
        <div className="playback-controls">
          <button 
            className={`control-btn play ${isPlaying ? 'active' : ''}`} 
            onClick={onPlay}
            disabled={isPlaying}
          >
            ▶ Play
          </button>
          <button 
            className={`control-btn pause ${isPaused ? 'active' : ''}`} 
            onClick={onPause}
            disabled={!isPlaying}
          >
            ⏸ Pause
          </button>
          <button 
            className="control-btn stop" 
            onClick={onStop}
          >
            ⏹ Stop
          </button>
        </div>

        {/* Time Display */}
        <div className="time-display">
          <span className="current-time">{currentTime.toFixed(2)}s</span>
          <span className="separator"> / </span>
          <span className="total-time">{duration ? duration.toFixed(2) : '0.00'}s</span>
        </div>

        {/* Speed Control - Extended range */}
        <div className="speed-control">
          <label>Speed:</label>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={playbackSpeed}
            onChange={onSpeedChange}
          />
          <span className="speed-value">{playbackSpeed.toFixed(1)}x</span>
        </div>

        {/* Quick Speed Buttons */}
        <div className="quick-speed-controls">
          <button 
            className="speed-btn"
            onClick={() => onSpeedChange({ target: { value: '0.25' } })}
            style={{ opacity: playbackSpeed === 0.25 ? 1 : 0.7 }}
          >
            0.25x
          </button>
          <button 
            className="speed-btn"
            onClick={() => onSpeedChange({ target: { value: '0.5' } })}
            style={{ opacity: playbackSpeed === 0.5 ? 1 : 0.7 }}
          >
            0.5x
          </button>
          <button 
            className="speed-btn"
            onClick={() => onSpeedChange({ target: { value: '1' } })}
            style={{ opacity: playbackSpeed === 1 ? 1 : 0.7 }}
          >
            1x
          </button>
          <button 
            className="speed-btn"
            onClick={() => onSpeedChange({ target: { value: '2' } })}
            style={{ opacity: playbackSpeed === 2 ? 1 : 0.7 }}
          >
            2x
          </button>
        </div>

        {/* View Controls */}
        <div className="view-controls">
          <button className="control-btn zoom-in" onClick={onZoomIn}>
            🔍+ Zoom In
          </button>
          <button className="control-btn zoom-out" onClick={onZoomOut}>
            🔍- Zoom Out
          </button>
          <button className="control-btn reset" onClick={onReset}>
            🔄 Reset View
          </button>
        </div>
      </div>
    </div>
  );
}

export default CineController;