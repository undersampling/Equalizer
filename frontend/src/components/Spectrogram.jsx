import React, { useEffect, useRef, useState } from 'react';
import './Spectrogram.css';
import { limitSignalSize } from '../utils/audioUtils';

function Spectrogram({ signal, title, visible }) {
  const canvasRef = useRef(null);
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // API base URL - matches MainPage
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!signal || !canvasRef.current || !visible) {
      setSpectrogramData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Limit signal size before sending
      const limitedSignal = limitSignalSize(signal.data, 100000);

      if (limitedSignal.length === 0) {
        setError('Signal is too large or empty');
        setIsLoading(false);
        return;
      }

      const requestBody = {
        signal: limitedSignal,
        sampleRate: signal.sampleRate,
        use_mel: true,
        n_mels: 128,
        fmax: 8000,
      };

      // Check request size
      const requestSize = JSON.stringify(requestBody).length;
      if (requestSize > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('Signal is too large to process. Please use a shorter audio file.');
      }

      // Fetch spectrogram data from backend
      fetch(`${API_BASE_URL}/api/spectrogram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setSpectrogramData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Error computing spectrogram:', err);
        setError(err.message);
        setIsLoading(false);
      });
    } catch (err) {
      console.error('Error preparing spectrogram request:', err);
      setError(err.message || 'Failed to prepare request');
      setIsLoading(false);
    }
  }, [signal, visible]);

  useEffect(() => {
    if (!spectrogramData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, width, height);

    drawSpectrogram(ctx, spectrogramData, width, height);
  }, [spectrogramData]);

  const drawSpectrogram = (ctx, data, width, height) => {
    const { x: times, y: freqs, z: spectrogram } = data;

    if (!times || !freqs || !spectrogram) return;

    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const timeLen = times.length;
    const freqLen = freqs.length;

    // Draw spectrogram
    const maxDb = Math.max(...spectrogram.flat());
    const minDb = Math.min(...spectrogram.flat());

    for (let i = 0; i < freqLen; i++) {
      for (let j = 0; j < timeLen; j++) {
        const value = spectrogram[i][j];
        const normalized = (value - minDb) / (maxDb - minDb);

        const x = padding + (j / timeLen) * graphWidth;
        const y = padding + ((freqLen - i - 1) / freqLen) * graphHeight;
        const cellWidth = graphWidth / timeLen;
        const cellHeight = graphHeight / freqLen;

        // Color mapping: blue to cyan based on intensity
        const intensity = Math.max(0, Math.min(1, normalized));
        ctx.fillStyle = `rgba(125, 211, 252, ${intensity})`;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
    }

    // Draw axes
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';

    // X-axis (time)
    for (let i = 0; i <= 5; i++) {
      const x = padding + (graphWidth / 5) * i;
      const timeIdx = Math.floor((i / 5) * (timeLen - 1));
      const time = times[timeIdx]?.toFixed(2) || '0';
      ctx.fillText(time + 's', x, height - padding + 20);
    }

    // Y-axis (frequency)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      const freqIdx = Math.floor((1 - i / 5) * (freqLen - 1));
      const freq = freqs[freqIdx]?.toFixed(0) || '0';
      ctx.fillText(freq + ' Hz', padding - 10, y + 4);
    }
  };

  if (!visible) return null;

  return (
    <div className="spectrogram" style={{ position: 'relative' }}>
      <h3 className="spectrogram-title">{title}</h3>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={900}
          height={350}
          className="spectrogram-canvas"
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
            Loading spectrogram...
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
            pointerEvents: 'none'
          }}>
            Error: {error}
          </div>
        )}
        {!signal && (
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
            No signal data available
          </div>
        )}
      </div>
    </div>
  );
}

export default Spectrogram;