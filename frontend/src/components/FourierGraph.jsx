// import React, { useEffect, useRef } from "react";
// import "../styles/FourierGraph.css";

// function FourierGraph({
//   fourierData,
//   scale = "linear",
//   title = "Fourier Transform",
//   isLoading,
//   error,
// }) {
//   const canvasRef = useRef(null);

//   useEffect(() => {
//     if (!fourierData || !canvasRef.current) return;

//     if (!fourierData.frequencies || !fourierData.magnitudes) {
//       return;
//     }

//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");
//     const width = canvas.width;
//     const height = canvas.height;

//     // 1. Clear canvas
//     ctx.clearRect(0, 0, width, height);
//     // 2. Opaque background
//     ctx.fillStyle = "rgb(15, 23, 42)";
//     ctx.fillRect(0, 0, width, height);

//     drawFFTGraph(ctx, fourierData, width, height, scale);
//   }, [fourierData, scale]);

//   const drawFFTGraph = (ctx, fourierData, width, height, scale) => {
//     const frequencies = fourierData.frequencies || [];
//     const magnitudes = fourierData.magnitudes || [];

//     if (frequencies.length === 0 || magnitudes.length === 0) return;

//     const minLength = Math.min(frequencies.length, magnitudes.length);
//     const frequencies_trimmed = frequencies.slice(0, minLength);
//     const magnitudes_trimmed = magnitudes.slice(0, minLength);

//     // 1. Find Global Max Magnitude (for normalization)
//     let maxMagnitude = 0;
//     for (let i = 0; i < minLength; i++) {
//       if (magnitudes_trimmed[i] > maxMagnitude)
//         maxMagnitude = magnitudes_trimmed[i];
//     }
//     if (maxMagnitude === 0) maxMagnitude = 1;

//     // 2. Calculate Max Frequency
//     const signalMaxFreq = frequencies_trimmed[frequencies_trimmed.length - 1];

//     // Define Log limits (Log(0) is impossible, so we start at 20Hz - standard human hearing start)
//     const minLogFreq = 20;
//     const maxLogFreq = Math.max(20000, signalMaxFreq);

//     const padding = 50;
//     const graphWidth = width - padding * 2;
//     const graphHeight = height - padding * 2;

//     // === DRAW GRID ===
//     ctx.strokeStyle = "rgba(125, 211, 252, 0.1)";
//     ctx.lineWidth = 0.5;
//     for (let i = 0; i <= 10; i++) {
//       const x = padding + (graphWidth / 10) * i;
//       const y = padding + (graphHeight / 10) * i;
//       ctx.beginPath();
//       ctx.moveTo(x, padding);
//       ctx.lineTo(x, height - padding);
//       ctx.stroke();
//       ctx.beginPath();
//       ctx.moveTo(padding, y);
//       ctx.lineTo(width - padding, y);
//       ctx.stroke();
//     }

//     // === PROCESS DATA POINTS ===
//     let points = [];

//     if (scale === "audiogram") {
//       // === AUDIOGRAM MODE: Log Frequency (X), Decibels (Y) ===
//       const minLog = Math.log10(minLogFreq);
//       const maxLog = Math.log10(maxLogFreq);
//       const logRange = maxLog - minLog;

//       for (let i = 0; i < minLength; i++) {
//         const freq = frequencies_trimmed[i];
//         const mag = magnitudes_trimmed[i];

//         if (freq >= minLogFreq && freq <= maxLogFreq) {
//           // X: Logarithmic mapping
//           const fractionX = (Math.log10(freq) - minLog) / logRange;

//           // Y: Decibel mapping (0dB top, -100dB bottom)
//           // dB = 20 * log10(mag / max)
//           let db = 20 * Math.log10((mag + 1e-9) / maxMagnitude);
//           if (db < -100) db = -100; // Floor at -100dB

//           // Normalize Y to 0..1 range (where 1 is 0dB/Top, 0 is -100dB/Bottom)
//           const fractionY = (db + 100) / 100;

//           if (fractionX >= 0 && fractionX <= 1) {
//             points.push({ x: fractionX, y: fractionY, freq });
//           }
//         }
//       }
//     } else {
//       // === LINEAR MODE: Linear Frequency (X), Linear Amplitude (Y) ===
//       for (let i = 0; i < minLength; i++) {
//         const fractionX = i / (minLength - 1);
//         // Y is simple linear ratio of max magnitude
//         const fractionY = magnitudes_trimmed[i] / maxMagnitude;

//         points.push({
//           x: fractionX,
//           y: fractionY,
//           freq: frequencies_trimmed[i],
//         });
//       }
//     }

//     // === DECIMATION (Optimize rendering speed) ===
//     const maxDisplayPoints = 2000;
//     if (points.length > maxDisplayPoints) {
//       const blockSize = points.length / maxDisplayPoints;
//       const decimated = [];
//       for (let i = 0; i < maxDisplayPoints; i++) {
//         const start = Math.floor(i * blockSize);
//         const end = Math.floor((i + 1) * blockSize);
//         let maxY = -Infinity;
//         let bestPoint = null;
//         for (let j = start; j < end && j < points.length; j++) {
//           if (points[j].y > maxY) {
//             maxY = points[j].y;
//             bestPoint = points[j];
//           }
//         }
//         if (bestPoint) decimated.push(bestPoint);
//       }
//       points = decimated;
//     }

//     if (points.length === 0) return;

//     // === DRAW THE LINE ===
//     const mapYToPixel = (normalizedY) => {
//       // normalizedY is 0..1.
//       // In Canvas, 0 is top. We want 1.0 (High amp) to be at top (padding).
//       // We want 0.0 (Silence) to be at bottom (height - padding).
//       return height - padding - normalizedY * graphHeight;
//     };

//     ctx.strokeStyle = "#7dd3fc";
//     ctx.lineWidth = 2;
//     ctx.beginPath();

//     for (let i = 0; i < points.length; i++) {
//       const p = points[i];
//       const x = padding + p.x * graphWidth;
//       const y = mapYToPixel(p.y);

//       if (i === 0) ctx.moveTo(x, y);
//       else ctx.lineTo(x, y);
//     }
//     ctx.stroke();

//     // === FILL AREA ===
//     const lastP = points[points.length - 1];
//     const lastX = padding + lastP.x * graphWidth;
//     ctx.lineTo(lastX, height - padding); // Bottom Right
//     ctx.lineTo(padding, height - padding); // Bottom Left
//     ctx.closePath();
//     ctx.fillStyle = "rgba(125, 211, 252, 0.1)";
//     ctx.fill();

//     // === DRAW AXES & LABELS ===
//     ctx.strokeStyle = "rgba(125, 211, 252, 0.3)";
//     ctx.lineWidth = 1;
//     ctx.beginPath();
//     ctx.moveTo(padding, padding);
//     ctx.lineTo(padding, height - padding);
//     ctx.lineTo(width - padding, height - padding);
//     ctx.stroke();

//     ctx.fillStyle = "#94a3b8";
//     ctx.font = "11px Arial";
//     ctx.textAlign = "center";

//     const numTicks = 5;

//     // --- X-AXIS LABELS ---
//     if (scale === "audiogram") {
//       // Logarithmic Labels
//       const minLog = Math.log10(minLogFreq);
//       const maxLog = Math.log10(maxLogFreq);
//       const logRange = maxLog - minLog;

//       for (let i = 0; i <= numTicks; i++) {
//         const t = i / numTicks;
//         const x = padding + t * graphWidth;

//         // Calculate freq at this visual position
//         const freqVal = Math.pow(10, minLog + t * logRange);

//         let label;
//         if (freqVal >= 1000) label = (freqVal / 1000).toFixed(1) + "k";
//         else label = freqVal.toFixed(0);

//         ctx.fillText(label + " Hz", x, height - padding + 20);
//       }
//     } else {
//       // Linear Labels
//       for (let i = 0; i <= numTicks; i++) {
//         const x = padding + (graphWidth / numTicks) * i;
//         const freqVal = (signalMaxFreq / numTicks) * i;

//         let label;
//         if (freqVal >= 1000) label = (freqVal / 1000).toFixed(1) + "k";
//         else label = freqVal.toFixed(0);

//         ctx.fillText(label + " Hz", x, height - padding + 20);
//       }
//     }

//     // --- Y-AXIS LABELS ---
//     ctx.textAlign = "right";
//     for (let i = 0; i <= numTicks; i++) {
//       const y = padding + (graphHeight / numTicks) * i;
//       let label;

//       if (scale === "audiogram") {
//         // Label in dB (0dB at top, -100dB at bottom)
//         // i=0 -> Top -> 0dB
//         // i=5 -> Bottom -> -100dB
//         const db = -(i / numTicks) * 100;
//         label = db.toFixed(0) + " dB";
//       } else {
//         // Label in Linear Amp (Max at top, 0 at bottom)
//         const amp = maxMagnitude * (1 - i / numTicks);
//         label = amp.toFixed(1);
//       }

//       ctx.fillText(label, padding - 10, y + 4);
//     }
//   };

//   return (
//     <div className="fourier-graph" style={{ position: "relative" }}>
//       <h3 className="fourier-graph-title">{title}</h3>
//       <div style={{ position: "relative" }}>
//         <canvas
//           ref={canvasRef}
//           width={900}
//           height={350}
//           className="fourier-graph-canvas"
//         />
//         {isLoading && (
//           <div
//             style={{
//               color: "#94a3b8",
//               position: "absolute",
//               top: "50%",
//               left: "50%",
//               transform: "translate(-50%, -50%)",
//             }}
//           >
//             Loading...
//           </div>
//         )}
//         {error && (
//           <div
//             style={{
//               color: "#ef4444",
//               position: "absolute",
//               top: "50%",
//               left: "50%",
//               transform: "translate(-50%, -50%)",
//             }}
//           >
//             Error: {error}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default FourierGraph;
import React, { useEffect, useRef } from "react";
import "../styles/FourierGraph.css";

function FourierGraph({
  fourierData,
  scale = "linear",
  title = "Fourier Transform",
  isLoading,
  error,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!fourierData || !canvasRef.current) return;
    if (!fourierData.frequencies || !fourierData.magnitudes) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Ghosting fix
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgb(15, 23, 42)";
    ctx.fillRect(0, 0, width, height);

    drawFFTGraph(ctx, fourierData, width, height, scale);
  }, [fourierData, scale]);

  const drawFFTGraph = (ctx, fourierData, width, height, scale) => {
    const frequencies = fourierData.frequencies || [];
    const magnitudes = fourierData.magnitudes || [];

    if (frequencies.length === 0 || magnitudes.length === 0) return;

    const minLength = Math.min(frequencies.length, magnitudes.length);
    const frequencies_trimmed = frequencies.slice(0, minLength);
    const magnitudes_trimmed = magnitudes.slice(0, minLength);

    // Find Signal Max Freq (Nyquist)
    const signalMaxFreq = frequencies_trimmed[frequencies_trimmed.length - 1];

    // Find Max Magnitude for Normalization
    let maxLinearMag = 0;
    for (let i = 0; i < minLength; i++) {
      if (magnitudes_trimmed[i] > maxLinearMag)
        maxLinearMag = magnitudes_trimmed[i];
    }
    if (maxLinearMag === 0) maxLinearMag = 1;

    const padding = 50;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    let points = [];

    if (scale === "audiogram") {
      // === AUDIOGRAM (Log Scale / dB) ===
      const minLogFreq = 20;
      const maxLogFreq = Math.max(8000, signalMaxFreq);
      const minLog = Math.log10(minLogFreq);
      const maxLog = Math.log10(maxLogFreq);
      const logRange = maxLog - minLog;

      for (let i = 0; i < minLength; i++) {
        const freq = frequencies_trimmed[i];
        const mag = magnitudes_trimmed[i];
        if (freq >= minLogFreq && freq <= maxLogFreq) {
          const fractionX = (Math.log10(freq) - minLog) / logRange;
          // dB calculation (0dB at max, -100dB floor)
          let db = 20 * Math.log10((mag + 1e-9) / maxLinearMag);
          if (db < -100) db = -100;
          const fractionY = (db + 100) / 100;

          if (fractionX >= 0 && fractionX <= 1) {
            points.push({ x: fractionX, y: fractionY, freq, val: db });
          }
        }
      }
    } else {
      // === LINEAR ===
      for (let i = 0; i < minLength; i++) {
        const fractionX = i / (minLength - 1);
        const fractionY = magnitudes_trimmed[i] / maxLinearMag;
        points.push({
          x: fractionX,
          y: fractionY,
          freq: frequencies_trimmed[i],
        });
      }
    }

    if (points.length === 0) return;

    // Decimation
    const maxDisplayPoints = 2000;
    if (points.length > maxDisplayPoints) {
      const blockSize = points.length / maxDisplayPoints;
      const decimated = [];
      for (let i = 0; i < maxDisplayPoints; i++) {
        const start = Math.floor(i * blockSize);
        const end = Math.floor((i + 1) * blockSize);
        let bestPoint = null;
        let maxY = -Infinity;
        for (let j = start; j < end && j < points.length; j++) {
          if (points[j].y > maxY) {
            maxY = points[j].y;
            bestPoint = points[j];
          }
        }
        if (bestPoint) decimated.push(bestPoint);
      }
      points = decimated;
    }

    // Grid
    ctx.strokeStyle = "rgba(125, 211, 252, 0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const pos = padding + (graphWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, height - padding);
      ctx.stroke();
      const posY = padding + (graphHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, posY);
      ctx.lineTo(width - padding, posY);
      ctx.stroke();
    }

    // Line
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = padding + p.x * graphWidth;
      const y = height - padding - p.y * graphHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill
    const lastP = points[points.length - 1];
    ctx.lineTo(padding + lastP.x * graphWidth, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = "rgba(125, 211, 252, 0.1)";
    ctx.fill();

    // Labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";

    const numTicks = 5;
    // X Labels
    if (scale === "audiogram") {
      const minLog = Math.log10(20);
      const maxLog = Math.log10(Math.max(8000, signalMaxFreq));
      const logRange = maxLog - minLog;
      for (let i = 0; i <= numTicks; i++) {
        const t = i / numTicks;
        const x = padding + t * graphWidth;
        const freqVal = Math.pow(10, minLog + t * logRange);
        const label =
          freqVal >= 1000
            ? (freqVal / 1000).toFixed(1) + "k"
            : freqVal.toFixed(0);
        ctx.fillText(label + " Hz", x, height - padding + 20);
      }
    } else {
      for (let i = 0; i <= numTicks; i++) {
        const t = i / numTicks;
        const x = padding + t * graphWidth;
        const freqVal = t * signalMaxFreq;
        const label =
          freqVal >= 1000
            ? (freqVal / 1000).toFixed(1) + "k"
            : freqVal.toFixed(0);
        ctx.fillText(label + " Hz", x, height - padding + 20);
      }
    }

    // Y Labels
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      let label;
      if (scale === "audiogram") {
        const dbVal = -(i / 5) * 100;
        label = dbVal.toFixed(0) + " dB";
      } else {
        label = (maxLinearMag * (1 - i / 5)).toFixed(2);
      }
      ctx.fillText(label, padding - 10, y + 4);
    }
  };

  return (
    <div className="fourier-graph" style={{ position: "relative" }}>
      <h3 className="fourier-graph-title">{title}</h3>
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={900}
          height={350}
          className="fourier-graph-canvas"
        />
        {isLoading && (
          <div
            style={{
              color: "#94a3b8",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            Loading...
          </div>
        )}
        {error && (
          <div
            style={{
              color: "#ef4444",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default FourierGraph;
