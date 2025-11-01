import React, { useEffect, useRef } from 'react';
import './Spectrogram.css';

function Spectrogram({ signal, title, visible }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!signal || !canvasRef.current || !visible) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, width, height);

    drawPlaceholderSpectrogram(ctx, width, height);

  }, [signal, visible]);

  const drawPlaceholderSpectrogram = (ctx, width, height) => {
    for (let x = 0; x < width; x += 4) {
      for (let y = 0; y < height; y += 4) {
        const intensity = Math.random() * 0.5 + 0.2;
        ctx.fillStyle = `rgba(125, 211, 252, ${intensity})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
  };

  if (!visible) return null;

  return (
    <div className="spectrogram">
      <h3 className="spectrogram-title">{title}</h3>
      <canvas
        ref={canvasRef}
        width={900}
        height={350}
        className="spectrogram-canvas"
      />
    </div>
  );
}

export default Spectrogram;