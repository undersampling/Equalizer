// import React, { useState, useRef, useEffect, useCallback } from "react";
// import AppHeader from "../components/Header";
// import SliderCreationModal from "../components/SliderCreationModal";
// import apiService from "../services/api";
// import {
//   getAllModeConfigs,
//   clearCache,
//   getFallbackConfig,
//   allowsCustomSliders,
//   autoSyncSliders,
// } from "../utils/modeConfigs";
// import { processAudioFile } from "../utils/audioUtils";
// import {
//   saveSettings,
//   clearSettings,
// } from "../utils/settingsManager";
// import "../styles/MainPage2.css";

// function MainPageCompact() {
//   // Toast notification state
//   const [toast, setToast] = useState({
//     message: "",
//     type: "success",
//     visible: false,
//   });

//   const showToast = (message, type = "success") => {
//     setToast({ message, type, visible: true });
//     setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
//   };

//   const [currentMode, setCurrentMode] = useState("generic");
//   const [sliders, setSliders] = useState([]);
//   const [modeConfigs, setModeConfigs] = useState(null);
//   const [isLoadingModes, setIsLoadingModes] = useState(true);

//   const [inputSignal, setInputSignal] = useState(null);
//   const [outputSignal, setOutputSignal] = useState(null);
//   const [apiSignal, setApiSignal] = useState(null);
//   const [inputFourierData, setInputFourierData] = useState(null);
//   const [outputFourierData, setOutputFourierData] = useState(null);
//   const [fftScale, setFftScale] = useState("linear");
//   const [showSliderModal, setShowSliderModal] = useState(false);
//   const [fftError, setFftError] = useState(null);
//   const [isLoadingFFT, setIsLoadingFFT] = useState(false);
//   const [spectrogramDataInput, setSpectrogramDataInput] = useState(null);
//   const [spectrogramDataOutput, setSpectrogramDataOutput] = useState(null);
//   const [isLoadingSpectrogram, setIsLoadingSpectrogram] = useState(false);

//   // Cine viewer states
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isPaused, setIsPaused] = useState(false);
//   const [playbackSpeed, setPlaybackSpeed] = useState(1);
//   const [currentTime, setCurrentTime] = useState(0);
//   const [zoom, setZoom] = useState(1);
//   const [pan, setPan] = useState(0);

//   const fileInputRef = useRef(null);
//   const audioContextRef = useRef(null);
//   const equalizationTimeoutRef = useRef(null);
//   const fftTimeoutRef = useRef(null);
//   const backendSyncTimeoutRef = useRef(null);
//   const isProcessingRef = useRef(false);
//   const slidersRef = useRef(sliders);
  
//   // Canvas refs
//   const inputWaveCanvasRef = useRef(null);
//   const outputWaveCanvasRef = useRef(null);
//   const inputFFTCanvasRef = useRef(null);
//   const outputFFTCanvasRef = useRef(null);
//   const inputSpectrogramCanvasRef = useRef(null);
//   const outputSpectrogramCanvasRef = useRef(null);

//   // Audio playback refs
//   const animationRef = useRef(null);
//   const lastFrameTimeRef = useRef(null);
//   const accumulatedTimeRef = useRef(0);
//   const audioSourceRef = useRef(null);
//   const startTimeRef = useRef(0);
//   const pausedAtRef = useRef(0);

//   // Helper: interpolate signal
//   const interpolateSignal = useCallback((shortSignal, targetLength) => {
//     if (shortSignal.length === targetLength) return shortSignal;
//     const ratio = (shortSignal.length - 1) / (targetLength - 1);
//     const interpolated = new Array(targetLength);
//     for (let i = 0; i < targetLength; i++) {
//       const pos = i * ratio;
//       const index = Math.floor(pos);
//       const frac = pos - index;
//       if (index + 1 < shortSignal.length) {
//         interpolated[i] = shortSignal[index] * (1 - frac) + shortSignal[index + 1] * frac;
//       } else {
//         interpolated[i] = shortSignal[index];
//       }
//     }
//     return interpolated;
//   }, []);

//   // Compute FFT
//   const computeFourierTransform = useCallback(async (signal, signalType = "input") => {
//     if (!signal || !signal.data || signal.data.length === 0) return;
//     setIsLoadingFFT(true);
//     setFftError(null);
//     try {
//       console.log(`📊 Computing FFT for ${signalType}`);
//       const response = await apiService.computeFFT(signal.data, signal.sampleRate);
//       const fourierData = {
//         frequencies: response.data.frequencies,
//         magnitudes: response.data.magnitudes,
//         phases: response.data.phases,
//       };
//       if (signalType === "input") setInputFourierData(fourierData);
//       else if (signalType === "output") setOutputFourierData(fourierData);
//       setIsLoadingFFT(false);
//       console.log(`✅ FFT computed for ${signalType}`);
//     } catch (error) {
//       console.error(`❌ FFT error for ${signalType}:`, error);
//       setFftError(error.message || "FFT computation failed");
//       setIsLoadingFFT(false);
//     }
//   }, []);

//   // Compute Spectrogram
//   const computeSpectrogram = useCallback(async (signal, signalType = "input") => {
//     if (!signal || !signal.data || signal.data.length === 0) return;
//     setIsLoadingSpectrogram(true);
//     try {
//       console.log(`📊 Computing spectrogram for ${signalType}`);
//       const response = await apiService.generateSpectrogram(
//         signal.data,
//         signal.sampleRate,
//         false,
//         256,
//         signal.sampleRate / 2
//       );
//       if (signalType === "input") setSpectrogramDataInput(response.data);
//       else setSpectrogramDataOutput(response.data);
//       setIsLoadingSpectrogram(false);
//       console.log(`✅ Spectrogram computed for ${signalType}`);
//     } catch (error) {
//       console.error(`❌ Spectrogram error for ${signalType}:`, error);
//       setIsLoadingSpectrogram(false);
//     }
//   }, []);

//   // Load mode configurations
//   useEffect(() => {
//     const loadModeConfigs = async () => {
//       setIsLoadingModes(true);
//       try {
//         const configs = await getAllModeConfigs();
//         if (!configs || Object.keys(configs).length === 0) {
//           throw new Error("No mode configurations received");
//         }
//         setModeConfigs(configs);
//         if (configs[currentMode]) {
//           setSliders(configs[currentMode].sliders);
//           slidersRef.current = configs[currentMode].sliders;
//         }
//       } catch (error) {
//         console.error("❌ Failed to load configs:", error);
//         const fallback = getFallbackConfig(currentMode);
//         setSliders(fallback.sliders);
//         slidersRef.current = fallback.sliders;
//         showToast(`Failed to connect to backend`, "error");
//       } finally {
//         setIsLoadingModes(false);
//       }
//     };
//     loadModeConfigs();
//   }, [currentMode]);

//   useEffect(() => {
//     slidersRef.current = sliders;
//   }, [sliders]);

//   // AUTO-SAVE
//   useEffect(() => {
//     const saveTimeout = setTimeout(() => {
//       if (sliders && sliders.length > 0) {
//         try {
//           // Create clean sliders object without circular references
//           const cleanSliders = sliders.map(slider => ({
//             id: slider.id,
//             label: slider.label,
//             value: slider.value,
//             min: slider.min,
//             max: slider.max,
//             freqRanges: slider.freqRanges
//           }));
          
//           saveSettings(currentMode, cleanSliders);
          
//           if (backendSyncTimeoutRef.current) clearTimeout(backendSyncTimeoutRef.current);
//           backendSyncTimeoutRef.current = setTimeout(async () => {
//             try {
//               await autoSyncSliders(currentMode, cleanSliders);
//             } catch (error) {
//               console.warn("Backend sync failed:", error.message);
//             }
//           }, 2000);
//         } catch (error) {
//           console.error("Save error:", error);
//         }
//       }
//     }, 500);
//     return () => {
//       clearTimeout(saveTimeout);
//       if (backendSyncTimeoutRef.current) clearTimeout(backendSyncTimeoutRef.current);
//     };
//   }, [sliders, currentMode]);

//   // Apply equalization
//   const applyEqualization = useCallback(async () => {
//     if (!inputSignal || !apiSignal || isProcessingRef.current) return;
    
//     const allUnity = slidersRef.current.every(slider => Math.abs(slider.value - 1.0) < 0.000001);
    
//     if (allUnity) {
//       console.log("✅ Unity gain - using original signal");
//       setOutputSignal(inputSignal);
//       setOutputFourierData(inputFourierData);
//       setSpectrogramDataOutput(spectrogramDataInput);
//       return;
//     }
    
//     isProcessingRef.current = true;
//     try {
//       console.log(`🎛️ Applying equalization`);
//       const response = await apiService.equalize(
//         apiSignal.data, 
//         apiSignal.sampleRate, 
//         slidersRef.current, 
//         currentMode
//       );
//       const result = response.data;
      
//       if (!result.outputSignal || !Array.isArray(result.outputSignal)) {
//         throw new Error("Invalid response from equalization API");
//       }
      
//       const outputData = result.outputSignal;
//       let fullOutputData = outputData;
      
//       if (outputData.length !== inputSignal.data.length) {
//         fullOutputData = interpolateSignal(outputData, inputSignal.data.length);
//       }
      
//       const newOutputSignal = {
//         data: fullOutputData,
//         sampleRate: inputSignal.sampleRate,
//         duration: inputSignal.duration,
//       };
      
//       setOutputSignal(newOutputSignal);
      
//       if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
//       fftTimeoutRef.current = setTimeout(() => {
//         computeFourierTransform(newOutputSignal, "output");
//         computeSpectrogram(newOutputSignal, "output");
//       }, 200);
      
//       console.log(`✅ Equalization complete`);
//     } catch (error) {
//       console.error("❌ Equalization failed:", error);
//       showToast("❌ Equalization failed", "error");
//     } finally {
//       isProcessingRef.current = false;
//     }
//   }, [inputSignal, apiSignal, currentMode, computeFourierTransform, computeSpectrogram, inputFourierData, spectrogramDataInput, interpolateSignal]);

//   const handleSliderChange = (sliderId, newValue) => {
//     setSliders((prev) =>
//       prev.map((slider) =>
//         slider.id === sliderId ? { ...slider, value: newValue } : slider
//       )
//     );
//     if (inputSignal && apiSignal) {
//       if (equalizationTimeoutRef.current) clearTimeout(equalizationTimeoutRef.current);
//       equalizationTimeoutRef.current = setTimeout(() => applyEqualization(), 150);
//     }
//   };

//   const handleFileUpload = async (event) => {
//     const file = event.target.files?.[0];
//     if (!file) return;
//     try {
//       console.log("📁 Processing file:", file.name);
//       const audioBuffer = await processAudioFile(file);
//       const channelData = audioBuffer.getChannelData(0);
//       const samples = Array.from(channelData);
      
//       const newInputSignal = {
//         data: samples,
//         sampleRate: audioBuffer.sampleRate,
//         duration: audioBuffer.duration,
//       };
      
//       const newApiSignal = {
//         data: samples,
//         sampleRate: audioBuffer.sampleRate,
//         duration: audioBuffer.duration,
//       };
      
//       setInputSignal(newInputSignal);
//       setApiSignal(newApiSignal);
//       setOutputSignal(newInputSignal);
//       showToast(`✅ Loaded: ${file.name}`, "success");
      
//       setTimeout(() => {
//         computeFourierTransform(newInputSignal, "input");
//         computeFourierTransform(newInputSignal, "output");
//         computeSpectrogram(newInputSignal, "input");
//         computeSpectrogram(newInputSignal, "output");
//       }, 300);
      
//       setTimeout(() => applyEqualization(), 500);
//     } catch (error) {
//       console.error("❌ File upload failed:", error);
//       showToast("❌ Failed to load audio file", "error");
//     }
//   };

//   const handleModeChange = useCallback((newMode) => {
//     console.log("🔄 Changing mode to:", newMode);
//     setCurrentMode(newMode);
//     if (modeConfigs && modeConfigs[newMode]) {
//       const newSliders = modeConfigs[newMode].sliders;
//       setSliders(newSliders);
//       slidersRef.current = newSliders;
//       if (inputSignal && apiSignal) {
//         setTimeout(() => applyEqualization(), 100);
//       }
//     }
//   }, [modeConfigs, inputSignal, apiSignal, applyEqualization]);

//   const handleRefreshModeConfigs = useCallback(async () => {
//     try {
//       console.log("🔄 Resetting to defaults");
//       showToast("Resetting to defaults...", "info");
//       clearSettings(currentMode);
      
//       try {
//         clearCache();
//         const configs = await getAllModeConfigs();
//         if (configs && configs[currentMode] && configs[currentMode].sliders) {
//           setSliders(configs[currentMode].sliders);
//           slidersRef.current = configs[currentMode].sliders;
//         } else {
//           throw new Error("Invalid backend config");
//         }
//       } catch (backendError) {
//         console.warn("Using fallback config");
//         const fallback = getFallbackConfig(currentMode);
//         setSliders(fallback.sliders);
//         slidersRef.current = fallback.sliders;
//       }
      
//       showToast("✅ Reset to defaults!", "success");
      
//       if (inputSignal && apiSignal) {
//         setTimeout(() => applyEqualization(), 500);
//       }
//     } catch (error) {
//       console.error("❌ Reset failed:", error);
//       showToast("❌ Failed to reset settings", "error");
//     }
//   }, [currentMode, inputSignal, apiSignal, applyEqualization]);

//   const reloadConfigFromBackend = async () => {
//     try {
//       clearCache();
//       const configs = await getAllModeConfigs();
//       setModeConfigs(configs);
//       if (configs[currentMode]) {
//         setSliders(configs[currentMode].sliders);
//         slidersRef.current = configs[currentMode].sliders;
//       }
//       showToast("✅ Configuration reloaded", "success");
//     } catch (error) {
//       showToast("❌ Failed to reload config", "error");
//     }
//   };

//   const handleLoadSettingsFromFile = async (settingsData) => {
//     try {
//       setSliders(settingsData.sliders);
//       slidersRef.current = settingsData.sliders;
//       showToast("✅ Settings loaded", "success");
//       if (inputSignal && apiSignal) {
//         setTimeout(() => applyEqualization(), 100);
//       }
//     } catch (error) {
//       showToast("❌ Failed to load settings", "error");
//     }
//   };

//   const canAddCustomSliders = () => {
//     if (!modeConfigs || !modeConfigs[currentMode]) return false;
//     return allowsCustomSliders(modeConfigs[currentMode]);
//   };

//   const allSlidersAtUnity = () => {
//     if (!sliders || sliders.length === 0) return true;
//     return sliders.every((slider) => Math.abs(slider.value - 1.0) < 0.0001);
//   };

//   // Cine playback animation
//   useEffect(() => {
//     if (!isPlaying || !inputSignal) {
//       lastFrameTimeRef.current = null;
//       return;
//     }

//     const animate = (timestamp) => {
//       if (!isPlaying) return;

//       if (lastFrameTimeRef.current === null) {
//         lastFrameTimeRef.current = timestamp;
//       }

//       const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
//       lastFrameTimeRef.current = timestamp;

//       if (audioSourceRef.current && audioContextRef.current) {
//         const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
//         accumulatedTimeRef.current = elapsed;
//         setCurrentTime(elapsed);
//       } else {
//         accumulatedTimeRef.current += deltaTime * playbackSpeed;
//         setCurrentTime(accumulatedTimeRef.current);
//       }

//       if (accumulatedTimeRef.current >= inputSignal.duration) {
//         accumulatedTimeRef.current = inputSignal.duration;
//         setCurrentTime(inputSignal.duration);
//         stopAudio();
//         setIsPlaying(false);
//         setIsPaused(false);
//         pausedAtRef.current = 0;
//         return;
//       }

//       animationRef.current = requestAnimationFrame(animate);
//     };

//     animationRef.current = requestAnimationFrame(animate);

//     return () => {
//       if (animationRef.current) {
//         cancelAnimationFrame(animationRef.current);
//       }
//     };
//   }, [isPlaying, playbackSpeed, inputSignal]);

//   const stopAudio = useCallback(() => {
//     if (audioSourceRef.current) {
//       try {
//         audioSourceRef.current.stop();
//       } catch (e) {
//         console.warn("Audio stop error:", e);
//       }
//       audioSourceRef.current = null;
//     }
//   }, []);

//   const handlePlay = useCallback(() => {
//     if (!inputSignal || !outputSignal) return;

//     const startOffset = isPaused ? pausedAtRef.current : 0;

//     if (!audioContextRef.current) {
//       audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
//     }

//     const audioContext = audioContextRef.current;
//     const audioBuffer = audioContext.createBuffer(1, outputSignal.data.length, outputSignal.sampleRate);
//     const channelData = audioBuffer.getChannelData(0);

//     for (let i = 0; i < outputSignal.data.length; i++) {
//       channelData[i] = outputSignal.data[i];
//     }

//     const source = audioContext.createBufferSource();
//     source.buffer = audioBuffer;
//     source.playbackRate.value = playbackSpeed;
//     source.connect(audioContext.destination);
//     source.start(0, startOffset);

//     source.onended = () => {
//       if (isPlaying) {
//         stopAudio();
//         setIsPlaying(false);
//         setIsPaused(false);
//         setCurrentTime(inputSignal.duration);
//         pausedAtRef.current = 0;
//         accumulatedTimeRef.current = inputSignal.duration;
//       }
//     };

//     audioSourceRef.current = source;
//     startTimeRef.current = audioContext.currentTime - startOffset;
//     accumulatedTimeRef.current = startOffset;
//     setCurrentTime(startOffset);
//     setIsPlaying(true);
//     setIsPaused(false);
//     lastFrameTimeRef.current = null;
//   }, [inputSignal, outputSignal, playbackSpeed, isPaused, isPlaying, stopAudio]);

//   const handlePause = useCallback(() => {
//     if (!isPlaying) return;
//     if (audioSourceRef.current && audioContextRef.current) {
//       const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
//       pausedAtRef.current = elapsed;
//       accumulatedTimeRef.current = elapsed;
//       setCurrentTime(elapsed);
//     } else {
//       pausedAtRef.current = accumulatedTimeRef.current;
//     }
//     stopAudio();
//     setIsPlaying(false);
//     setIsPaused(true);
//     lastFrameTimeRef.current = null;
//   }, [isPlaying, stopAudio]);

//   const handleStop = useCallback(() => {
//     stopAudio();
//     setIsPlaying(false);
//     setIsPaused(false);
//     setCurrentTime(0);
//     setPan(0);
//     lastFrameTimeRef.current = null;
//     accumulatedTimeRef.current = 0;
//     pausedAtRef.current = 0;
//   }, [stopAudio]);

//   const handleSpeedChange = useCallback((e) => {
//     const newSpeed = parseFloat(e.target.value);
//     setPlaybackSpeed(newSpeed);
//     if (isPlaying && audioSourceRef.current) {
//       audioSourceRef.current.playbackRate.value = newSpeed;
//     }
//   }, [isPlaying]);

//   // Draw compact waveforms with playhead
//   useEffect(() => {
//     if (!inputSignal || !outputSignal) return;
//     if (!inputWaveCanvasRef.current || !outputWaveCanvasRef.current) return;

//     const drawWaveform = (canvas, signal, title) => {
//       if (!canvas) return;
//       const ctx = canvas.getContext('2d');
//       if (!ctx) return;
      
//       const width = canvas.width;
//       const height = canvas.height;

//       // Clear canvas
//       ctx.fillStyle = '#0f172a';
//       ctx.fillRect(0, 0, width, height);

//       if (!signal || !signal.data || signal.data.length === 0) return;

//       const totalDuration = signal.duration;
//       const windowDuration = totalDuration / zoom;
//       let windowStartTime;
//       const maxPanTime = Math.max(0, totalDuration - windowDuration);

//       if (isPlaying) {
//         windowStartTime = currentTime - windowDuration / 2;
//         if (windowStartTime + windowDuration > totalDuration) {
//           windowStartTime = totalDuration - windowDuration;
//         }
//         if (windowStartTime < 0) {
//           windowStartTime = 0;
//         }
//       } else {
//         windowStartTime = pan * maxPanTime;
//       }

//       const windowEndTime = windowStartTime + windowDuration;
//       const startSample = Math.floor((windowStartTime / totalDuration) * signal.data.length);
//       const endSample = Math.ceil((windowEndTime / totalDuration) * signal.data.length);

//       const visibleData = signal.data.slice(
//         Math.max(0, startSample),
//         Math.min(signal.data.length, endSample)
//       );

//       if (visibleData.length === 0) return;

//       const step = Math.max(1, Math.floor(visibleData.length / width));
      
//       let minAmp = Infinity;
//       let maxAmp = -Infinity;
//       for (let i = 0; i < visibleData.length; i += step) {
//         if (visibleData[i] < minAmp) minAmp = visibleData[i];
//         if (visibleData[i] > maxAmp) maxAmp = visibleData[i];
//       }

//       const ampRange = maxAmp - minAmp || 1;
//       const padding = ampRange * 0.1;
//       minAmp -= padding;
//       maxAmp += padding;
//       const totalAmpRange = maxAmp - minAmp || 1;

//       const ampToY = (amp) => {
//         return height - ((amp - minAmp) / totalAmpRange) * height;
//       };

//       // Draw waveform
//       ctx.strokeStyle = '#7dd3fc';
//       ctx.lineWidth = 1;
//       ctx.beginPath();
      
//       let drawn = false;
//       for (let i = 0; i < width; i++) {
//         const idx = Math.floor(i * step);
//         if (idx >= visibleData.length) break;
//         const y = ampToY(visibleData[idx]);
//         if (!drawn) {
//           ctx.moveTo(i, y);
//           drawn = true;
//         } else {
//           ctx.lineTo(i, y);
//         }
//       }
//       ctx.stroke();

//       // Draw playhead
//       if (isPlaying && currentTime > 0) {
//         const timeInWindow = currentTime - windowStartTime;
//         const playheadX = (timeInWindow / windowDuration) * width;

//         if (playheadX >= 0 && playheadX <= width) {
//           ctx.strokeStyle = '#00ff88';
//           ctx.lineWidth = 2;
//           ctx.beginPath();
//           ctx.moveTo(playheadX, 0);
//           ctx.lineTo(playheadX, height);
//           ctx.stroke();
//         }
//       }

//       // Draw title
//       ctx.fillStyle = '#94a3b8';
//       ctx.font = '10px Arial';
//       ctx.fillText(title, 5, 12);
//     };

//     try {
//       drawWaveform(inputWaveCanvasRef.current, inputSignal, 'Input');
//       drawWaveform(outputWaveCanvasRef.current, outputSignal, 'Output');
//     } catch (error) {
//       console.error("Waveform drawing error:", error);
//     }
//   }, [inputSignal, outputSignal, isPlaying, currentTime, zoom, pan]);

//   // Draw FFT
//   useEffect(() => {
//     if (!inputFourierData || !outputFourierData) return;
//     if (!inputFFTCanvasRef.current || !outputFFTCanvasRef.current) return;

//     const drawFFT = (canvas, data, title) => {
//       if (!canvas) return;
//       const ctx = canvas.getContext('2d');
//       if (!ctx) return;
      
//       const width = canvas.width;
//       const height = canvas.height;

//       // Clear canvas
//       ctx.fillStyle = '#0f172a';
//       ctx.fillRect(0, 0, width, height);

//       if (!data || !data.frequencies || !data.magnitudes) return;

//       const freqs = data.frequencies;
//       const mags = data.magnitudes;
      
//       if (freqs.length === 0 || mags.length === 0) return;

//       let maxMag = 0;
//       for (let i = 0; i < mags.length; i++) {
//         if (mags[i] > maxMag) maxMag = mags[i];
//       }
//       if (maxMag === 0) maxMag = 1;

//       // Draw FFT curve
//       ctx.strokeStyle = '#7dd3fc';
//       ctx.lineWidth = 1;
//       ctx.beginPath();
      
//       const pointsToPlot = Math.min(freqs.length, width);
//       for (let i = 0; i < pointsToPlot; i++) {
//         const x = (i / pointsToPlot) * width;
//         const y = height - (mags[i] / maxMag) * height;
//         if (i === 0) ctx.moveTo(x, y);
//         else ctx.lineTo(x, y);
//       }
//       ctx.stroke();

//       // Draw title
//       ctx.fillStyle = '#94a3b8';
//       ctx.font = '10px Arial';
//       ctx.fillText(title, 5, 12);
//     };

//     try {
//       drawFFT(inputFFTCanvasRef.current, inputFourierData, 'Input FFT');
//       drawFFT(outputFFTCanvasRef.current, outputFourierData, 'Output FFT');
//     } catch (error) {
//       console.error("FFT drawing error:", error);
//     }
//   }, [inputFourierData, outputFourierData, fftScale]);

//   // Draw Spectrogram
//   useEffect(() => {
//     if (!spectrogramDataInput || !spectrogramDataOutput) return;
//     if (!inputSpectrogramCanvasRef.current || !outputSpectrogramCanvasRef.current) return;

//     const drawSpectrogram = (canvas, data, title) => {
//       if (!canvas) return;
//       const ctx = canvas.getContext('2d');
//       if (!ctx) return;
      
//       const width = canvas.width;
//       const height = canvas.height;

//       // Clear canvas
//       ctx.fillStyle = '#0f172a';
//       ctx.fillRect(0, 0, width, height);

//       if (!data) return;
//       const { x: times, y: freqs, z: spectrogram } = data;
//       if (!times || !freqs || !spectrogram) return;

//       const timeLen = times.length;
//       const freqLen = freqs.length;
      
//       if (timeLen === 0 || freqLen === 0) return;

//       // Find min/max
//       let maxDb = -Infinity;
//       let minDb = Infinity;
//       for (let i = 0; i < Math.min(spectrogram.length, freqLen); i++) {
//         if (!spectrogram[i]) continue;
//         for (let j = 0; j < Math.min(spectrogram[i].length, timeLen); j++) {
//           const val = spectrogram[i][j];
//           if (val > maxDb) maxDb = val;
//           if (val < minDb) minDb = val;
//         }
//       }

//       const range = maxDb - minDb || 1;

//       // Draw spectrogram cells
//       for (let i = 0; i < freqLen && i < spectrogram.length; i++) {
//         if (!spectrogram[i]) continue;
//         for (let j = 0; j < timeLen && j < spectrogram[i].length; j++) {
//           const value = spectrogram[i][j];
//           const normalized = (value - minDb) / range;
//           const x = (j / timeLen) * width;
//           const y = ((freqLen - i - 1) / freqLen) * height;
//           const cellWidth = Math.ceil(width / timeLen) + 1;
//           const cellHeight = Math.ceil(height / freqLen) + 1;
//           const intensity = Math.max(0, Math.min(1, normalized));
//           ctx.fillStyle = `rgba(125, 211, 252, ${intensity})`;
//           ctx.fillRect(x, y, cellWidth, cellHeight);
//         }
//       }

//       // Draw title
//       ctx.fillStyle = '#94a3b8';
//       ctx.font = '10px Arial';
//       ctx.fillText(title, 5, 12);
//     };

//     try {
//       drawSpectrogram(inputSpectrogramCanvasRef.current, spectrogramDataInput, 'Input Spectrogram');
//       drawSpectrogram(outputSpectrogramCanvasRef.current, spectrogramDataOutput, 'Output Spectrogram');
//     } catch (error) {
//       console.error("Spectrogram drawing error:", error);
//     }
//   }, [spectrogramDataInput, spectrogramDataOutput]);

//   return (
//     <div className="compact-app">
//       {toast.visible && (
//         <div className={`toast toast-${toast.type}`}>{toast.message}</div>
//       )}

//       <AppHeader
//         currentMode={currentMode}
//         isLoadingModes={isLoadingModes}
//         fileInputRef={fileInputRef}
//         sliders={sliders}
//         inputSignal={inputSignal}
//         apiSignal={apiSignal}
//         onModeChange={handleModeChange}
//         onFileUpload={handleFileUpload}
//         onReloadConfig={reloadConfigFromBackend}
//         onResetDefaults={handleRefreshModeConfigs}
//         onLoadSettings={handleLoadSettingsFromFile}
//         onToast={showToast}
//       />

//       {showSliderModal && (
//         <SliderCreationModal
//           onCreate={(newSlider) => {
//             setSliders([...sliders, newSlider]);
//             setShowSliderModal(false);
//           }}
//           onCancel={() => setShowSliderModal(false)}
//         />
//       )}

//       <div className="compact-container">
//         {/* LEFT COLUMN: Sliders */}
//         <div className="compact-sliders-section">
//           <div className="section-header-compact">
//             <h3>🎛️ {modeConfigs?.[currentMode]?.name || "Equalizer"}</h3>
//             {allSlidersAtUnity() && <span className="unity-badge-compact">✓</span>}
//           </div>
          
//           <div className="sliders-grid-compact">
//             {sliders.map((slider) => (
//               <div key={slider.id} className="slider-compact">
//                 <div className="slider-header-compact">
//                   <span className="slider-label-text">{slider.label}</span>
//                   <span className="slider-value-text">{slider.value.toFixed(2)}</span>
//                 </div>
//                 <input
//                   type="range"
//                   min={slider.min}
//                   max={slider.max}
//                   step="0.01"
//                   value={slider.value}
//                   onChange={(e) => handleSliderChange(slider.id, parseFloat(e.target.value))}
//                   className="slider-range-compact"
//                 />
//                 <div className="slider-freq-text">
//                   {slider.freqRanges?.map((range, idx) => (
//                     <span key={idx}>{range[0]}-{range[1]}Hz</span>
//                   ))}
//                 </div>
//               </div>
//             ))}
//           </div>

//           {canAddCustomSliders() && (
//             <button className="add-slider-compact" onClick={() => setShowSliderModal(true)}>
//               ➕ Add
//             </button>
//           )}
//         </div>

//         {/* RIGHT COLUMN: All Visualizations */}
//         <div className="compact-viz-section">
//           {/* Cine Controls */}
//           <div className="cine-controls-compact">
//             <button onClick={handlePlay} disabled={isPlaying || !inputSignal} className="ctrl-btn">▶</button>
//             <button onClick={handlePause} disabled={!isPlaying} className="ctrl-btn">⏸</button>
//             <button onClick={handleStop} disabled={!inputSignal} className="ctrl-btn">⏹</button>
//             <span className="time-display-compact">
//               {currentTime.toFixed(1)}s / {inputSignal?.duration.toFixed(1) || '0'}s
//             </span>
//             <input
//               type="range"
//               min="0.1"
//               max="2"
//               step="0.1"
//               value={playbackSpeed}
//               onChange={handleSpeedChange}
//               className="speed-slider-compact"
//               disabled={!inputSignal}
//             />
//             <span className="speed-text-compact">{playbackSpeed.toFixed(1)}x</span>
//             <button onClick={() => setZoom(Math.min(zoom * 1.5, 50))} className="ctrl-btn" disabled={!inputSignal}>🔍+</button>
//             <button onClick={() => setZoom(Math.max(zoom / 1.5, 1))} className="ctrl-btn" disabled={!inputSignal}>🔍-</button>
//             <button onClick={() => { setZoom(1); setPan(0); }} className="ctrl-btn" disabled={!inputSignal}>🔄</button>
//           </div>

//           {/* Waveforms */}
//           <div className="viz-row-compact">
//             <div className="viz-item-compact">
//               <canvas ref={inputWaveCanvasRef} width={400} height={120} className="viz-canvas-compact" />
//             </div>
//             <div className="viz-item-compact">
//               <canvas ref={outputWaveCanvasRef} width={400} height={120} className="viz-canvas-compact" />
//             </div>
//           </div>

//           {/* FFT */}
//           <div className="viz-row-compact">
//             <div className="viz-item-compact">
//               <canvas ref={inputFFTCanvasRef} width={400} height={120} className="viz-canvas-compact" />
//             </div>
//             <div className="viz-item-compact">
//               <canvas ref={outputFFTCanvasRef} width={400} height={120} className="viz-canvas-compact" />
//             </div>
//           </div>

//           {/* Spectrograms */}
//           <div className="viz-row-compact">
//             <div className="viz-item-compact">
//               <canvas ref={inputSpectrogramCanvasRef} width={400} height={120} className="viz-canvas-compact" />
//             </div>
//             <div className="viz-item-compact">
//               <canvas ref={outputSpectrogramCanvasRef} width={400} height={120} className="viz-canvas-compact" />
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default MainPageCompact;