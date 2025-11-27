import React, { useState, useEffect, useRef, useCallback } from "react";
import SignalViewer from "./SignalViewer";
import CineController from "./CineController";
import "../styles/LinkedSignalViewers.css";

function LinkedSignalViewers({
  inputSignal,
  outputSignal,
  aiModelSignal,
  showAIViewer = false,
  comparisonMode = null,
  inputTitle = "Input Signal (Original)",
  outputTitle = "Equalizer Output"
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(true);

  // Refs
  const animationRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const accumulatedTimeRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);

  // --- CRITICAL FIX: This function now ONLY handles Audio ---
  // We removed the cancellation of animationRef here. 
  // The useEffect below manages the loop lifecycle automatically.
  const stopAudioSourceOnly = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      audioSourceRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioSourceOnly();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stopAudioSourceOnly]);

  // === MAIN ANIMATION LOOP ===
  // This loop runs WHENEVER isPlaying is true.
  useEffect(() => {
    if (!isPlaying) {
      // If we stop playing, cancel the loop immediately
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastFrameTimeRef.current = null;
      return;
    }

    const animate = (timestamp) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }
      const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      // 1. If Audio is connected, sync to it
      if (audioSourceRef.current && audioContextRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        accumulatedTimeRef.current = elapsed;
        setCurrentTime(elapsed);
        
        // Auto-stop at end
        if (inputSignal && elapsed >= inputSignal.duration) {
           handleStop(); // Define handleStop below, this works because of closure
           return; 
        }
      } 
      // 2. If Audio is momentarily disconnected (e.g. during Seek/Toggle), predict time
      else {
        accumulatedTimeRef.current += deltaTime * playbackSpeed;
        setCurrentTime(accumulatedTimeRef.current);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Start the loop
    animationRef.current = requestAnimationFrame(animate);

    // Cleanup: Cancel loop when isPlaying becomes false
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, inputSignal]); // Removed stopAudioSourceOnly dependency to avoid resets

  // === PLAY ===
  const handlePlay = useCallback(() => {
    if (!inputSignal || !outputSignal) return;

    const signalToPlay = isPlayingOriginal ? inputSignal : outputSignal;
    const startOffset = isPaused ? pausedAtRef.current : 0;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const buffer = ctx.createBuffer(1, signalToPlay.data.length, signalToPlay.sampleRate);
    buffer.getChannelData(0).set(signalToPlay.data);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackSpeed;
    source.connect(ctx.destination);
    source.start(0, startOffset);

    audioSourceRef.current = source;
    startTimeRef.current = ctx.currentTime - startOffset;

    accumulatedTimeRef.current = startOffset;
    setCurrentTime(startOffset);
    lastFrameTimeRef.current = null;

    setIsPaused(false);
    setIsPlaying(true); // This triggers the useEffect Loop
  }, [inputSignal, outputSignal, isPlayingOriginal, playbackSpeed, isPaused]);

  // === PAUSE ===
  const handlePause = useCallback(() => {
    if (!isPlaying) return;

    // Capture time
    if (audioSourceRef.current && audioContextRef.current) {
      const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
      pausedAtRef.current = elapsed;
      setCurrentTime(elapsed);
    } else {
      pausedAtRef.current = accumulatedTimeRef.current;
    }

    stopAudioSourceOnly(); // Stop sound
    setIsPlaying(false);   // Stop loop
    setIsPaused(true);
  }, [isPlaying, stopAudioSourceOnly]);

  // === STOP ===
  const handleStop = useCallback(() => {
    stopAudioSourceOnly();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    setPan(0);
    pausedAtRef.current = 0;
    accumulatedTimeRef.current = 0;
  }, [stopAudioSourceOnly]);

  // === SEEK (Fix for "Pointer Stops") ===
  const handleSeek = useCallback((seekTime) => {
    // Always update visual immediately
    setCurrentTime(seekTime);
    pausedAtRef.current = seekTime;
    accumulatedTimeRef.current = seekTime;

    if (isPlaying) {
        // 1. Stop Audio ONLY (Loop keeps running)
        stopAudioSourceOnly();

        // 2. Start New Audio
        setTimeout(() => {
            const signalToPlay = isPlayingOriginal ? inputSignal : outputSignal;
            if (!audioContextRef.current) return;
            
            const ctx = audioContextRef.current;
            const buffer = ctx.createBuffer(1, signalToPlay.data.length, signalToPlay.sampleRate);
            buffer.getChannelData(0).set(signalToPlay.data);

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = playbackSpeed;
            source.connect(ctx.destination);
            source.start(0, seekTime);

            audioSourceRef.current = source;
            startTimeRef.current = ctx.currentTime - seekTime;
            
            // Reset frame timer to avoid jumps
            lastFrameTimeRef.current = null;
        }, 10);
    } else {
        setIsPaused(true);
    }
  }, [isPlaying, isPlayingOriginal, inputSignal, outputSignal, playbackSpeed, stopAudioSourceOnly]);

  // === TOGGLE SOURCE (Fix for "Pointer Stops") ===
  const handleToggleAudioSource = useCallback(() => {
    if (!inputSignal || !outputSignal) return;
    
    const wasPlaying = isPlaying;
    const newIsPlayingOriginal = !isPlayingOriginal;
    
    // 1. Calculate current position
    let currentPos = currentTime;
    if (wasPlaying && audioSourceRef.current && audioContextRef.current) {
        currentPos = audioContextRef.current.currentTime - startTimeRef.current;
    }
    pausedAtRef.current = currentPos;
    setCurrentTime(currentPos);

    // 2. Stop Audio (Loop continues if isPlaying is true)
    if (wasPlaying) stopAudioSourceOnly();

    // 3. Swap Mode
    setIsPlayingOriginal(newIsPlayingOriginal);

    // 4. Restart Audio
    if (wasPlaying) {
        setTimeout(() => {
             const signalToPlay = newIsPlayingOriginal ? inputSignal : outputSignal;
             if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
             const ctx = audioContextRef.current;
             if (ctx.state === 'suspended') ctx.resume();

             const buffer = ctx.createBuffer(1, signalToPlay.data.length, signalToPlay.sampleRate);
             buffer.getChannelData(0).set(signalToPlay.data);

             const source = ctx.createBufferSource();
             source.buffer = buffer;
             source.playbackRate.value = playbackSpeed;
             source.connect(ctx.destination);
             source.start(0, currentPos);

             audioSourceRef.current = source;
             startTimeRef.current = ctx.currentTime - currentPos;
             lastFrameTimeRef.current = null;
        }, 20);
    }
  }, [inputSignal, outputSignal, isPlaying, isPlayingOriginal, currentTime, playbackSpeed, stopAudioSourceOnly]);

  // Helpers
  const handleSpeedChange = (e) => {
    const s = parseFloat(e.target.value);
    setPlaybackSpeed(s);
    if (audioSourceRef.current) audioSourceRef.current.playbackRate.value = s;
  };
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 200));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 1));
  const handleReset = () => { setZoom(1); setPan(0); setCurrentTime(0); handleStop(); };
  const handlePanChange = (p) => { if (!isPlaying) setPan(p); };

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
        onToggleAudio={handleToggleAudioSource}
        isPlayingOriginal={isPlayingOriginal}
        comparisonMode={comparisonMode}
      />

      <div
        className="viewers-grid"
        style={{
          gridTemplateColumns: showAIViewer ? "repeat(3, 1fr)" : "1fr 1fr",
        }}
      >
        <SignalViewer
          signal={inputSignal}
          title={inputTitle}
          isPlaying={isPlaying}
          currentTime={currentTime}
          zoom={zoom}
          pan={pan}
          onPanChange={handlePanChange}
          onZoomChange={setZoom}
          onSeek={handleSeek}
          isCineMode={true}
        />

        <SignalViewer
          signal={outputSignal}
          title={outputTitle}
          isPlaying={isPlaying}
          currentTime={currentTime}
          zoom={zoom}
          pan={pan}
          onPanChange={handlePanChange}
          onZoomChange={setZoom}
          onSeek={handleSeek}
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
            onZoomChange={setZoom}
            onSeek={handleSeek}
            isCineMode={true}
          />
        )}
      </div>
    </div>
  );
}

export default LinkedSignalViewers;