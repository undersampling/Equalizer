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
  
  // === Interaction Refs ===
  const isMousePressedRef = useRef(false); // Tracks if button is held down
  const isDraggingRef = useRef(false);     // Tracks if we are actively panning
  const isSeekingRef = useRef(false);      // Tracks if we are seeking (scrubbing)
  const dragStartXRef = useRef(0);         // Where the click started
  const lastMouseXRef = useRef(0);         // Last X position for delta calc

  useEffect(() => {
    if (!signal || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear and Background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(15, 23, 42, 1)";
    ctx.fillRect(0, 0, width, height);

    const totalDuration = signal.duration;
    const totalSamples = signal.data.length;

    // Calculate Window
    const windowDuration = totalDuration / zoom;
    let windowStartTime;
    const maxPanTime = Math.max(0, totalDuration - windowDuration);

    if (isPlaying && isCineMode) {
      // Follow Playhead
      windowStartTime = currentTime - windowDuration / 2;
      if (windowStartTime + windowDuration > totalDuration) {
        windowStartTime = totalDuration - windowDuration;
      }
      if (windowStartTime < 0) {
        windowStartTime = 0;
      }
    } else {
      // Manual Pan
      windowStartTime = pan * maxPanTime;
    }

    canvas.dataset.windowStartTime = windowStartTime;
    canvas.dataset.windowDuration = windowDuration;

    // Calculate Samples
    const windowEndTime = windowStartTime + windowDuration;
    const startSample = Math.floor(
      (windowStartTime / totalDuration) * totalSamples
    );
    const endSample = Math.ceil((windowEndTime / totalDuration) * totalSamples);

    // Draw Grid Lines
    const leftMargin = 60;
    const plotWidth = width - leftMargin;

    ctx.strokeStyle = "rgba(125, 211, 252, 0.08)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";

    const numYTicks = 5;
    // Determine Min/Max Amp for scaling
    let minAmp = Infinity;
    let maxAmp = -Infinity;
    // Optimization: Scan only visible samples
    const scanStart = Math.max(0, startSample);
    const scanEnd = Math.min(totalSamples, endSample);
    
    // If zoomed out far, don't scan everything to keep UI responsive
    const step = Math.ceil((scanEnd - scanStart) / 2000) || 1; 

    for (let i = scanStart; i < scanEnd; i += step) {
      const amp = signal.data[i];
      if (amp < minAmp) minAmp = amp;
      if (amp > maxAmp) maxAmp = amp;
    }
    if (minAmp === Infinity) { minAmp = -1; maxAmp = 1; }

    const ampRange = maxAmp - minAmp;
    const padding = ampRange * 0.1 || 0.1;
    minAmp -= padding;
    maxAmp += padding;
    const totalAmpRange = maxAmp - minAmp;

    for (let i = 0; i <= numYTicks; i++) {
      const y = (height / numYTicks) * i;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      const ampValue = maxAmp - (i / numYTicks) * totalAmpRange;
      ctx.fillText(ampValue.toFixed(3), leftMargin - 5, y + 4);
    }

    // Zero Line
    if (minAmp <= 0 && maxAmp >= 0) {
      const zeroY = height - ((0 - minAmp) / totalAmpRange) * height;
      ctx.strokeStyle = "rgba(125, 211, 252, 0.3)";
      ctx.beginPath();
      ctx.moveTo(leftMargin, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();
    }

    // Helper: Amp to Y
    const ampToY = (amp) => height - ((amp - minAmp) / totalAmpRange) * height;

    // Draw Waveform
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const samplesPerPixel = (endSample - startSample) / plotWidth;

    if (samplesPerPixel <= 1) {
      // Low Zoom: Line Plot
      ctx.beginPath();
      let firstPoint = true;
      for (let i = scanStart; i < scanEnd; i++) {
        const x = leftMargin + ((i - startSample) / (endSample - startSample)) * plotWidth;
        const y = ampToY(signal.data[i]);
        if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
        else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
    } else {
      // High Zoom: Min/Max Envelope
      ctx.beginPath();
      for (let x = 0; x < plotWidth; x++) {
        const startIdx = Math.floor(startSample + x * samplesPerPixel);
        const endIdx = Math.floor(startSample + (x + 1) * samplesPerPixel);
        if (startIdx >= totalSamples) break;

        let localMin = Infinity;
        let localMax = -Infinity;
        // Inner loop optimization
        const innerStep = Math.ceil((endIdx - startIdx) / 10) || 1; 
        for (let i = startIdx; i < Math.min(endIdx, totalSamples); i += innerStep) {
          const val = signal.data[i];
          if (val < localMin) localMin = val;
          if (val > localMax) localMax = val;
        }
        
        if (localMin !== Infinity) {
            const screenX = leftMargin + x;
            ctx.moveTo(screenX, ampToY(localMin));
            ctx.lineTo(screenX, ampToY(localMax));
        }
      }
      ctx.stroke();
    }

    // Draw Playhead
    const timeInWindow = currentTime - windowStartTime;
    const playheadX = leftMargin + (timeInWindow / windowDuration) * plotWidth;

    if (playheadX >= leftMargin && playheadX <= width) {
      let playheadColor = "#00ff88"; 
      let playheadLabel = "▶";

      if (isDraggingRef.current) {
        playheadColor = "#fbbf24"; // Orange when panning
        playheadLabel = "✋";
      } else if (isPlaying) {
        playheadColor = "#00ff88";
        playheadLabel = "▶";
      } else {
        playheadColor = "#ff6b6b";
        playheadLabel = "⏸";
      }

      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Label
      ctx.fillStyle = playheadColor;
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      if (playheadX + 60 < width) {
        ctx.fillText(`${playheadLabel} ${currentTime.toFixed(2)}s`, playheadX + 5, 20);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(`${playheadLabel} ${currentTime.toFixed(2)}s`, playheadX - 5, 20);
      }
    }

    // Time Axis
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

  }, [signal, isPlaying, currentTime, zoom, pan, isCineMode]);

  const handleWheelRef = useRef(null);

  const getTimeFromMouseX = (mouseX) => {
    if (!signal || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const leftMargin = 60;
    const plotWidth = canvas.width - leftMargin;
    const clickX = mouseX - rect.left - leftMargin;

    if (clickX < 0) return null;

    const windowStartTime = parseFloat(canvas.dataset.windowStartTime) || 0;
    const windowDuration = parseFloat(canvas.dataset.windowDuration) || signal.duration;
    
    const clickFraction = Math.max(0, Math.min(1, clickX / plotWidth));
    return Math.max(0, Math.min(signal.duration, windowStartTime + clickFraction * windowDuration));
  };

  // === UPDATED INTERACTION LOGIC ===

  const handleMouseDown = (e) => {
    if (!signal) return;
    
    // 1. Register Mouse Down
    isMousePressedRef.current = true;
    isDraggingRef.current = false; // Reset drag state
    dragStartXRef.current = e.clientX;
    lastMouseXRef.current = e.clientX;

    // If we are NOT zoomed in, standard behavior is clicking (seeking)
    // If we ARE zoomed in, we wait to see if user drags (Pan) or releases (Click/Seek)
    if (zoom <= 1 && onSeek) {
        const seekTime = getTimeFromMouseX(e.clientX);
        if (seekTime !== null) onSeek(seekTime);
    }
  };

  const handleMouseMove = (e) => {
    // CRITICAL FIX: Only do anything if mouse is actually pressed
    if (!isMousePressedRef.current) return;

    const deltaX = e.clientX - lastMouseXRef.current;
    lastMouseXRef.current = e.clientX;

    // Calculate total movement since click started
    const totalMove = Math.abs(e.clientX - dragStartXRef.current);

    // If zoomed in, treat movement as PANNING
    if (zoom > 1 && !isPlaying) {
       // Only count as a "drag" if moved more than 5 pixels
       if (totalMove > 5) {
           isDraggingRef.current = true;
           
           const canvas = canvasRef.current;
           const leftMargin = 60;
           const plotWidth = canvas.width - leftMargin;
           const totalDuration = signal.duration;
           const windowDuration = totalDuration / zoom;
           const maxPanTime = totalDuration - windowDuration;

           if (maxPanTime > 0 && plotWidth > 0) {
               // Move Pan
               const timeDelta = (deltaX / plotWidth) * windowDuration;
               const currentWindowStartTime = pan * maxPanTime;
               // Drag Left (negative delta) -> View moves Right (time increases)
               // Drag Right (positive delta) -> View moves Left (time decreases)
               const newWindowStartTime = currentWindowStartTime - timeDelta;
               const newPan = newWindowStartTime / maxPanTime;
               
               if (onPanChange) onPanChange(Math.max(0, Math.min(1, newPan)));
           }
       }
    } 
    // If NOT zoomed in (or playing), drag acts as SCRUBBING (Seeking)
    else if (onSeek) {
        const seekTime = getTimeFromMouseX(e.clientX);
        if (seekTime !== null) onSeek(seekTime);
    }
  };

  const handleMouseUp = (e) => {
    // Reset Mouse State
    isMousePressedRef.current = false;
    
    // If we were NOT dragging (just a click) and NOT playing, perform a SEEK now
    if (!isDraggingRef.current && !isPlaying && onSeek && zoom > 1) {
        const seekTime = getTimeFromMouseX(e.clientX);
        if (seekTime !== null) onSeek(seekTime);
    }

    // Reset Drag State
    isDraggingRef.current = false;
  };

  // Standard Wheel Zoom Logic
  const handleWheel = (e) => {
    if (!onZoomChange || !onPanChange || !signal || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    e.preventDefault();
    const leftMargin = 60;
    const plotWidth = canvas.width - leftMargin;
    
    const zoomFactor = 1.2;
    const zoomDelta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newZoom = Math.max(1, Math.min(100, zoom * zoomDelta));

    const mouseXRelative = e.clientX - rect.left - leftMargin;
    const mouseXFraction = Math.max(0, Math.min(1, mouseXRelative / plotWidth));

    const totalDuration = signal.duration;
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

  useEffect(() => {
    handleWheelRef.current = handleWheel;
  }, [handleWheel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => handleWheelRef.current && handleWheelRef.current(e);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Global Mouse Up listener to catch releases outside canvas
  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [signal, zoom, pan, isPlaying]);

  return (
    <div className="signal-viewer">
      <div className="viewer-header">
        <h3 className="viewer-title">{title}</h3>
        {isPlaying && <span className="live-indicator"><span className="pulse-dot"></span> LIVE</span>}
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        className="signal-canvas"
        onMouseDown={handleMouseDown}
        style={{
          cursor: isDraggingRef.current ? "grabbing" : (zoom > 1 ? "grab" : "crosshair"),
          imageRendering: "pixelated", // Better performance for lines
        }}
      />
      {signal && (
        <div className="signal-info">
          <span>⏱️ {currentTime.toFixed(2)}s</span>
          <span>🔍 {zoom.toFixed(1)}x</span>
        </div>
      )}
    </div>
  );
}

export default SignalViewer;