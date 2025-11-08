import React, { useState, useEffect, useRef, useCallback } from 'react';
import SignalViewer from './SignalViewer';
import CineController from './CineController';
import './LinkedSignalViewers.css';

function LinkedSignalViewers({ 
  inputSignal, 
  outputSignal, 
  aiModelSignal,
  showAIViewer = false 
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);

  const animationRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const accumulatedTimeRef = useRef(0);

  // Optimized animation loop with time accumulation
  useEffect(() => {
    if (!isPlaying || !inputSignal) {
      lastFrameTimeRef.current = null;
      return;
    }

    const animate = (timestamp) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
        accumulatedTimeRef.current = currentTime;
      }

      const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      // Accumulate time for smooth playback
      accumulatedTimeRef.current += deltaTime * playbackSpeed;
      
      // Handle looping
      if (accumulatedTimeRef.current >= inputSignal.duration) {
        accumulatedTimeRef.current = 0;
      }
      
      setCurrentTime(accumulatedTimeRef.current);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, inputSignal]);

  const handlePlay = useCallback(() => {
    if (!inputSignal) return;
    setIsPlaying(true);
    setIsPaused(false);
    lastFrameTimeRef.current = null;
    accumulatedTimeRef.current = currentTime;
  }, [inputSignal, currentTime]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(true);
    lastFrameTimeRef.current = null;
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    setPan(0);
    lastFrameTimeRef.current = null;
    accumulatedTimeRef.current = 0;
  }, []);

  const handleSpeedChange = useCallback((e) => {
    const newSpeed = parseFloat(e.target.value);
    setPlaybackSpeed(newSpeed);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.5, 20));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.5, 1));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan(0);
    setCurrentTime(0);
    accumulatedTimeRef.current = 0;
  }, []);

  const handlePanChange = useCallback((newPan) => {
    if (!isPlaying) {
      setPan(newPan);
    }
  }, [isPlaying]);

  const handleZoomChange = useCallback((newZoom) => {
    setZoom(newZoom);
  }, []);

  return (
    <div className="linked-viewers-container">
      <h2 className="section-title">📺 Linked Cine Signal Viewers</h2>
      
      <CineController
        isPlaying={isPlaying}
        isPaused={isPaused}
        playbackSpeed={playbackSpeed}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSpeedChange={handleSpeedChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        currentTime={currentTime}
        duration={inputSignal?.duration || 0}
      />

      <div 
        className="viewers-grid" 
        style={{ 
          gridTemplateColumns: showAIViewer ? 'repeat(3, 1fr)' : '1fr 1fr' 
        }}
      >
        <SignalViewer
          signal={inputSignal}
          title="Input Signal (Original)"
          isPlaying={isPlaying}
          currentTime={currentTime}
          zoom={zoom}
          pan={pan}
          onPanChange={handlePanChange}
          onZoomChange={handleZoomChange}
          isCineMode={true}
        />
        
        <SignalViewer
          signal={outputSignal}
          title="Equalizer Output"
          isPlaying={isPlaying}
          currentTime={currentTime}
          zoom={zoom}
          pan={pan}
          onPanChange={handlePanChange}
          onZoomChange={handleZoomChange}
          isCineMode={true}
        />

        {showAIViewer && aiModelSignal && (
          <SignalViewer
            signal={aiModelSignal}
            title="AI Model Output"
            isPlaying={isPlaying}
            currentTime={currentTime}
            zoom={zoom}
            pan={pan}
            onPanChange={handlePanChange}
            onZoomChange={handleZoomChange}
            isCineMode={true}
          />
        )}
      </div>
    </div>
  );
}

export default LinkedSignalViewers;