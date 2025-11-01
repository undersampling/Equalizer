import React, { useEffect, useRef } from 'react';
import './SignalViewer.css';

function SignalViewer({ signal, title, isPlaying, currentTime, zoom, pan }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!signal || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw signal
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const data = signal.data;
    const step = Math.max(1, Math.floor(data.length / width / zoom));
    const startIndex = Math.floor(pan * data.length);

    for (let i = 0; i < width; i++) {
      const index = Math.min(startIndex + i * step, data.length - 1);
      const value = data[index];
      const x = i;
      const y = height / 2 - (value * height / 2);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw current time indicator
    if (isPlaying && signal.duration) {
      const timePos = (currentTime / signal.duration) * width;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(timePos, 0);
      ctx.lineTo(timePos, height);
      ctx.stroke();
    }

  }, [signal, isPlaying, currentTime, zoom, pan]);

  return (
    <div className="signal-viewer">
      <h3 className="viewer-title">{title}</h3>
      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        className="signal-canvas"
      />
      {signal && (
        <div className="signal-info">
          <span>Duration: {signal.duration?.toFixed(2)}s</span>
          <span>Sample Rate: {signal.sampleRate} Hz</span>
          <span>Samples: {signal.data?.length}</span>
        </div>
      )}
    </div>
  );
}

export default SignalViewer;