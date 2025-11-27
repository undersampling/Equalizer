import React, { useRef, useEffect } from "react";
import "../styles/SignalViewer.css";

function SignalViewer({
  signal,
  title,
  isPlaying,
  currentTime,
  zoom,
  pan,
  onPanChange,
  onZoomChange,
  onSeek,
  isCineMode = true,
}) {
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isSeekingRef = useRef(false); // NEW: Track if we're seeking
  const lastMouseXRef = useRef(0);

  useEffect(() => {
    if (!signal || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(15, 23, 42, 1)";
    ctx.fillRect(0, 0, width, height);

    const totalDuration = signal.duration;
    const totalSamples = signal.data.length;

    const windowDuration = totalDuration / zoom;
    let windowStartTime;
    const maxPanTime = Math.max(0, totalDuration - windowDuration);

    if (isPlaying && isCineMode) {
      windowStartTime = currentTime - windowDuration / 2;
      if (windowStartTime + windowDuration > totalDuration) {
        windowStartTime = totalDuration - windowDuration;
      }
      if (windowStartTime < 0) {
        windowStartTime = 0;
      }
    } else {
      windowStartTime = pan * maxPanTime;
    }

    canvas.dataset.windowStartTime = windowStartTime;
    canvas.dataset.windowDuration = windowDuration;

    const windowEndTime = windowStartTime + windowDuration;
    const startSample = Math.floor(
      (windowStartTime / totalDuration) * totalSamples
    );
    const endSample = Math.ceil((windowEndTime / totalDuration) * totalSamples);

    let minAmp = Infinity;
    let maxAmp = -Infinity;
    for (
      let i = Math.max(0, startSample);
      i < Math.min(totalSamples, endSample);
      i++
    ) {
      const amp = signal.data[i];
      if (amp < minAmp) minAmp = amp;
      if (amp > maxAmp) maxAmp = amp;
    }

    const ampRange = maxAmp - minAmp;
    const padding = ampRange * 0.1 || 0.1;
    minAmp -= padding;
    maxAmp += padding;
    const totalAmpRange = maxAmp - minAmp;

    const leftMargin = 60;
    const plotWidth = width - leftMargin;

    ctx.strokeStyle = "rgba(125, 211, 252, 0.08)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";

    const numYTicks = 5;
    for (let i = 0; i <= numYTicks; i++) {
      const y = (height / numYTicks) * i;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      const ampValue = maxAmp - (i / numYTicks) * totalAmpRange;
      ctx.fillText(ampValue.toFixed(3), leftMargin - 5, y + 4);
    }

    if (minAmp <= 0 && maxAmp >= 0) {
      const zeroY = height - ((0 - minAmp) / totalAmpRange) * height;
      ctx.strokeStyle = "rgba(125, 211, 252, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftMargin, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();
    }

    const ampToY = (amp) => {
      return height - ((amp - minAmp) / totalAmpRange) * height;
    };

    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const samplesPerPixel = (endSample - startSample) / plotWidth;

    if (samplesPerPixel <= 1) {
      ctx.beginPath();
      let firstPoint = true;

      for (
        let i = Math.max(0, startSample);
        i < Math.min(totalSamples, endSample);
        i++
      ) {
        const x =
          leftMargin +
          ((i - startSample) / (endSample - startSample)) * plotWidth;
        const y = ampToY(signal.data[i]);

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    } else {
      for (let x = 0; x < plotWidth; x++) {
        const startIdx = Math.floor(startSample + x * samplesPerPixel);
        const endIdx = Math.floor(startSample + (x + 1) * samplesPerPixel);

        if (startIdx >= totalSamples) break;

        let minVal = Infinity;
        let maxVal = -Infinity;

        for (let i = startIdx; i < Math.min(endIdx, totalSamples); i++) {
          const val = signal.data[i];
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }

        if (minVal !== Infinity && maxVal !== -Infinity) {
          const screenX = leftMargin + x;
          const minY = ampToY(minVal);
          const maxY = ampToY(maxVal);

          ctx.beginPath();
          ctx.moveTo(screenX, minY);
          ctx.lineTo(screenX, maxY);
          ctx.stroke();
        }
      }
    }

    // Draw playhead - ALWAYS visible
    const timeInWindow = currentTime - windowStartTime;
    const playheadX = leftMargin + (timeInWindow / windowDuration) * plotWidth;

    if (playheadX >= leftMargin && playheadX <= width) {
      // Playhead color: green when playing, red when paused, blue when seeking
      let playheadColor = "#00ff88"; // Playing
      let playheadLabel = "▶ NOW";

      if (isSeekingRef.current) {
        playheadColor = "#00d4ff"; // Seeking (bright blue)
        playheadLabel = "⏩ SEEK";
      } else if (!isPlaying) {
        playheadColor = "#ff6b6b"; // Paused
        playheadLabel = "⏸ PAUSED";
      }

      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = playheadColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = playheadColor;
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      const labelX = playheadX + 5;
      if (labelX + 80 < width) {
        ctx.fillText(playheadLabel, labelX, 20);
        ctx.font = "11px monospace";
        ctx.fillText(`${currentTime.toFixed(2)}s`, labelX, 38);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(playheadLabel, playheadX - 5, 20);
        ctx.font = "11px monospace";
        ctx.fillText(`${currentTime.toFixed(2)}s`, playheadX - 5, 38);
      }
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const numTimeTicks = 5;
    for (let i = 0; i <= numTimeTicks; i++) {
      const x = leftMargin + (i / numTimeTicks) * plotWidth;
      const time = windowStartTime + (i / numTimeTicks) * windowDuration;
      ctx.fillText(`${time.toFixed(2)}s`, x, height - 5);

      ctx.strokeStyle = "rgba(125, 211, 252, 0.2)";
      ctx.beginPath();
      ctx.moveTo(x, height - 20);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    canvas.dataset.minAmp = minAmp.toFixed(3);
    canvas.dataset.maxAmp = maxAmp.toFixed(3);
  }, [signal, isPlaying, currentTime, zoom, pan, isCineMode]);

  const handleWheelRef = useRef(null);

  // Calculate time from mouse X position
  const getTimeFromMouseX = (mouseX) => {
    if (!signal || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = mouseX - rect.left;

    const leftMargin = 60;
    const plotWidth = canvas.width - leftMargin;

    if (clickX < leftMargin) return null;

    const windowStartTime = parseFloat(canvas.dataset.windowStartTime) || 0;
    const windowDuration =
      parseFloat(canvas.dataset.windowDuration) || signal.duration;

    const clickXInPlot = clickX - leftMargin;
    const clickFraction = Math.max(0, Math.min(1, clickXInPlot / plotWidth));
    const clickedTime = windowStartTime + clickFraction * windowDuration;

    return Math.max(0, Math.min(signal.duration, clickedTime));
  };

  const handleMouseDown = (e) => {
    if (!onSeek || !signal) return;

    const seekTime = getTimeFromMouseX(e.clientX);
    if (seekTime !== null) {
      // Start seeking
      isSeekingRef.current = true;
      onSeek(seekTime);
      lastMouseXRef.current = e.clientX;
    }
  };

  const handleMouseMove = (e) => {
    // If we're seeking (dragging playhead)
    if (isSeekingRef.current && onSeek) {
      const seekTime = getTimeFromMouseX(e.clientX);
      if (seekTime !== null) {
        onSeek(seekTime);
      }
      return;
    }

    // Regular panning behavior (only when zoomed in and not playing)
    if (!onPanChange || zoom <= 1 || !signal || isPlaying) return;

    const deltaX = Math.abs(e.clientX - lastMouseXRef.current);
    if (deltaX < 5) return; // Ignore tiny movements

    isDraggingRef.current = true;

    const moveDeltaX = e.clientX - lastMouseXRef.current;
    const canvas = canvasRef.current;
    const leftMargin = 60;
    const plotWidth = canvas.width - leftMargin;

    const totalDuration = signal.duration;
    const windowDuration = totalDuration / zoom;
    const maxPanTime = totalDuration - windowDuration;

    if (maxPanTime <= 0) return;

    const timeDelta = (moveDeltaX / plotWidth) * windowDuration;
    const currentWindowStartTime = pan * maxPanTime;
    const newWindowStartTime = currentWindowStartTime - timeDelta;
    const newPan = newWindowStartTime / maxPanTime;

    onPanChange(Math.max(0, Math.min(1, newPan)));
    lastMouseXRef.current = e.clientX;
  };

  const handleMouseUp = () => {
    isSeekingRef.current = false;
    isDraggingRef.current = false;
  };

  const handleWheel = (e) => {
    if (!onZoomChange || !onPanChange || !signal || !canvasRef.current) return;

    // Only allow wheel zoom when mouse is over the canvas (signal viewer)
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Check if mouse is within canvas bounds
    if (mouseX < rect.left || mouseX > rect.right || 
        mouseY < rect.top || mouseY > rect.bottom) {
      return; // Mouse is not over the signal viewer
    }

    e.preventDefault();
    const totalDuration = signal.duration;
    const leftMargin = 60;
    const plotWidth = canvas.width - leftMargin;

    const zoomFactor = 1.2;
    const zoomDelta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newZoom = Math.max(1, Math.min(100, zoom * zoomDelta));

    // Calculate mouse position relative to canvas for zoom centering
    const mouseXRelative = e.clientX - rect.left - leftMargin;
    const mouseXFraction = Math.max(0, Math.min(1, mouseXRelative / plotWidth));

    const oldWindowDuration = totalDuration / zoom;
    const oldMaxPanTime = Math.max(0, totalDuration - oldWindowDuration);
    const oldWindowStartTime = pan * oldMaxPanTime;
    const mouseTime = oldWindowStartTime + mouseXFraction * oldWindowDuration;

    const newWindowDuration = totalDuration / newZoom;
    const newWindowStartTime = mouseTime - mouseXFraction * newWindowDuration;
    const newMaxPanTime = Math.max(0, totalDuration - newWindowDuration);

    const newPan =
      newMaxPanTime === 0
        ? 0
        : Math.max(0, Math.min(1, newWindowStartTime / newMaxPanTime));

    onZoomChange(newZoom);
    onPanChange(newPan);
  };

  useEffect(() => {
    handleWheelRef.current = handleWheel;
  }, [handleWheel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Attach wheel listener to canvas - it will only fire when mouse is over the canvas
    const onWheel = (e) => {
      if (handleWheelRef.current) {
        handleWheelRef.current(e);
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [signal, zoom, pan, isPlaying, onSeek, onPanChange]);

  return (
    <div className="signal-viewer">
      <div className="viewer-header">
        <h3 className="viewer-title">{title}</h3>
        {isPlaying && (
          <span className="live-indicator">
            <span className="pulse-dot"></span>
            LIVE
          </span>
        )}
        {!isPlaying && onSeek && <span className="seek-hint"></span>}
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        className="signal-canvas"
        onMouseDown={handleMouseDown}
        style={{
          cursor: isSeekingRef.current
            ? "grabbing"
            : onSeek
            ? "pointer"
            : isDraggingRef.current
            ? "grabbing"
            : "grab",
          imageRendering: "auto",
        }}
      />
      {signal && (
        <div className="signal-info">
          <span>📊 Duration: {signal.duration?.toFixed(2)}s</span>
          <span>📡 Sample Rate: {signal.sampleRate} Hz</span>
          <span>🔍 Zoom: {zoom.toFixed(1)}x</span>
          <span>⏱️ Position: {currentTime.toFixed(2)}s</span>
        </div>
      )}
    </div>
  );
}

export default SignalViewer;
