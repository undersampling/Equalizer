// components/FourierGraph.jsx
import React, { useEffect, useRef } from 'react';
import './FourierGraph.css';

function FourierGraph({ fourierData, scale = 'linear', title = 'Fourier Transform' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!fourierData || !canvasRef.current) return;

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
      return;
    }

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
    let maxMagnitude = Math.max(...magnitudes);
    if (scale === 'audiogram') {
      maxMagnitude = Math.log10(maxMagnitude + 1) * 20;
    }

    // Draw FFT line
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let i = 0; i < frequencies.length; i++) {
      const x = padding + (i / frequencies.length) * graphWidth;
      let magnitude = magnitudes[i];
      
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
      const freq = (frequencies[Math.floor((i / 5) * frequencies.length)] || 0).toFixed(0);
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
    <div className="fourier-graph">
      <h3 className="fourier-graph-title">{title}</h3>
      <canvas
        ref={canvasRef}
        width={900}
        height={350}
        className="fourier-graph-canvas"
      />
    </div>
  );
}

export default FourierGraph;