// components/FourierGraph.jsx
import React, { useEffect, useRef } from 'react';
import './FourierGraph.css';

function FourierGraph({ fourierData, scale = 'linear', title = 'Fourier Transform', isLoading, error }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!fourierData || !canvasRef.current) {
      console.log('FourierGraph: Missing data or canvas ref');
      return;
    }

    // Validate data structure
    if (!fourierData.frequencies || !fourierData.magnitudes) {
      console.warn('FourierGraph: Invalid data structure', fourierData);
      return;
    }

    if (fourierData.frequencies.length === 0 || fourierData.magnitudes.length === 0) {
      console.warn('FourierGraph: Empty data arrays');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, width, height);

    drawFFTGraph(ctx, fourierData, width, height, scale);

  }, [fourierData, scale]);

  const drawFFTGraph = (ctx, fourierData, width, height, scale) => {
    const frequencies = fourierData.frequencies || [];
    const magnitudes = fourierData.magnitudes || [];

    if (frequencies.length === 0 || magnitudes.length === 0) {
      console.warn('FourierGraph: Cannot draw - empty arrays');
      return;
    }

    // Ensure arrays have the same length
    const minLength = Math.min(frequencies.length, magnitudes.length);
    const frequencies_trimmed = frequencies.slice(0, minLength);
    const magnitudes_trimmed = magnitudes.slice(0, minLength);

    // ... rest of your existing drawFFTGraph code ...
    // (keep all the existing drawing code, but use frequencies_trimmed and magnitudes_trimmed)

    // Drawing parameters
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Draw grid
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = padding + (graphWidth / 10) * i;
      const y = padding + (graphHeight / 10) * i;

      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Calculate max magnitude
    let maxMagnitude = Math.max(...magnitudes_trimmed);
    if (maxMagnitude === 0) maxMagnitude = 1; // Prevent division by zero
    if (scale === 'audiogram') {
      maxMagnitude = Math.log10(maxMagnitude + 1) * 20;
    }

    // Draw FFT line
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let i = 0; i < frequencies_trimmed.length; i++) {
      const x = padding + (i / frequencies_trimmed.length) * graphWidth;
      let magnitude = magnitudes_trimmed[i];

      if (scale === 'audiogram') {
        magnitude = Math.log10(magnitude + 1) * 20;
      }

      const y = height - padding - (magnitude / maxMagnitude) * graphHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = 'rgba(125, 211, 252, 0.1)';
    ctx.fill();

    // Draw axes
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';

    // X-axis labels
    for (let i = 0; i <= 5; i++) {
      const x = padding + (graphWidth / 5) * i;
      const freqIdx = Math.floor((i / 5) * (frequencies_trimmed.length - 1));
      const freq = (frequencies_trimmed[freqIdx] || 0).toFixed(0);
      ctx.fillText(freq + ' Hz', x, height - padding + 20);
    }

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      const mag = (maxMagnitude - (maxMagnitude / 5) * i).toFixed(1);
      ctx.fillText(mag, padding - 10, y + 4);
    }
  };

  return (
    <div className="fourier-graph" style={{ position: 'relative' }}>
      <h3 className="fourier-graph-title">{title}</h3>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={900}
          height={350}
          className="fourier-graph-canvas"
        />
        {isLoading && (
          <div style={{ 
            color: '#94a3b8', 
            padding: '20px', 
            textAlign: 'center',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}>
            Loading...
          </div>
        )}
        {error && (
          <div style={{ 
            color: '#ef4444', 
            padding: '20px', 
            textAlign: 'center',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            fontSize: '14px',
            maxWidth: '800px'
          }}>
            Error: {error}
          </div>
        )}
        {!fourierData && !isLoading && !error && (
          <div style={{ 
            color: '#94a3b8', 
            padding: '20px', 
            textAlign: 'center',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}>
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

export default FourierGraph;