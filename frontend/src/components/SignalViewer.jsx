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
  isCineMode = true,
}) {
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastMouseXRef = useRef(0);

  useEffect(() => {
    if (!signal || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas with solid background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(15, 23, 42, 1)";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "rgba(125, 211, 252, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const totalDuration = signal.duration;
    const totalSamples = signal.data.length;

    const windowDuration = totalDuration / zoom;
    let windowStartTime;
    const maxPanTime = Math.max(0, totalDuration - windowDuration);

    if (isPlaying && isCineMode) {
      // During playback, center the window on current time
      // Keep playhead in center and scroll waveform
      windowStartTime = currentTime - windowDuration / 2;
      if (windowStartTime + windowDuration > totalDuration) {
        windowStartTime = totalDuration - windowDuration;
      }
      if (windowStartTime < 0) {
        windowStartTime = 0;
      }
    } else {
      // Manual pan mode
      windowStartTime = pan * maxPanTime;
    }

    const windowEndTime = windowStartTime + windowDuration;
    const startSample = Math.floor(
      (windowStartTime / totalDuration) * totalSamples
    );
    const endSample = Math.ceil((windowEndTime / totalDuration) * totalSamples);

    // Draw zero line first
    ctx.strokeStyle = "rgba(125, 211, 252, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Draw signal with anti-aliasing
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    let firstPoint = true;
    const samplesPerPixel = (endSample - startSample) / width;

    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(startSample + x * samplesPerPixel);

      if (sampleIndex >= 0 && sampleIndex < totalSamples) {
        const amplitude = signal.data[sampleIndex];
        const y = height / 2 - ((amplitude * height) / 2) * 0.9;

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    // Draw moving playhead during playback
    if (isPlaying && isCineMode) {
      // Calculate playhead position based on current time within the visible window
      const timeInWindow = currentTime - windowStartTime;
      const playheadX = (timeInWindow / windowDuration) * width;

      // Only draw if playhead is within visible window
      if (playheadX >= 0 && playheadX <= width) {
        // Draw playhead line
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw labels above playhead
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "left";
        const labelX = playheadX + 5;
        if (labelX + 60 < width) {
          ctx.fillText("▶ NOW", labelX, 25);
        } else {
          // Draw on left side if too close to right edge
          ctx.textAlign = "right";
          ctx.fillText("▶ NOW", playheadX - 5, 25);
        }

        ctx.fillStyle = "#00d4ff";
        ctx.font = "12px monospace";
        ctx.textAlign = "left";
        if (labelX + 60 < width) {
          ctx.fillText(`${currentTime.toFixed(2)}s`, labelX, 45);
        } else {
          ctx.textAlign = "right";
          ctx.fillText(`${currentTime.toFixed(2)}s`, playheadX - 5, 45);
        }
        ctx.textAlign = "left"; // Reset alignment
      }
    }

    // Draw time scale at bottom
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
      const x = (i / numTicks) * width;
      const time = windowStartTime + (i / numTicks) * windowDuration;
      ctx.fillText(`${time.toFixed(1)}s`, x + 2, height - 5);

      ctx.strokeStyle = "rgba(125, 211, 252, 0.2)";
      ctx.beginPath();
      ctx.moveTo(x, height - 20);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [signal, isPlaying, currentTime, zoom, pan, isCineMode]);

  const handleMouseDown = (e) => {
    if (isPlaying) return;
    isDraggingRef.current = true;
    lastMouseXRef.current = e.clientX;
  };

  const handleMouseMove = (e) => {
    if (
      !isDraggingRef.current ||
      !onPanChange ||
      isPlaying ||
      zoom <= 1 ||
      !signal
    )
      return;

    const deltaX = e.clientX - lastMouseXRef.current;
    const canvas = canvasRef.current;

    const totalDuration = signal.duration;
    const windowDuration = totalDuration / zoom;
    const maxPanTime = totalDuration - windowDuration;

    if (maxPanTime <= 0) return;

    const timeDelta = (deltaX / canvas.width) * windowDuration;
    const currentWindowStartTime = pan * maxPanTime;
    const newWindowStartTime = currentWindowStartTime - timeDelta;
    const newPan = newWindowStartTime / maxPanTime;

    onPanChange(Math.max(0, Math.min(1, newPan)));
    lastMouseXRef.current = e.clientX;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e) => {
    if (!onZoomChange || !onPanChange || !signal || !canvasRef.current) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    const totalDuration = signal.duration;

    const zoomFactor = 1.1;
    const zoomDelta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newZoom = Math.max(1, zoom * zoomDelta);

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseXFraction = mouseX / canvas.width;

    const oldWindowDuration = totalDuration / zoom;
    const oldMaxPanTime = Math.max(0, totalDuration - oldWindowDuration);
    const oldWindowStartTime = pan * oldMaxPanTime;
    const timeAtMouse = oldWindowStartTime + mouseXFraction * oldWindowDuration;

    const newWindowDuration = totalDuration / newZoom;
    const newMaxPanTime = Math.max(0, totalDuration - newWindowDuration);

    if (newMaxPanTime <= 0) {
      onZoomChange(1);
      onPanChange(0);
      return;
    }

    const newWindowStartTime = timeAtMouse - mouseXFraction * newWindowDuration;
    const newPan = newWindowStartTime / newMaxPanTime;
    const clampedPan = Math.max(0, Math.min(1, newPan));

    onZoomChange(newZoom);
    onPanChange(clampedPan);
  };

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

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
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        className="signal-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        style={{
          cursor: isDraggingRef.current
            ? "grabbing"
            : isPlaying
            ? "default"
            : "grab",
          imageRendering: "auto",
        }}
      />
      {signal && (
        <div className="signal-info">
          <span>📊 Duration: {signal.duration?.toFixed(2)}s</span>
          <span>📡 Sample Rate: {signal.sampleRate} Hz</span>
          <span>🔍 Zoom: {zoom.toFixed(1)}x</span>
          <span>👁️ Window: {(signal.duration / zoom).toFixed(2)}s</span>
        </div>
      )}
    </div>
  );
}

export default SignalViewer;
