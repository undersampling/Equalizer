// components/FourierGraph.jsx
import React, { useEffect, useRef } from 'react';
import '../styles/FourierGraph.css';

function FourierGraph({ fourierData, scale = 'linear', title = 'Fourier Transform', isLoading, error }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!fourierData || !canvasRef.current) {
      return;
    }

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
      return;
    }

    // Ensure arrays have the same length
    const minLength = Math.min(frequencies.length, magnitudes.length);
    const frequencies_trimmed = frequencies.slice(0, minLength);
    const magnitudes_trimmed = magnitudes.slice(0, minLength);

    // Drawing parameters
    const padding = 50;
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

    // Process data based on scale
    let processedData = [];
    
    if (scale === 'audiogram') {
      // Audiogram scale: logarithmic frequency axis
      // Filter frequencies to typical audiogram range (125 Hz to 8000 Hz)
      const minFreq = 125;
      const maxFreq = 8000;
      
      for (let i = 0; i < frequencies_trimmed.length; i++) {
        const freq = frequencies_trimmed[i];
        if (freq >= minFreq && freq <= maxFreq) {
          // Convert frequency to logarithmic position
          const logPos = Math.log2(freq / minFreq) / Math.log2(maxFreq / minFreq);
          processedData.push({
            x: logPos,
            y: magnitudes_trimmed[i],
            freq: freq
          });
        }
      }
      
      // If no data in audiogram range, use all data
      if (processedData.length === 0) {
        for (let i = 0; i < frequencies_trimmed.length; i++) {
          const freq = frequencies_trimmed[i];
          if (freq > 0) {
            const logPos = Math.log2(freq / (frequencies_trimmed[0] || 1));
            const maxLog = Math.log2((frequencies_trimmed[frequencies_trimmed.length - 1] || 1) / (frequencies_trimmed[0] || 1));
            processedData.push({
              x: maxLog > 0 ? logPos / maxLog : 0,
              y: magnitudes_trimmed[i],
              freq: freq
            });
          }
        }
      }
    } else {
      // Linear scale
      for (let i = 0; i < frequencies_trimmed.length; i++) {
        processedData.push({
          x: i / (frequencies_trimmed.length - 1),
          y: magnitudes_trimmed[i],
          freq: frequencies_trimmed[i]
        });
      }
    }

    if (processedData.length === 0) {
      return;
    }

    // Calculate max magnitude for scaling
    let maxMagnitude = Math.max(...processedData.map(d => d.y));
    if (maxMagnitude === 0) maxMagnitude = 1;

    // Draw FFT line
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let i = 0; i < processedData.length; i++) {
      const point = processedData[i];
      const x = padding + point.x * graphWidth;
      const y = height - padding - (point.y / maxMagnitude) * graphHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Fill under curve
    if (processedData.length > 0) {
      const lastPoint = processedData[processedData.length - 1];
      const lastX = padding + lastPoint.x * graphWidth;
      ctx.lineTo(lastX, height - padding);
      ctx.lineTo(padding, height - padding);
      ctx.closePath();
      ctx.fillStyle = 'rgba(125, 211, 252, 0.1)';
      ctx.fill();
    }

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

    // X-axis labels (frequency)
    if (scale === 'audiogram') {
      // Audiogram scale: show octave frequencies
      const audiogramFreqs = [125, 250, 500, 1000, 2000, 4000, 8000,16000];
      const minFreq = 125;
      const maxFreq = 8000;
      
      audiogramFreqs.forEach(freq => {
        const logPos = Math.log2(freq / minFreq) / Math.log2(maxFreq / minFreq);
        const x = padding + logPos * graphWidth;
        const label = freq >= 1000 ? (freq / 1000) + 'k' : freq.toString();
        ctx.fillText(label + ' Hz', x, height - padding + 20);
      });
    } else {
      // Linear scale
      for (let i = 0; i <= 5; i++) {
        const x = padding + (graphWidth / 5) * i;
        const freqIdx = Math.floor((i / 5) * (frequencies_trimmed.length - 1));
        const freq = frequencies_trimmed[freqIdx] || 0;
        const label = freq >= 1000 ? (freq / 1000).toFixed(1) + 'k' : freq.toFixed(0);
        ctx.fillText(label + ' Hz', x, height - padding + 20);
      }
    }

    // Y-axis labels (magnitude)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      const mag = (maxMagnitude - (maxMagnitude / 5) * i).toFixed(1);
      ctx.fillText(mag, padding - 10, y + 4);
    }

    // Scale indicator
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`Scale: ${scale === 'audiogram' ? 'Audiogram (Log)' : 'Linear'}`, padding, padding - 10);
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