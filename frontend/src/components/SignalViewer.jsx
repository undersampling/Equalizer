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

    const totalDuration = signal.duration;
    const totalSamples = signal.data.length;

    const windowDuration = totalDuration / zoom;
    let windowStartTime;
    const maxPanTime = Math.max(0, totalDuration - windowDuration);

    if (isPlaying && isCineMode) {
      // During playback, center the window on current time
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

    // Calculate adaptive amplitude range from visible signal
    let minAmp = Infinity;
    let maxAmp = -Infinity;
    for (let i = Math.max(0, startSample); i < Math.min(totalSamples, endSample); i++) {
      const amp = signal.data[i];
      if (amp < minAmp) minAmp = amp;
      if (amp > maxAmp) maxAmp = amp;
    }
    
    // Add padding to amplitude range
    const ampRange = maxAmp - minAmp;
    const padding = ampRange * 0.1 || 0.1; // 10% padding or default
    minAmp -= padding;
    maxAmp += padding;
    const totalAmpRange = maxAmp - minAmp;

    // Reserve space for Y-axis labels
    const leftMargin = 60;
    const plotWidth = width - leftMargin;

    // Draw grid lines and Y-axis labels
    ctx.strokeStyle = "rgba(125, 211, 252, 0.08)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    
    const numYTicks = 5;
    for (let i = 0; i <= numYTicks; i++) {
      const y = (height / numYTicks) * i;
      // Draw grid line
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      // Draw Y-axis label (amplitude)
      const ampValue = maxAmp - (i / numYTicks) * totalAmpRange;
      ctx.fillText(ampValue.toFixed(3), leftMargin - 5, y + 4);
    }

    // Draw zero line if it's in visible range
    if (minAmp <= 0 && maxAmp >= 0) {
      const zeroY = height - ((0 - minAmp) / totalAmpRange) * height;
      ctx.strokeStyle = "rgba(125, 211, 252, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftMargin, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();
    }

    // Function to convert amplitude to Y coordinate
    const ampToY = (amp) => {
      return height - ((amp - minAmp) / totalAmpRange) * height;
    };

    // Draw signal with min/max envelope (NO DOWNSAMPLING)
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const samplesPerPixel = (endSample - startSample) / plotWidth;

    if (samplesPerPixel <= 1) {
      // ZOOMED IN: Draw every sample point
      ctx.beginPath();
      let firstPoint = true;
      
      for (let i = Math.max(0, startSample); i < Math.min(totalSamples, endSample); i++) {
        const x = leftMargin + ((i - startSample) / (endSample - startSample)) * plotWidth;
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
      // ZOOMED OUT: Draw min/max envelope to preserve ALL signal detail
      for (let x = 0; x < plotWidth; x++) {
        const startIdx = Math.floor(startSample + x * samplesPerPixel);
        const endIdx = Math.floor(startSample + (x + 1) * samplesPerPixel);
        
        if (startIdx >= totalSamples) break;
        
        let minVal = Infinity;
        let maxVal = -Infinity;
        
        // Find min/max in this pixel's sample range
        for (let i = startIdx; i < Math.min(endIdx, totalSamples); i++) {
          const val = signal.data[i];
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
        
        // Draw vertical line from min to max
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

    // Draw moving playhead during playback
    if (isPlaying && isCineMode) {
      // Calculate playhead position based on current time within the visible window
      const timeInWindow = currentTime - windowStartTime;
      const playheadX = leftMargin + (timeInWindow / windowDuration) * plotWidth;

      // Only draw if playhead is within visible window
      if (playheadX >= leftMargin && playheadX <= width) {
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
    
    // Store amplitude range for info display
    canvas.dataset.minAmp = minAmp.toFixed(3);
    canvas.dataset.maxAmp = maxAmp.toFixed(3);

  }, [signal, isPlaying, currentTime, zoom, pan, isCineMode]);

  // Keep reference to latest handleWheel for the event listener
  const handleWheelRef = useRef(null);

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
    const leftMargin = 60;
    const plotWidth = canvas.width - leftMargin;

    const totalDuration = signal.duration;
    const windowDuration = totalDuration / zoom;
    const maxPanTime = totalDuration - windowDuration;

    if (maxPanTime <= 0) return;

    const timeDelta = (deltaX / plotWidth) * windowDuration;
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
    const leftMargin = 60;
    const plotWidth = canvas.width - leftMargin;

    const zoomFactor = 1.2;
    const zoomDelta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newZoom = Math.max(1, Math.min(100, zoom * zoomDelta));

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - leftMargin;
    const mouseXFraction = Math.max(0, Math.min(1, mouseX / plotWidth));

    const oldWindowDuration = totalDuration / zoom;
    const oldMaxPanTime = Math.max(0, totalDuration - oldWindowDuration);
    const oldWindowStartTime = pan * oldMaxPanTime;
    const mouseTime = oldWindowStartTime + mouseXFraction * oldWindowDuration;

    const newWindowDuration = totalDuration / newZoom;
    const newWindowStartTime = mouseTime - mouseXFraction * newWindowDuration;
    const newMaxPanTime = Math.max(0, totalDuration - newWindowDuration);
    
    const newPan = newMaxPanTime === 0 ? 0 : Math.max(0, Math.min(1, newWindowStartTime / newMaxPanTime));

    onZoomChange(newZoom);
    onPanChange(newPan);
  };

  // Update ref whenever handleWheel changes (which depends on state)
  useEffect(() => {
    handleWheelRef.current = handleWheel;
  }, [handleWheel]);

  // Attach non-passive wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      if (handleWheelRef.current) {
        handleWheelRef.current(e);
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);


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
