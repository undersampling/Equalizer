// import React, { useState, useEffect, useRef } from "react";
// import {
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   ResponsiveContainer,
//   ReferenceLine,
// } from "recharts";

// function LinkedCineViewer({
//   inputSignal,
//   outputSignal,
//   aiModelSignal,
//   comparisonMode,
//   showAIGraphs,
//   sliders,
//   currentMode,
// }) {
//   // Playback & Control State
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [playbackSpeed, setPlaybackSpeed] = useState(1);
//   const [currentTime, setCurrentTime] = useState(0); // Current playback position
//   const [zoom, setZoom] = useState(1);
//   const [windowSize] = useState(2.0); // Fixed window size in seconds
//   const [fftScale, setFftScale] = useState("linear");

//   // Backend Communication State
//   const [signalId, setSignalId] = useState(null);
//   const [windowData, setWindowData] = useState(null);
//   const [isLoadingWindow, setIsLoadingWindow] = useState(false);
//   const [windowError, setWindowError] = useState(null);

//   // Audio Playback
//   const audioContextRef = useRef(null);
//   const audioSourceRef = useRef(null);
//   const animationFrameRef = useRef(null);
//   const lastFrameTimeRef = useRef(null);
//   const fetchIntervalRef = useRef(null);
//   const lastFetchTimeRef = useRef(0);

//   const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

//   // Upload signal when inputSignal changes
//   useEffect(() => {
//     if (inputSignal && inputSignal.data && inputSignal.data.length > 0) {
//       uploadSignalToBackend();
//       setCurrentTime(0);
//       setIsPlaying(false);
//     }
//   }, [inputSignal]);

//   const uploadSignalToBackend = async () => {
//     if (!inputSignal) return;

//     try {
//       const response = await fetch(`${API_BASE_URL}/api/upload-audio`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           signal: inputSignal.data,
//           sampleRate: inputSignal.sampleRate,
//           duration: inputSignal.duration,
//         }),
//       });

//       if (response.ok) {
//         const result = await response.json();
//         setSignalId(result.signal_id);
//         // Fetch initial window
//         fetchWindowData(0, windowSize / zoom, false);
//       } else {
//         console.error("Upload failed");
//         setWindowError("Failed to upload signal");
//       }
//     } catch (error) {
//       console.error("Error uploading signal:", error);
//       setWindowError("Failed to upload signal");
//     }
//   };

//   // Fetch window data from backend
//   const fetchWindowData = async (timeStart, timeEnd, isPlayingFlag) => {
//     if (!signalId || !inputSignal) return;

//     // Throttle requests during playback
//     const now = Date.now();
//     if (isPlayingFlag && now - lastFetchTimeRef.current < 100) {
//       return; // Don't fetch more than once every 100ms during playback
//     }
//     lastFetchTimeRef.current = now;

//     if (!isPlayingFlag) {
//       setIsLoadingWindow(true);
//     }
//     setWindowError(null);

//     try {
//       const response = await fetch(`${API_BASE_URL}/api/static-window`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           signal_id: signalId,
//           settings: {
//             sliders: sliders || [],
//             mode: currentMode || "generic",
//           },
//           time_start: Math.max(0, timeStart),
//           time_end: Math.min(inputSignal.duration, timeEnd),
//           is_playing: isPlayingFlag,
//         }),
//       });

//       if (response.ok) {
//         const data = await response.json();
//         setWindowData(data);
//       } else {
//         const errorData = await response.json();
//         setWindowError(errorData.error || "Failed to fetch window");
//       }
//     } catch (error) {
//       console.error("Error fetching window:", error);
//       setWindowError(error.message);
//     } finally {
//       setIsLoadingWindow(false);
//     }
//   };

//   // Fetch data when currentTime or zoom changes (but not during playback)
//   useEffect(() => {
//     if (signalId && inputSignal && !isPlaying) {
//       const viewWindow = windowSize / zoom;
//       const timeStart = currentTime;
//       const timeEnd = currentTime + viewWindow;

//       fetchWindowData(timeStart, timeEnd, false);
//     }
//   }, [currentTime, zoom, signalId, sliders]);

//   // Animation loop for smooth scrolling playback
//   useEffect(() => {
//     if (isPlaying && inputSignal && signalId) {
//       const animate = (timestamp) => {
//         if (!lastFrameTimeRef.current) {
//           lastFrameTimeRef.current = timestamp;
//           animationFrameRef.current = requestAnimationFrame(animate);
//           return;
//         }

//         const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000.0;
//         lastFrameTimeRef.current = timestamp;

//         const duration = inputSignal.duration;
//         const viewWindow = windowSize / zoom;

//         // Update current time (scroll forward)
//         setCurrentTime((prevTime) => {
//           const newTime = prevTime + deltaTime * playbackSpeed;

//           // Stop at end of signal
//           if (newTime + viewWindow >= duration) {
//             setIsPlaying(false);
//             return Math.max(0, duration - viewWindow);
//           }

//           return newTime;
//         });

//         // Fetch new window data periodically
//         const viewWindow2 = windowSize / zoom;
//         fetchWindowData(currentTime, currentTime + viewWindow2, true);

//         animationFrameRef.current = requestAnimationFrame(animate);
//       };

//       lastFrameTimeRef.current = null;
//       animationFrameRef.current = requestAnimationFrame(animate);
//     }

//     return () => {
//       if (animationFrameRef.current) {
//         cancelAnimationFrame(animationFrameRef.current);
//       }
//     };
//   }, [isPlaying, playbackSpeed, inputSignal, zoom, currentTime, signalId]);

//   // Audio Playback
//   const playAudio = (signal) => {
//     if (!signal || !signal.data) return;
//     if (audioSourceRef.current) {
//       try {
//         audioSourceRef.current.stop();
//       } catch (e) {}
//     }
//     if (!audioContextRef.current) {
//       audioContextRef.current = new (window.AudioContext ||
//         window.webkitAudioContext)();
//     }
//     const audioContext = audioContextRef.current;
//     const audioBuffer = audioContext.createBuffer(
//       1,
//       signal.data.length,
//       signal.sampleRate
//     );
//     const channelData = audioBuffer.getChannelData(0);
//     for (let i = 0; i < signal.data.length; i++) {
//       channelData[i] = signal.data[i];
//     }
//     const source = audioContext.createBufferSource();
//     source.buffer = audioBuffer;
//     source.connect(audioContext.destination);
//     source.start(0);
//     audioSourceRef.current = source;
//   };

//   // Control Handlers
//   const handlePlayPause = () => {
//     setIsPlaying(!isPlaying);
//   };

//   const handleReset = () => {
//     setIsPlaying(false);
//     setZoom(1);
//     setCurrentTime(0);
//     setPlaybackSpeed(1);
//     if (signalId && inputSignal) {
//       fetchWindowData(0, windowSize, false);
//     }
//   };

//   const handleSpeedChange = (e) => {
//     setPlaybackSpeed(parseFloat(e.target.value));
//   };

//   const handleZoomIn = () => {
//     setZoom((prev) => {
//       const newZoom = Math.min(prev * 1.5, 100);
//       return newZoom;
//     });
//   };

//   const handleZoomOut = () => {
//     setZoom((prev) => {
//       const newZoom = Math.max(prev / 1.5, 1.0);
//       return newZoom;
//     });
//   };

//   const handleTimeSliderChange = (e) => {
//     const newTime = parseFloat(e.target.value);
//     setCurrentTime(newTime);
//   };

//   // Prepare waveform data for charts with FIXED X-AXIS for scrolling effect
//   const prepareWaveformData = (timeArray, amplitudeArray) => {
//     if (!timeArray || !amplitudeArray || !inputSignal) return [];

//     const maxPoints = 2000;
//     const step = Math.max(1, Math.floor(timeArray.length / maxPoints));

//     // Create data with RELATIVE time (0 to windowSize) for scrolling effect
//     const viewWindow = windowSize / zoom;
//     const startTime = timeArray[0];

//     return timeArray
//       .filter((_, i) => i % step === 0)
//       .map((t, i) => ({
//         time: t - startTime, // Make time relative to window start (creates scrolling effect)
//         originalTime: t, // Keep original time for tooltip
//         amplitude: amplitudeArray[i * step],
//       }));
//   };

//   // Prepare FFT data for charts
//   const prepareFFTData = (frequencies, magnitudes, scale) => {
//     if (!frequencies || !magnitudes) return [];

//     let data = frequencies.map((f, i) => ({
//       frequency: f,
//       magnitude: magnitudes[i],
//     }));

//     if (scale === "audiogram") {
//       // Audiogram scale: logarithmic frequency axis
//       const audiogramFreqs = [125, 250, 500, 1000, 2000, 4000, 8000];
//       data = data.filter((d) =>
//         audiogramFreqs.some((af) => Math.abs(d.frequency - af) < 50)
//       );
//     }

//     const maxPoints = 1000;
//     const step = Math.max(1, Math.floor(data.length / maxPoints));
//     return data.filter((_, i) => i % step === 0);
//   };

//   // Grid Layout
//   const getGridColumns = () => {
//     if (comparisonMode) return "1fr 1fr";
//     if (showAIGraphs && aiModelSignal) return "repeat(3, 1fr)";
//     return "1fr 1fr";
//   };

//   const viewWindow = windowSize / zoom;
//   const maxTime = inputSignal
//     ? Math.max(0, inputSignal.duration - viewWindow)
//     : 0;

//   // Custom Tooltip to show original time
//   const CustomTooltip = ({ active, payload }) => {
//     if (active && payload && payload.length) {
//       return (
//         <div
//           style={{
//             backgroundColor: "#16213e",
//             padding: "10px",
//             border: "1px solid #0f4c75",
//             borderRadius: "5px",
//           }}
//         >
//           <p style={{ margin: 0, color: "#eee" }}>
//             Time: {payload[0].payload.originalTime?.toFixed(3) || 0}s
//           </p>
//           <p style={{ margin: 0, color: "#06d6a0" }}>
//             Amplitude: {payload[0].value?.toFixed(4) || 0}
//           </p>
//         </div>
//       );
//     }
//     return null;
//   };

//   return (
//     <div
//       style={{
//         padding: "20px",
//         backgroundColor: "#1a1a2e",
//         color: "#eee",
//         minHeight: "100vh",
//       }}
//     >
//       {/* Audio Play Buttons */}
//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: getGridColumns(),
//           gap: "10px",
//           marginBottom: "30px",
//         }}
//       >
//         <button
//           onClick={() => playAudio(inputSignal)}
//           style={{ ...buttonStyle, backgroundColor: "#4361ee" }}
//           disabled={!inputSignal}
//         >
//           🔊 Play Input Audio
//         </button>
//         <button
//           onClick={() => playAudio(outputSignal)}
//           style={{ ...buttonStyle, backgroundColor: "#4361ee" }}
//           disabled={!outputSignal}
//         >
//           🔊 Play Output Audio
//         </button>
//         {showAIGraphs && aiModelSignal && (
//           <button
//             onClick={() => playAudio(aiModelSignal)}
//             style={{ ...buttonStyle, backgroundColor: "#7209b7" }}
//           >
//             🔊 Play AI Audio
//           </button>
//         )}
//       </div>

//       {/* Playback Controls */}
//       <section
//         style={{
//           marginBottom: "30px",
//           backgroundColor: "#16213e",
//           padding: "20px",
//           borderRadius: "10px",
//         }}
//       >
//         <h2 style={{ marginBottom: "20px", color: "#0f4c75" }}>
//           🎮 Linked Cine Controller
//         </h2>
//         <div
//           style={{
//             display: "flex",
//             gap: "15px",
//             alignItems: "center",
//             flexWrap: "wrap",
//           }}
//         >
//           <button
//             onClick={handlePlayPause}
//             disabled={!signalId}
//             style={{
//               padding: "10px 20px",
//               backgroundColor: !signalId
//                 ? "#666"
//                 : isPlaying
//                 ? "#e63946"
//                 : "#06d6a0",
//               color: "white",
//               border: "none",
//               borderRadius: "5px",
//               cursor: signalId ? "pointer" : "not-allowed",
//               fontSize: "16px",
//               fontWeight: "bold",
//             }}
//           >
//             {isPlaying ? "⏸ Pause" : "▶ Play"}
//           </button>

//           <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
//             <label>Speed:</label>
//             <input
//               type="range"
//               min="0.25"
//               max="2"
//               step="0.25"
//               value={playbackSpeed}
//               onChange={handleSpeedChange}
//               style={{ width: "150px" }}
//             />
//             <span>{playbackSpeed.toFixed(2)}x</span>
//           </div>

//           <div style={{ display: "flex", gap: "10px" }}>
//             <button
//               onClick={handleZoomIn}
//               style={buttonStyle}
//               disabled={!signalId}
//             >
//               🔍+ Zoom In
//             </button>
//             <button
//               onClick={handleZoomOut}
//               style={buttonStyle}
//               disabled={!signalId}
//             >
//               🔍- Zoom Out
//             </button>
//             <span
//               style={{
//                 padding: "10px",
//                 backgroundColor: "#0f3460",
//                 borderRadius: "5px",
//               }}
//             >
//               Zoom: {zoom.toFixed(1)}x
//             </span>
//           </div>

//           <button
//             onClick={handleReset}
//             style={{ ...buttonStyle, backgroundColor: "#f77f00" }}
//             disabled={!signalId}
//           >
//             🔄 Reset
//           </button>
//         </div>

//         {/* Time Scrubber */}
//         {inputSignal && (
//           <div style={{ marginTop: "20px" }}>
//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 marginBottom: "5px",
//               }}
//             >
//               <label>Time Position:</label>
//               <span>
//                 {currentTime.toFixed(2)}s / {inputSignal.duration.toFixed(2)}s
//                 (Window: {viewWindow.toFixed(2)}s)
//               </span>
//             </div>
//             <input
//               type="range"
//               min="0"
//               max={maxTime}
//               step="0.01"
//               value={currentTime}
//               onChange={handleTimeSliderChange}
//               disabled={isPlaying}
//               style={{ width: "100%" }}
//             />
//             <div
//               style={{
//                 width: "100%",
//                 height: "8px",
//                 backgroundColor: "#0f3460",
//                 borderRadius: "4px",
//                 marginTop: "10px",
//                 overflow: "hidden",
//               }}
//             >
//               <div
//                 style={{
//                   width: `${
//                     (currentTime / (inputSignal.duration || 1)) * 100
//                   }%`,
//                   height: "100%",
//                   backgroundColor: "#06d6a0",
//                   transition: isPlaying ? "none" : "width 0.3s ease",
//                 }}
//               />
//             </div>
//           </div>
//         )}
//       </section>

//       {/* Loading/Error Messages */}
//       {isLoadingWindow && (
//         <div
//           style={{
//             textAlign: "center",
//             color: "#06d6a0",
//             marginBottom: "20px",
//           }}
//         >
//           Loading...
//         </div>
//       )}
//       {windowError && (
//         <div
//           style={{
//             textAlign: "center",
//             color: "#e63946",
//             marginBottom: "20px",
//           }}
//         >
//           Error: {windowError}
//         </div>
//       )}

//       {/* Linked Signal Viewers - Amplitude vs Time */}
//       <section style={{ marginBottom: "30px" }}>
//         <h2 style={{ marginBottom: "20px", color: "#0f4c75" }}>
//           📊 Linked Signal Amplitude vs Time (Scrolling Window)
//         </h2>
//         <div
//           style={{
//             display: "grid",
//             gridTemplateColumns: getGridColumns(),
//             gap: "20px",
//           }}
//         >
//           {windowData && windowData.input_waveform && (
//             <ChartContainer
//               title={`Input Signal ${isPlaying ? "(Playing...)" : ""}`}
//             >
//               <ResponsiveContainer width="100%" height={300}>
//                 <LineChart
//                   data={prepareWaveformData(
//                     windowData.input_waveform.time,
//                     windowData.input_waveform.amplitude
//                   )}
//                 >
//                   <CartesianGrid strokeDasharray="3 3" stroke="#333" />
//                   <XAxis
//                     dataKey="time"
//                     stroke="#eee"
//                     domain={[0, viewWindow]}
//                     type="number"
//                     label={{
//                       value: `Time in Window (s) | Current: ${currentTime.toFixed(
//                         2
//                       )}s`,
//                       position: "insideBottom",
//                       offset: -5,
//                       fill: "#eee",
//                     }}
//                   />
//                   <YAxis
//                     stroke="#eee"
//                     label={{
//                       value: "Amplitude",
//                       angle: -90,
//                       position: "insideLeft",
//                       fill: "#eee",
//                     }}
//                   />
//                   <Tooltip content={<CustomTooltip />} />
//                   <Line
//                     type="monotone"
//                     dataKey="amplitude"
//                     stroke="#06d6a0"
//                     dot={false}
//                     strokeWidth={2}
//                     isAnimationActive={false}
//                   />
//                 </LineChart>
//               </ResponsiveContainer>
//             </ChartContainer>
//           )}

//           {windowData && windowData.output_waveform && (
//             <ChartContainer
//               title={`Output Signal ${
//                 isPlaying ? "(Playing...)" : "(EQ Applied)"
//               }`}
//             >
//               <ResponsiveContainer width="100%" height={300}>
//                 <LineChart
//                   data={prepareWaveformData(
//                     windowData.output_waveform.time,
//                     windowData.output_waveform.amplitude
//                   )}
//                 >
//                   <CartesianGrid strokeDasharray="3 3" stroke="#333" />
//                   <XAxis
//                     dataKey="time"
//                     stroke="#eee"
//                     domain={[0, viewWindow]}
//                     type="number"
//                     label={{
//                       value: `Time in Window (s) | Current: ${currentTime.toFixed(
//                         2
//                       )}s`,
//                       position: "insideBottom",
//                       offset: -5,
//                       fill: "#eee",
//                     }}
//                   />
//                   <YAxis
//                     stroke="#eee"
//                     label={{
//                       value: "Amplitude",
//                       angle: -90,
//                       position: "insideLeft",
//                       fill: "#eee",
//                     }}
//                   />
//                   <Tooltip content={<CustomTooltip />} />
//                   <Line
//                     type="monotone"
//                     dataKey="amplitude"
//                     stroke="#4361ee"
//                     dot={false}
//                     strokeWidth={2}
//                     isAnimationActive={false}
//                   />
//                 </LineChart>
//               </ResponsiveContainer>
//             </ChartContainer>
//           )}

//           {showAIGraphs && aiModelSignal && windowData && (
//             <ChartContainer title="AI Model Signal">
//               <ResponsiveContainer width="100%" height={300}>
//                 <LineChart
//                   data={prepareWaveformData(
//                     windowData.output_waveform.time,
//                     windowData.output_waveform.amplitude
//                   )}
//                 >
//                   <CartesianGrid strokeDasharray="3 3" stroke="#333" />
//                   <XAxis
//                     dataKey="time"
//                     stroke="#eee"
//                     domain={[0, viewWindow]}
//                     type="number"
//                     label={{
//                       value: `Time in Window (s) | Current: ${currentTime.toFixed(
//                         2
//                       )}s`,
//                       position: "insideBottom",
//                       offset: -5,
//                       fill: "#eee",
//                     }}
//                   />
//                   <YAxis
//                     stroke="#eee"
//                     label={{
//                       value: "Amplitude",
//                       angle: -90,
//                       position: "insideLeft",
//                       fill: "#eee",
//                     }}
//                   />
//                   <Tooltip content={<CustomTooltip />} />
//                   <Line
//                     type="monotone"
//                     dataKey="amplitude"
//                     stroke="#7209b7"
//                     dot={false}
//                     strokeWidth={2}
//                     isAnimationActive={false}
//                   />
//                 </LineChart>
//               </ResponsiveContainer>
//             </ChartContainer>
//           )}
//         </div>
//       </section>

//       {/* Linked Fourier Graphs - Amplitude vs Frequency */}
//       <section>
//         <div
//           style={{
//             display: "flex",
//             justifyContent: "space-between",
//             alignItems: "center",
//             marginBottom: "20px",
//           }}
//         >
//           <h2 style={{ color: "#0f4c75" }}>📈 Linked Fourier Transform</h2>
//           <div>
//             <label style={{ marginRight: "10px" }}>Scale:</label>
//             <select
//               value={fftScale}
//               onChange={(e) => setFftScale(e.target.value)}
//               style={{
//                 padding: "8px",
//                 backgroundColor: "#16213e",
//                 color: "#eee",
//                 border: "1px solid #0f4c75",
//                 borderRadius: "5px",
//               }}
//             >
//               <option value="linear">Linear</option>
//               <option value="audiogram">Audiogram</option>
//             </select>
//           </div>
//         </div>
//         {isPlaying && (
//           <div
//             style={{
//               textAlign: "center",
//               color: "#f77f00",
//               marginBottom: "20px",
//             }}
//           >
//             (FFT processing is paused during playback for performance)
//           </div>
//         )}
//         <div
//           style={{
//             display: "grid",
//             gridTemplateColumns: getGridColumns(),
//             gap: "20px",
//           }}
//         >
//           {windowData &&
//             windowData.input_fft &&
//             windowData.input_fft.frequencies &&
//             windowData.input_fft.frequencies.length > 0 && (
//               <ChartContainer title="Input FFT">
//                 <ResponsiveContainer width="100%" height={300}>
//                   <LineChart
//                     data={prepareFFTData(
//                       windowData.input_fft.frequencies,
//                       windowData.input_fft.magnitudes,
//                       fftScale
//                     )}
//                   >
//                     <CartesianGrid strokeDasharray="3 3" stroke="#333" />
//                     <XAxis
//                       dataKey="frequency"
//                       stroke="#eee"
//                       scale={fftScale === "audiogram" ? "log" : "linear"}
//                       domain={
//                         fftScale === "audiogram"
//                           ? [100, 10000]
//                           : ["auto", "auto"]
//                       }
//                       label={{
//                         value: "Frequency (Hz)",
//                         position: "insideBottom",
//                         offset: -5,
//                         fill: "#eee",
//                       }}
//                     />
//                     <YAxis
//                       stroke="#eee"
//                       label={{
//                         value: "Magnitude",
//                         angle: -90,
//                         position: "insideLeft",
//                         fill: "#eee",
//                       }}
//                     />
//                     <Tooltip
//                       contentStyle={{
//                         backgroundColor: "#16213e",
//                         border: "1px solid #0f4c75",
//                       }}
//                     />
//                     <Line
//                       type="monotone"
//                       dataKey="magnitude"
//                       stroke="#06d6a0"
//                       dot={false}
//                       strokeWidth={2}
//                       isAnimationActive={false}
//                     />
//                   </LineChart>
//                 </ResponsiveContainer>
//               </ChartContainer>
//             )}

//           {windowData &&
//             windowData.output_fft &&
//             windowData.output_fft.frequencies &&
//             windowData.output_fft.frequencies.length > 0 && (
//               <ChartContainer title="Output FFT">
//                 <ResponsiveContainer width="100%" height={300}>
//                   <LineChart
//                     data={prepareFFTData(
//                       windowData.output_fft.frequencies,
//                       windowData.output_fft.magnitudes,
//                       fftScale
//                     )}
//                   >
//                     <CartesianGrid strokeDasharray="3 3" stroke="#333" />
//                     <XAxis
//                       dataKey="frequency"
//                       stroke="#eee"
//                       scale={fftScale === "audiogram" ? "log" : "linear"}
//                       domain={
//                         fftScale === "audiogram"
//                           ? [100, 10000]
//                           : ["auto", "auto"]
//                       }
//                       label={{
//                         value: "Frequency (Hz)",
//                         position: "insideBottom",
//                         offset: -5,
//                         fill: "#eee",
//                       }}
//                     />
//                     <YAxis
//                       stroke="#eee"
//                       label={{
//                         value: "Magnitude",
//                         angle: -90,
//                         position: "insideLeft",
//                         fill: "#eee",
//                       }}
//                     />
//                     <Tooltip
//                       contentStyle={{
//                         backgroundColor: "#16213e",
//                         border: "1px solid #0f4c75",
//                       }}
//                     />
//                     <Line
//                       type="monotone"
//                       dataKey="magnitude"
//                       stroke="#4361ee"
//                       dot={false}
//                       strokeWidth={2}
//                       isAnimationActive={false}
//                     />
//                   </LineChart>
//                 </ResponsiveContainer>
//               </ChartContainer>
//             )}

//           {showAIGraphs &&
//             aiModelSignal &&
//             windowData &&
//             windowData.output_fft &&
//             windowData.output_fft.frequencies &&
//             windowData.output_fft.frequencies.length > 0 && (
//               <ChartContainer title="AI Model FFT">
//                 <ResponsiveContainer width="100%" height={300}>
//                   <LineChart
//                     data={prepareFFTData(
//                       windowData.output_fft.frequencies,
//                       windowData.output_fft.magnitudes,
//                       fftScale
//                     )}
//                   >
//                     <CartesianGrid strokeDasharray="3 3" stroke="#333" />
//                     <XAxis
//                       dataKey="frequency"
//                       stroke="#eee"
//                       scale={fftScale === "audiogram" ? "log" : "linear"}
//                       domain={
//                         fftScale === "audiogram"
//                           ? [100, 10000]
//                           : ["auto", "auto"]
//                       }
//                       label={{
//                         value: "Frequency (Hz)",
//                         position: "insideBottom",
//                         offset: -5,
//                         fill: "#eee",
//                       }}
//                     />
//                     <YAxis
//                       stroke="#eee"
//                       label={{
//                         value: "Magnitude",
//                         angle: -90,
//                         position: "insideLeft",
//                         fill: "#eee",
//                       }}
//                     />
//                     <Tooltip
//                       contentStyle={{
//                         backgroundColor: "#16213e",
//                         border: "1px solid #0f4c75",
//                       }}
//                     />
//                     <Line
//                       type="monotone"
//                       dataKey="magnitude"
//                       stroke="#7209b7"
//                       dot={false}
//                       strokeWidth={2}
//                       isAnimationActive={false}
//                     />
//                   </LineChart>
//                 </ResponsiveContainer>
//               </ChartContainer>
//             )}
//         </div>
//       </section>
//     </div>
//   );
// }

// // Helper component for chart containers
// function ChartContainer({ title, children }) {
//   return (
//     <div
//       style={{
//         backgroundColor: "#16213e",
//         padding: "15px",
//         borderRadius: "10px",
//       }}
//     >
//       <h3 style={{ marginBottom: "10px", color: "#eee", fontSize: "16px" }}>
//         {title}
//       </h3>
//       {children}
//     </div>
//   );
// }

// // Button styling
// const buttonStyle = {
//   padding: "10px 15px",
//   backgroundColor: "#0f4c75",
//   color: "white",
//   border: "none",
//   borderRadius: "5px",
//   cursor: "pointer",
//   fontSize: "14px",
//   fontWeight: "500",
// };

// export default LinkedCineViewer;

import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import "./LinkedViewer.css";

function LinkedViewer({
  inputSignal,
  outputSignal,
  aiModelSignal,
  comparisonMode,
  showAIGraphs,
  sliders,
  currentMode,
}) {
  // Playback & Control State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [windowSize] = useState(2.0);
  const [fftScale, setFftScale] = useState("linear");

  // Y-axis range state (stable ranges)
  const [yAxisRange, setYAxisRange] = useState({ min: -1, max: 1 });
  const [fftYAxisRange, setFftYAxisRange] = useState({ min: 0, max: 100 });

  // Backend Communication State
  const [signalId, setSignalId] = useState(null);
  const [windowData, setWindowData] = useState(null);
  const [isLoadingWindow, setIsLoadingWindow] = useState(false);
  const [windowError, setWindowError] = useState(null);

  // Audio Playback
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const lastFetchTimeRef = useRef(0);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // Purple color scheme
  const PURPLE_COLORS = [
    "#667eea",
    "#764ba2",
    "#f093fb",
    "#f5576c",
    "#11998e",
    "#38ef7d",
    "#4facfe",
    "#00f2fe",
  ];

  // Upload signal when inputSignal changes
  useEffect(() => {
    if (inputSignal && inputSignal.data && inputSignal.data.length > 0) {
      uploadSignalToBackend();
      setCurrentTime(0);
      setIsPlaying(false);

      // Calculate stable Y-axis range
      try {
        const sampleSize = Math.min(10000, inputSignal.data.length);
        let maxAmp = 0;
        for (let i = 0; i < sampleSize; i++) {
          maxAmp = Math.max(maxAmp, Math.abs(inputSignal.data[i]));
        }
        if (maxAmp === 0) maxAmp = 1; // Avoid flatline range
        const range = maxAmp * 1.1;
        setYAxisRange({ min: -range, max: range });
      } catch (e) {
        console.error("Error calculating Y-axis range:", e);
        setYAxisRange({ min: -1, max: 1 });
      }
    }
  }, [inputSignal]);

  const uploadSignalToBackend = async () => {
    if (!inputSignal) return;
    setIsLoadingWindow(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/upload-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: inputSignal.data,
          sampleRate: inputSignal.sampleRate,
          duration: inputSignal.duration,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSignalId(result.signal_id);
        // Fetch initial window
        fetchWindowData(0, windowSize / zoom, false);
      } else {
        setWindowError("Failed to upload signal");
      }
    } catch (error) {
      console.error("Error uploading signal:", error);
      setWindowError("Failed to upload signal");
    } finally {
      setIsLoadingWindow(false);
    }
  };

  const fetchWindowData = async (timeStart, timeEnd, isPlayingFlag) => {
    if (!signalId || !inputSignal) return;

    // Throttle requests
    const now = Date.now();
    if (isPlayingFlag && now - lastFetchTimeRef.current < 30) {
      // 30ms throttle (target ~33 FPS for requests)
      return;
    }
    lastFetchTimeRef.current = now;

    if (!isPlayingFlag) {
      setIsLoadingWindow(true);
    }
    setWindowError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/static-window`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal_id: signalId,
          settings: {
            sliders: sliders || [],
            mode: currentMode || "generic",
          },
          time_start: Math.max(0, timeStart),
          time_end: Math.min(inputSignal.duration, timeEnd),
          is_playing: isPlayingFlag,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setWindowData(data); // This will trigger the plot update

        // Update FFT Y-axis range when paused
        if (
          !isPlayingFlag &&
          data.input_fft &&
          data.input_fft.magnitudes &&
          data.input_fft.magnitudes.length > 0
        ) {
          let maxMag = 0;
          for (let i = 0; i < data.input_fft.magnitudes.length; i++) {
            maxMag = Math.max(maxMag, data.input_fft.magnitudes[i]);
          }
          if (maxMag === 0) maxMag = 100; // Default
          setFftYAxisRange({ min: 0, max: maxMag * 1.1 });
        }
      } else {
        const errorData = await response.json();
        setWindowError(errorData.error || "Failed to fetch window");
      }
    } catch (error) {
      console.error("Error fetching window:", error);
      setWindowError(error.message);
    } finally {
      setIsLoadingWindow(false);
    }
  };

  // *** BUG FIX 1: Animation Loop (using setInterval) ***
  // This hook ONLY updates the time.
  useEffect(() => {
    if (!isPlaying || !inputSignal) {
      return; // Do nothing if not playing
    }

    // This interval's ONLY job is to update the time
    const interval = setInterval(() => {
      setCurrentTime((prevTime) => {
        const duration = inputSignal.duration;
        const viewWindow = windowSize / zoom;
        // 50ms update interval * speed
        const newTime = prevTime + 0.05 * playbackSpeed;

        if (newTime + viewWindow >= duration) {
          setIsPlaying(false); // Stop loop
          return Math.max(0, duration - viewWindow);
        }
        return newTime;
      });
    }, 50); // Update time ~20fps

    return () => clearInterval(interval); // Cleanup
  }, [isPlaying, inputSignal, playbackSpeed, zoom]);

  // *** BUG FIX 2: Data Fetching Hook ***
  // This hook runs WHENEVER time changes (from animation or scrubbing)
  useEffect(() => {
    if (!signalId || !inputSignal) {
      return; // No signal, don't fetch
    }

    const viewWindow = windowSize / zoom;
    const timeStart = currentTime;
    const timeEnd = currentTime + viewWindow;

    // Fetch data. 'isPlaying' is read from the current state, so it's never stale.
    fetchWindowData(timeStart, timeEnd, isPlaying);
  }, [currentTime, signalId, sliders, zoom, isPlaying]); // Re-fetch if any of these change

  // Audio Playback
  const playAudio = (signal) => {
    if (!signal || !signal.data) return;
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;
    const audioBuffer = audioContext.createBuffer(
      1,
      signal.data.length,
      signal.sampleRate
    );
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < signal.data.length; i++) {
      channelData[i] = signal.data[i];
    }
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
    audioSourceRef.current = source;
  };

  // Control Handlers
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying); // This will trigger the useEffect
  };

  const handleReset = () => {
    setIsPlaying(false);
    setZoom(1);
    setCurrentTime(0);
    setPlaybackSpeed(1);
  };

  const handleSpeedChange = (e) => {
    setPlaybackSpeed(parseFloat(e.target.value));
  };

  const handleZoomChange = (e) => {
    setZoom(parseFloat(e.target.value));
  };

  const handleTimeSliderChange = (e) => {
    // Stop playing if user grabs the slider
    if (isPlaying) {
      setIsPlaying(false);
    }
    setCurrentTime(parseFloat(e.target.value));
  };

  // Prepare Plotly traces for waveforms (SCROLLING DATA)
  const prepareWaveformTraces = (
    timeArray,
    amplitudeArray,
    name,
    color,
    offset = 0
  ) => {
    if (!timeArray || !amplitudeArray || timeArray.length === 0) return [];

    const maxPoints = 1000;
    const step = Math.max(1, Math.floor(timeArray.length / maxPoints));
    const startTime = timeArray[0];

    const x = [];
    const y = [];
    for (let i = 0; i < timeArray.length; i += step) {
      x.push(timeArray[i] - startTime); // Data scrolling logic
      y.push(amplitudeArray[i] + offset);
    }

    return [
      {
        x: x,
        y: y,
        type: "scattergl", // USE WEBGL
        mode: "lines",
        name: name,
        line: { width: 2, color: color },
        hovertemplate: "Time: %{x:.3f}s<br>Amplitude: %{y:.4f}<extra></extra>",
      },
    ];
  };

  // Prepare Plotly traces for FFT
  const prepareFFTTraces = (frequencies, magnitudes, name, color) => {
    if (!frequencies || !magnitudes) return [];

    let x = frequencies;
    let y = magnitudes;

    if (fftScale === "audiogram") {
      const audiogramFreqs = [125, 250, 500, 1000, 2000, 4000, 8000];
      const filtered = [];
      for (let i = 0; i < x.length; i++) {
        for (let af of audiogramFreqs) {
          if (Math.abs(x[i] - af) < 50) {
            filtered.push({ x: x[i], y: y[i] });
            break;
          }
        }
      }
      x = filtered.map((p) => p.x);
      y = filtered.map((p) => p.y);
    }

    const maxPoints = 500;
    const step = Math.max(1, Math.floor(x.length / maxPoints));

    const xSampled = [];
    const ySampled = [];
    for (let i = 0; i < x.length; i += step) {
      xSampled.push(x[i]);
      ySampled.push(y[i]);
    }

    return [
      {
        x: xSampled,
        y: ySampled,
        type: "scattergl", // USE WEBGL
        mode: "lines",
        name: name,
        line: { width: 2, color: color },
        hovertemplate: "Freq: %{x:.0f}Hz<br>Magnitude: %{y:.2f}<extra></extra>",
      },
    ];
  };

  const viewWindow = windowSize / zoom;
  const maxTime = inputSignal
    ? Math.max(0, inputSignal.duration - viewWindow)
    : 0;

  // Memoize plot data to prevent re-renders if data is identical
  const inputWaveData = React.useMemo(
    () =>
      windowData
        ? prepareWaveformTraces(
            windowData.input_waveform.time,
            windowData.input_waveform.amplitude,
            "Input Signal",
            PURPLE_COLORS[0]
          )
        : [],
    [windowData]
  );

  const outputWaveData = React.useMemo(
    () =>
      windowData
        ? prepareWaveformTraces(
            windowData.output_waveform.time,
            windowData.output_waveform.amplitude,
            "Output Signal",
            PURPLE_COLORS[1]
          )
        : [],
    [windowData]
  );

  const inputFFTData = React.useMemo(
    () =>
      windowData && windowData.input_fft
        ? prepareFFTTraces(
            windowData.input_fft.frequencies,
            windowData.input_fft.magnitudes,
            "Input FFT",
            PURPLE_COLORS[0]
          )
        : [],
    [windowData, fftScale]
  );

  const outputFFTData = React.useMemo(
    () =>
      windowData && windowData.output_fft
        ? prepareFFTTraces(
            windowData.output_fft.frequencies,
            windowData.output_fft.magnitudes,
            "Output FFT",
            PURPLE_COLORS[1]
          )
        : [],
    [windowData, fftScale]
  );

  // Grid Layout
  const getGridColumns = () => {
    if (comparisonMode) return "1fr 1fr";
    if (showAIGraphs && aiModelSignal) return "repeat(3, 1fr)";
    return "1fr 1fr";
  };

  // *** X-AXIS FIX: Create dynamic layouts ***
  const waveLayout = React.useMemo(
    () => ({
      // This title shows the *actual* time
      title: `Current Time: ${currentTime.toFixed(2)}s`,
      xaxis: {
        title: "Time in Window (s)", // This label explains the axis
        range: [0, viewWindow],
        autorange: false,
      },
      yaxis: {
        title: "Amplitude",
        range: [yAxisRange.min, yAxisRange.max], // Fixed range
        autorange: false,
      },
      height: 300,
      margin: { l: 50, r: 20, t: 40, b: 40 },
      plot_bgcolor: "#f8f9ff",
      paper_bgcolor: "white",
    }),
    [viewWindow, yAxisRange, currentTime] // Add currentTime dependency
  );

  const fftLayout = React.useMemo(
    () => ({
      xaxis: {
        title: "Frequency (Hz)",
        type: fftScale === "audiogram" ? "log" : "linear",
      },
      yaxis: {
        title: "Magnitude",
        range: [fftYAxisRange.min, fftYAxisRange.max], // Fixed range
        autorange: false,
      },
      height: 300,
      margin: { l: 50, r: 20, t: 40, b: 40 },
      plot_bgcolor: "#f8f9ff",
      paper_bgcolor: "white",
    }),
    [fftScale, fftYAxisRange]
  );

  return (
    <div className="linked-viewer">
      {/* Audio Play Buttons */}
      <div
        className="audio-buttons"
        style={{ gridTemplateColumns: getGridColumns() }}
      >
        <button
          className="audio-btn"
          onClick={() => playAudio(inputSignal)}
          disabled={!inputSignal}
        >
          🔊 Play Input Audio
        </button>
        <button
          className="audio-btn"
          onClick={() => playAudio(outputSignal)}
          disabled={!outputSignal}
        >
          🔊 Play Output Audio
        </button>
        {showAIGraphs && aiModelSignal && (
          <button
            className="audio-btn ai-btn"
            onClick={() => playAudio(aiModelSignal)}
          >
            🔊 Play AI Audio
          </button>
        )}
      </div>

      {/* Playback Controls */}
      <section className="controls-panel">
        <h2 className="section-title">🎮 Linked Cine Controller</h2>

        <div className="controls-row">
          <button
            className={`control-btn ${isPlaying ? "pause" : "play"}`}
            onClick={handlePlayPause}
            disabled={!signalId}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>

          <div className="speed-control">
            <label>Speed:</label>
            <input
              type="range"
              min="0.25"
              max="5"
              step="0.25"
              value={playbackSpeed}
              onChange={handleSpeedChange}
              style={{ width: "200px" }}
            />
            <span>{playbackSpeed.toFixed(2)}x</span>
          </div>

          <button
            className="control-btn"
            onClick={handleReset}
            disabled={!signalId}
          >
            🔄 Reset
          </button>
        </div>

        {/* Zoom Slider */}
        <div className="zoom-control">
          <label>🔍 Zoom Level:</label>
          <input
            type="range"
            min="1"
            max="50"
            step="0.5"
            value={zoom}
            onChange={handleZoomChange}
            disabled={!signalId}
            style={{ flex: 1 }}
          />
          <span className="zoom-display">
            {zoom.toFixed(1)}x (Window: {viewWindow.toFixed(2)}s)
          </span>
        </div>

        {/* Time Scrubber */}
        {inputSignal && (
          <div className="pan-control">
            <label>⏱️ Time:</label>
            <input
              type="range"
              min="0"
              max={maxTime}
              step="0.01"
              value={currentTime}
              onChange={handleTimeSliderChange}
              // disabled={isPlaying} // Allow scrubbing while playing
              className="pan-slider"
            />
            <span>
              {currentTime.toFixed(2)}s / {inputSignal.duration.toFixed(2)}s
            </span>
          </div>
        )}

        {/* Progress Bar */}
        {inputSignal && (
          <div className="time-display">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    (currentTime / (inputSignal.duration || 1)) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Loading/Error */}
      {isLoadingWindow &&
        !isPlaying && ( // Only show loading if not playing
          <div className="loading-indicator">⚡ Loading...</div>
        )}
      {windowError && <div className="error-message">❌ {windowError}</div>}

      {/* Waveform Plots */}
      <section className="section">
        <h2 className="section-title">
          📊 Linked Signal Amplitude vs Time {isPlaying && "🔴 PLAYING"}
        </h2>
        <div
          className="viewers-grid"
          style={{ gridTemplateColumns: getGridColumns() }}
        >
          <div className="plot-container">
            <Plot
              data={inputWaveData}
              layout={{
                ...waveLayout,
                title: `Input (Current: ${currentTime.toFixed(2)}s)`,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "300px" }}
            />
          </div>

          <div className="plot-container">
            <Plot
              data={outputWaveData}
              layout={{
                ...waveLayout,
                title: isPlaying
                  ? `Output (Current: ${currentTime.toFixed(2)}s)`
                  : "Output (EQ)",
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "300px" }}
            />
          </div>

          {showAIGraphs && aiModelSignal && windowData && (
            <div className="plot-container">
              <Plot
                data={
                  outputWaveData // Using outputWaveData as placeholder for AI
                }
                layout={{
                  ...waveLayout,
                  title: `AI Model (Current: ${currentTime.toFixed(2)}s)`,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "300px" }}
              />
            </div>
          )}
        </div>
      </section>

      {/* FFT Plots */}
      <section className="section">
        <div className="fourier-section">
          <h2 className="section-title">📈 Fourier Transform</h2>
          <div className="scale-toggle">
            <label>Scale:</label>
            <select
              value={fftScale}
              onChange={(e) => setFftScale(e.target.value)}
              className="mode-selector"
            >
              <option value="linear">📏 Linear</option>
              <option value="audiogram">👂 Audiogram</option>
            </select>
          </div>
        </div>
        {isPlaying && (
          <div className="loading-indicator">⚡ FFT paused during playback</div>
        )}
        <div
          className="fourier-graphs-grid"
          style={{ gridTemplateColumns: getGridColumns() }}
        >
          <div className="plot-container">
            <Plot
              data={inputFFTData}
              layout={{ ...fftLayout, title: "Input FFT" }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "300px" }}
            />
          </div>

          <div className="plot-container">
            <Plot
              data={outputFFTData}
              layout={{ ...fftLayout, title: "Output FFT" }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "300px" }}
            />
          </div>

          {showAIGraphs && aiModelSignal && windowData && (
            <div className="plot-container">
              <Plot
                data={
                  outputFFTData // Using outputFFTData as placeholder for AI
                }
                layout={{
                  ...fftLayout,
                  title: "AI Model FFT",
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "300px" }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default LinkedViewer;
