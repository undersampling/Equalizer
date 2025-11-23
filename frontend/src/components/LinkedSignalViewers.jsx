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

  const animationRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const accumulatedTimeRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0); // FIXED: Track where we paused
  const animationFrameRef = useRef(null);

  // Stop current audio source
  const stopCurrentAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Source might already be stopped
      }
      audioSourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopCurrentAudio();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stopCurrentAudio]);

  // FIXED: Animation loop runs ALWAYS when playing (Issue #2)
  useEffect(() => {
    if (!isPlaying || !inputSignal) {
      lastFrameTimeRef.current = null;
      return;
    }

    const animate = (timestamp) => {
      if (!isPlaying) return; // Stop if playing was toggled off

      // Initialize timestamp
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }

      const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      // FIXED: Update time immediately when playing starts (Issue #2)
      if (audioSourceRef.current && audioContextRef.current) {
        // Audio is playing - sync with audio time
        const elapsed =
          audioContextRef.current.currentTime - startTimeRef.current;
        accumulatedTimeRef.current = elapsed;
        setCurrentTime(elapsed);
      } else {
        // Visual-only playback (no audio)
        accumulatedTimeRef.current += deltaTime * playbackSpeed;
        setCurrentTime(accumulatedTimeRef.current);
      }

      // Check if reached end
      if (accumulatedTimeRef.current >= inputSignal.duration) {
        accumulatedTimeRef.current = inputSignal.duration;
        setCurrentTime(inputSignal.duration);
        stopCurrentAudio();
        setIsPlaying(false);
        setIsPaused(false);
        pausedAtRef.current = 0;
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, inputSignal, stopCurrentAudio]);

  const handlePlay = useCallback(() => {
    if (!inputSignal || !outputSignal) return;

    const signalToPlay = isPlayingOriginal ? inputSignal : outputSignal;

    // FIXED: Resume from paused position (Issue #3)
    const startOffset = isPaused ? pausedAtRef.current : 0;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;

    // Create audio buffer
    const audioBuffer = audioContext.createBuffer(
      1,
      signalToPlay.data.length,
      signalToPlay.sampleRate
    );
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < signalToPlay.data.length; i++) {
      channelData[i] = signalToPlay.data[i];
    }

    // Create and start source
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = playbackSpeed;
    source.connect(audioContext.destination);

    // FIXED: Start from paused position (Issue #3)
    source.start(0, startOffset);

    // Handle end of playback
    source.onended = () => {
      if (isPlaying) {
        stopCurrentAudio();
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(inputSignal.duration);
        pausedAtRef.current = 0;
        accumulatedTimeRef.current = inputSignal.duration;
      }
    };

    audioSourceRef.current = source;
    startTimeRef.current = audioContext.currentTime - startOffset;

    // FIXED: Set accumulated time to start offset (Issue #2)
    accumulatedTimeRef.current = startOffset;
    setCurrentTime(startOffset);

    setIsPlaying(true);
    setIsPaused(false);
    lastFrameTimeRef.current = null;
  }, [
    inputSignal,
    outputSignal,
    isPlayingOriginal,
    playbackSpeed,
    isPaused,
    isPlaying,
    stopCurrentAudio,
  ]);

  const handlePause = useCallback(() => {
    if (!isPlaying) return;

    // FIXED: Calculate and save current position (Issue #3)
    if (audioSourceRef.current && audioContextRef.current) {
      const elapsed =
        audioContextRef.current.currentTime - startTimeRef.current;
      pausedAtRef.current = elapsed;
      accumulatedTimeRef.current = elapsed;
      setCurrentTime(elapsed);
    } else {
      pausedAtRef.current = accumulatedTimeRef.current;
    }

    stopCurrentAudio();
    setIsPlaying(false);
    setIsPaused(true); // FIXED: Set paused state to true (Issue #3)
    lastFrameTimeRef.current = null;
  }, [isPlaying, stopCurrentAudio]);

  const handleStop = useCallback(() => {
    stopCurrentAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    setPan(0);
    lastFrameTimeRef.current = null;
    accumulatedTimeRef.current = 0;
    pausedAtRef.current = 0; // FIXED: Reset pause position
  }, [stopCurrentAudio]);

  const handleSpeedChange = useCallback(
    (e) => {
      const newSpeed = parseFloat(e.target.value);
      setPlaybackSpeed(newSpeed);

      // Update playback speed if currently playing
      if (isPlaying && audioSourceRef.current) {
        audioSourceRef.current.playbackRate.value = newSpeed;
      }
    },
    [isPlaying]
  );

  // Toggle between original and equalized audio during playback
  const handleToggleAudioSource = useCallback(() => {
    if (!inputSignal || !outputSignal) return;

    const wasPlaying = isPlaying;
    const newIsPlayingOriginal = !isPlayingOriginal;

    // FIXED: Save current position before switching (Issue #3)
    let currentPosition = pausedAtRef.current;
    if (wasPlaying && audioSourceRef.current && audioContextRef.current) {
      currentPosition =
        audioContextRef.current.currentTime - startTimeRef.current;
    } else if (!wasPlaying) {
      currentPosition = currentTime;
    }

    // Stop current playback if playing
    if (wasPlaying) {
      stopCurrentAudio();
    }

    // Switch to the other signal
    setIsPlayingOriginal(newIsPlayingOriginal);
    pausedAtRef.current = currentPosition;
    accumulatedTimeRef.current = currentPosition;
    setCurrentTime(currentPosition);

    // Resume playback if it was playing
    if (wasPlaying) {
      setIsPaused(true); // Mark as paused before resuming
      setTimeout(() => {
        const signalToPlay = newIsPlayingOriginal ? inputSignal : outputSignal;
        const startOffset = currentPosition;

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            window.webkitAudioContext)();
        }

        const audioContext = audioContextRef.current;

        const audioBuffer = audioContext.createBuffer(
          1,
          signalToPlay.data.length,
          signalToPlay.sampleRate
        );
        const channelData = audioBuffer.getChannelData(0);

        for (let i = 0; i < signalToPlay.data.length; i++) {
          channelData[i] = signalToPlay.data[i];
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackSpeed;
        source.connect(audioContext.destination);

        source.start(0, startOffset);

        source.onended = () => {
          stopCurrentAudio();
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTime(inputSignal.duration);
          pausedAtRef.current = 0;
        };

        audioSourceRef.current = source;
        startTimeRef.current = audioContext.currentTime - startOffset;
        accumulatedTimeRef.current = startOffset;

        setIsPlaying(true);
        setIsPaused(false);
        lastFrameTimeRef.current = null;
      }, 50);
    }
  }, [
    inputSignal,
    outputSignal,
    isPlaying,
    isPlayingOriginal,
    currentTime,
    playbackSpeed,
    stopCurrentAudio,
  ]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.2, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.2, 1));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan(0);
    setCurrentTime(0);
    accumulatedTimeRef.current = 0;
    pausedAtRef.current = 0; // FIXED: Reset pause position
  }, []);

  const handlePanChange = useCallback(
    (newPan) => {
      if (!isPlaying) {
        setPan(newPan);
      }
    },
    [isPlaying]
  );

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
        onToggleAudio={handleToggleAudioSource}
        isPlayingOriginal={isPlayingOriginal}
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
          onZoomChange={handleZoomChange}
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
