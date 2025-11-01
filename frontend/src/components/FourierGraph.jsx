import React, { useEffect, useRef } from "react";
import "./FourierGraph.css";

function FourierGraph({ fourierData, scale }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!fourierData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "rgba(125, 211, 252, 0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw frequency spectrum
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const frequencies = fourierData.frequencies || [];
    const magnitudes = fourierData.magnitudes || [];

    for (let i = 0; i < frequencies.length; i++) {
      let x;
      if (scale === "audiogram") {
        x =
          (Math.log10(frequencies[i] + 1) /
            Math.log10(frequencies[frequencies.length - 1] + 1)) *
          width;
      } else {
        x = (i / frequencies.length) * width;
      }

      const y = height - magnitudes[i] * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw scale label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Inter";
    ctx.fillText(`Scale: ${scale}`, 15, 25);
  }, [fourierData, scale]);

  return (
    <div className="fourier-graph">
      <canvas
        ref={canvasRef}
        width={1200}
        height={250}
        className="fourier-canvas"
      />
    </div>
  );
}

export default FourierGraph;
