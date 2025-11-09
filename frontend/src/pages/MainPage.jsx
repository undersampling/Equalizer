// import React, { useState, useRef, useEffect, useCallback } from "react";
// import EqualizerSlider from "../components/EqualizerSlider";
// import SliderCreationModal from "../components/SliderCreationModal";
// import SignalViewer from "../components/SignalViewer";
// import Spectrogram from "../components/Spectrogram";
// import FourierGraph from "../components/FourierGraph";
// import AIModelSection from "../components/AIModelSection";
// import UnifiedMusicController from "../components/UnifiedMusicController";
// import LinkedSignalViewers from "../components/LinkedSignalViewers";
// import {
//   getAllModeConfigs,
//   getModeConfig,
//   clearCache,
//   getFallbackConfig,
//   allowsCustomSliders,
//   autoSyncSliders,
// } from "../utils/modeConfigs";
// import { downsampleSignal, limitSignalSize } from "../utils/audioUtils";
// import {
//   saveSettings,
//   loadSettings,
//   importSettings,
//   exportSettings,
//   validateSettings,
//   clearSettings,
// } from "../utils/settingsManager";

// function MainPage() {
//   // Toast notification state
//   const [toast, setToast] = useState({
//     message: "",
//     type: "success",
//     visible: false,
//   });

//   // Export modal state
//   const [showExportModal, setShowExportModal] = useState(false);
//   const [exportPresetName, setExportPresetName] = useState("");

//   // Toast helper function
//   const showToast = (message, type = "success") => {
//     setToast({
//       message,
//       type,
//       visible: true,
//     });

//     setTimeout(() => {
//       setToast((prev) => ({ ...prev, visible: false }));
//     }, 3000);
//   };

//   const [currentMode, setCurrentMode] = useState("generic");
//   const [sliders, setSliders] = useState([]);
//   const [modeConfigs, setModeConfigs] = useState(null);
//   const [isLoadingModes, setIsLoadingModes] = useState(true);
//   const [modeLoadError, setModeLoadError] = useState(null);

//   const [inputSignal, setInputSignal] = useState(null);
//   const [outputSignal, setOutputSignal] = useState(null);
//   const [apiSignal, setApiSignal] = useState(null);
//   const [aiModelSignal, setAiModelSignal] = useState(null);
//   const [inputFourierData, setInputFourierData] = useState(null);
//   const [outputFourierData, setOutputFourierData] = useState(null);
//   const [aiModelFourierData, setAiModelFourierData] = useState(null);
//   const [isAIMode, setIsAIMode] = useState(false);
//   const [aiStems, setAiStems] = useState(null);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isPaused, setIsPaused] = useState(false);
//   const [playbackSpeed, setPlaybackSpeed] = useState(1);
//   const [currentTime, setCurrentTime] = useState(0);
//   const [showSpectrograms, setShowSpectrograms] = useState(true);
//   const [fftScale, setFftScale] = useState("linear");
//   const [zoom, setZoom] = useState(1);
//   const [pan, setPan] = useState(0);
//   const [showSliderModal, setShowSliderModal] = useState(false);
//   const [comparisonMode, setComparisonMode] = useState(null);
//   const [showAIGraphs, setShowAIGraphs] = useState(false);
//   const [fftError, setFftError] = useState(null);
//   const [isLoadingFFT, setIsLoadingFFT] = useState(false);

//   const fileInputRef = useRef(null);
//   const audioContextRef = useRef(null);
//   const equalizationTimeoutRef = useRef(null);
//   const fftTimeoutRef = useRef(null);
//   const backendSyncTimeoutRef = useRef(null);
//   const isProcessingRef = useRef(false);
//   const slidersRef = useRef(sliders);

//   const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

//   const isAIModeEnabled = currentMode === "musical" || currentMode === "human";

//   // Load mode configurations on mount
//   useEffect(() => {
//     const loadModeConfigs = async () => {
//       setIsLoadingModes(true);
//       setModeLoadError(null);

//       try {
//         console.log("Loading mode configurations from backend modes.json...");
//         const configs = await getAllModeConfigs(API_BASE_URL);

//         if (!configs || Object.keys(configs).length === 0) {
//           throw new Error("No mode configurations received from backend");
//         }

//         console.log(
//           "✅ Mode configs loaded from backend:",
//           Object.keys(configs)
//         );
//         setModeConfigs(configs);

//         if (configs[currentMode]) {
//           setSliders(configs[currentMode].sliders);
//           slidersRef.current = configs[currentMode].sliders;
//           console.log(`✅ Initialized ${currentMode} from backend modes.json`);
//         }
//       } catch (error) {
//         console.error("❌ Failed to load mode configs:", error);
//         setModeLoadError(error.message);

//         const fallback = getFallbackConfig(currentMode);
//         console.warn("⚠️ Using minimal fallback configuration");
//         setSliders(fallback.sliders);
//         slidersRef.current = fallback.sliders;

//         showToast(`Failed to connect to backend`, "error");
//       } finally {
//         setIsLoadingModes(false);
//       }
//     };

//     loadModeConfigs();
//   }, [API_BASE_URL]);

//   useEffect(() => {
//     slidersRef.current = sliders;
//   }, [sliders]);

//   // AUTO-SAVE: localStorage + Backend Sync
//   useEffect(() => {
//     const saveTimeout = setTimeout(() => {
//       if (sliders && sliders.length > 0) {
//         saveSettings(currentMode, sliders);
//         console.log(`✅ Auto-saved to localStorage: ${currentMode}`);

//         if (backendSyncTimeoutRef.current) {
//           clearTimeout(backendSyncTimeoutRef.current);
//         }

//         backendSyncTimeoutRef.current = setTimeout(async () => {
//           try {
//             const success = await autoSyncSliders(
//               currentMode,
//               sliders,
//               API_BASE_URL
//             );
//             if (success) {
//               console.log(
//                 `✅ Auto-synced to backend modes.json: ${currentMode}`
//               );
//             }
//           } catch (error) {
//             console.warn(
//               `⚠️ Backend sync failed (continuing offline):`,
//               error.message
//             );
//           }
//         }, 2000);
//       }
//     }, 500);

//     return () => {
//       clearTimeout(saveTimeout);
//       if (backendSyncTimeoutRef.current) {
//         clearTimeout(backendSyncTimeoutRef.current);
//       }
//     };
//   }, [sliders, currentMode, API_BASE_URL]);

//   // Recompute FFT when scale changes
//   useEffect(() => {
//     if (apiSignal) {
//       computeFourierTransform(apiSignal, "input");
//     }
//     if (outputSignal && apiSignal) {
//       computeFourierTransform(apiSignal, "output");
//     }
//     if (aiModelSignal) {
//       computeFourierTransform(aiModelSignal, "ai");
//     }
//   }, [fftScale]);

//   // Cleanup timeouts on unmount
//   useEffect(() => {
//     return () => {
//       if (equalizationTimeoutRef.current) {
//         clearTimeout(equalizationTimeoutRef.current);
//       }
//       if (fftTimeoutRef.current) {
//         clearTimeout(fftTimeoutRef.current);
//       }
//       if (backendSyncTimeoutRef.current) {
//         clearTimeout(backendSyncTimeoutRef.current);
//       }
//     };
//   }, []);

//   // Handle mode change
//   const handleModeChange = async (e) => {
//     const newMode = e.target.value;
//     setCurrentMode(newMode);

//     try {
//       const savedSettings = loadSettings(newMode);

//       if (savedSettings && savedSettings.sliders) {
//         console.log(`Switching to ${newMode} mode - loaded saved settings`);
//         setSliders(savedSettings.sliders);
//         slidersRef.current = savedSettings.sliders;
//       } else if (modeConfigs && modeConfigs[newMode]) {
//         console.log(`Switching to ${newMode} mode - using backend config`);
//         setSliders(modeConfigs[newMode].sliders);
//         slidersRef.current = modeConfigs[newMode].sliders;
//       } else {
//         console.log(`Fetching fresh config for ${newMode} mode`);
//         const config = await getModeConfig(newMode, API_BASE_URL);
//         setSliders(config.sliders);
//         slidersRef.current = config.sliders;
//       }

//       setAiModelSignal(null);
//       setAiModelFourierData(null);
//       setComparisonMode(null);
//       setShowAIGraphs(false);

//       if (inputSignal && apiSignal) {
//         setTimeout(() => applyEqualization(), 100);
//       }
//     } catch (error) {
//       console.error(`Failed to load config for ${newMode}:`, error);

//       const fallback = getFallbackConfig(newMode);
//       setSliders(fallback.sliders);
//       slidersRef.current = fallback.sliders;
//     }
//   };

//   const reloadConfigFromBackend = async () => {
//     setIsLoadingModes(true);
//     try {
//       console.log("🔄 Reloading config from modes.json...");
//       clearCache();

//       const configs = await getAllModeConfigs(API_BASE_URL, true);

//       if (!configs || Object.keys(configs).length === 0) {
//         throw new Error("No mode configurations received from backend");
//       }

//       setModeConfigs(configs);

//       if (configs[currentMode]) {
//         setSliders(configs[currentMode].sliders);
//         slidersRef.current = configs[currentMode].sliders;
//         console.log(`✅ Reloaded ${currentMode} mode from backend`);

//         if (inputSignal && apiSignal) {
//           setTimeout(() => applyEqualization(), 100);
//         }
//       }

//       showToast("✅ Configuration reloaded successfully", "success");
//     } catch (error) {
//       console.error("Failed to reload config:", error);
//       showToast(`❌ Failed to reload: ${error.message}`, "error");
//     } finally {
//       setIsLoadingModes(false);
//     }
//   };

//   const handleRefreshModeConfigs = async () => {
//     clearCache();
//     setIsLoadingModes(true);
//     setModeLoadError(null);

//     showToast("🔄 Resetting to default configuration...", "info");

//     try {
//       console.log("Resetting to default configuration...");

//       const resetResponse = await fetch(`${API_BASE_URL}/api/modes/reset`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//       });

//       if (!resetResponse.ok) {
//         throw new Error("Failed to reset backend configuration");
//       }

//       const resetResult = await resetResponse.json();
//       console.log("Backend reset successful:", resetResult);

//       const modes = ["generic", "musical", "animal", "human"];
//       modes.forEach((mode) => {
//         clearSettings(mode);
//       });
//       console.log("✅ Cleared all localStorage settings");

//       const configs = await getAllModeConfigs(API_BASE_URL, true);
//       setModeConfigs(configs);

//       if (configs[currentMode]) {
//         setSliders(configs[currentMode].sliders);
//         slidersRef.current = configs[currentMode].sliders;
//         console.log(`✅ Reset ${currentMode} mode to defaults`);
//       }

//       showToast("✅ All modes reset to default configuration", "success");

//       if (inputSignal && apiSignal) {
//         setTimeout(() => applyEqualization(), 100);
//       }
//     } catch (error) {
//       console.error("Failed to reset mode configs:", error);
//       setModeLoadError(error.message);
//       showToast(`❌ Reset failed: ${error.message}`, "error");
//     } finally {
//       setIsLoadingModes(false);
//     }
//   };

//   const handleAIToggle = (enabled, stems) => {
//     setIsAIMode(enabled);
//     setAiStems(stems);

//     if (enabled && stems) {
//       applyAIMixing();
//     } else {
//       applyEqualization();
//     }
//   };

//   const applyAIMixing = useCallback(async () => {
//     if (!inputSignal || !aiStems) return;

//     if (isProcessingRef.current) return;
//     isProcessingRef.current = true;

//     try {
//       const currentSliders = slidersRef.current;

//       const stemsWithGains = {};
//       currentSliders.forEach((slider) => {
//         const stemName = slider.aiStem;
//         if (stemName && aiStems[stemName]) {
//           stemsWithGains[stemName] = {
//             data: aiStems[stemName].data,
//             gain: slider.value,
//           };
//         }
//       });

//       const response = await fetch(`${API_BASE_URL}/api/music/mix`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           stems: stemsWithGains,
//           sampleRate: inputSignal.sampleRate,
//         }),
//       });

//       if (!response.ok) {
//         throw new Error("Failed to mix AI stems");
//       }

//       const result = await response.json();

//       const newOutputSignal = {
//         data: result.mixedSignal,
//         sampleRate: result.sampleRate,
//         duration: inputSignal.duration,
//       };

//       setOutputSignal(newOutputSignal);
//       setAiModelSignal(newOutputSignal);
//       setShowAIGraphs(true);

//       if (fftTimeoutRef.current) {
//         clearTimeout(fftTimeoutRef.current);
//       }

//       fftTimeoutRef.current = setTimeout(() => {
//         computeFourierTransform(newOutputSignal, "output");
//         computeFourierTransform(newOutputSignal, "ai");
//       }, 200);
//     } catch (error) {
//       console.error("Error applying AI mixing:", error);
//       showToast("❌ AI mixing failed", "error");
//     } finally {
//       isProcessingRef.current = false;
//     }
//   }, [inputSignal, aiStems, API_BASE_URL]);

//   const handleFileUpload = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = async (event) => {
//       try {
//         if (!audioContextRef.current) {
//           audioContextRef.current = new (window.AudioContext ||
//             window.webkitAudioContext)();
//         }

//         const arrayBuffer = event.target.result;
//         const audioBuffer = await audioContextRef.current.decodeAudioData(
//           arrayBuffer
//         );

//         const channelData = audioBuffer.getChannelData(0);

//         const originalSignal = {
//           data: Array.from(channelData),
//           sampleRate: audioBuffer.sampleRate,
//           duration: audioBuffer.duration,
//         };

//         const downsampled = downsampleSignal(
//           channelData,
//           audioBuffer.sampleRate,
//           16000,
//           100000
//         );

//         const apiSignal = {
//           data: downsampled.data,
//           sampleRate: downsampled.sampleRate,
//           duration: audioBuffer.duration,
//         };

//         setInputSignal(originalSignal);
//         setOutputSignal(originalSignal);
//         setApiSignal(apiSignal);
//         setCurrentTime(0);
//         setAiModelSignal(null);
//         setAiModelFourierData(null);
//         setComparisonMode(null);
//         setShowAIGraphs(false);

//         computeFourierTransform(apiSignal, "input");
//         computeFourierTransform(apiSignal, "output");

//         showToast("✅ Audio file loaded successfully", "success");
//       } catch (error) {
//         console.error("Error loading audio file:", error);
//         showToast(
//           "❌ Error loading file. Please try a different audio file.",
//           "error"
//         );
//       }
//     };
//     reader.readAsArrayBuffer(file);
//   };

//   const computeFourierTransform = async (signal, type) => {
//     if (!signal || !signal.data || signal.data.length === 0) {
//       console.warn("No signal data to compute FFT");
//       setFftError(null);
//       return;
//     }

//     const limitedSignal = limitSignalSize(signal.data, 100000);

//     if (limitedSignal.length === 0) {
//       console.warn("Signal is empty after limiting");
//       setFftError("Signal is too large or empty");
//       setIsLoadingFFT(false);
//       return;
//     }

//     setIsLoadingFFT(true);
//     setFftError(null);

//     try {
//       const requestBody = {
//         signal: limitedSignal,
//         sampleRate: signal.sampleRate,
//         scale: fftScale,
//       };

//       const requestSize = JSON.stringify(requestBody).length;
//       if (requestSize > 50 * 1024 * 1024) {
//         throw new Error(
//           "Signal is too large to process. Please use a shorter audio file."
//         );
//       }

//       const response = await fetch(`${API_BASE_URL}/api/fft`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(requestBody),
//       });

//       if (!response.ok) {
//         let errorMessage = `HTTP error! status: ${response.status}`;
//         try {
//           const errorData = await response.json();
//           errorMessage = errorData.error || errorMessage;
//         } catch (e) {
//           errorMessage = `${response.status}: ${response.statusText}`;
//         }
//         throw new Error(errorMessage);
//       }

//       const result = await response.json();

//       if (!result.frequencies || !result.magnitudes) {
//         console.error("Invalid FFT response format:", result);
//         throw new Error("Invalid response format from FFT API");
//       }

//       if (result.frequencies.length === 0 || result.magnitudes.length === 0) {
//         console.warn("FFT returned empty arrays");
//         setFftError("FFT returned empty arrays");
//         setIsLoadingFFT(false);
//         return;
//       }

//       console.log(`FFT computed for ${type} with ${fftScale} scale:`, {
//         frequencies: result.frequencies.length,
//         magnitudes: result.magnitudes.length,
//       });

//       try {
//         if (type === "input") {
//           setInputFourierData(result);
//         } else if (type === "output") {
//           setOutputFourierData(result);
//         } else if (type === "ai") {
//           setAiModelFourierData(result);
//         }
//         setIsLoadingFFT(false);
//         setFftError(null);
//       } catch (stateError) {
//         console.error("Error updating FFT state:", stateError);
//         setIsLoadingFFT(false);
//         setFftError("Failed to display FFT data. Data may be too large.");
//       }
//     } catch (error) {
//       console.error("Error computing FFT:", error);
//       setIsLoadingFFT(false);
//       const errorMsg =
//         error.message ||
//         "Failed to fetch FFT data. Make sure the backend is running on " +
//           API_BASE_URL;
//       setFftError(errorMsg);

//       if (type === "input") {
//         setInputFourierData(null);
//       } else if (type === "output") {
//         setOutputFourierData(null);
//       } else if (type === "ai") {
//         setAiModelFourierData(null);
//       }
//     }
//   };

//   const handleSliderChange = (sliderId, newValue) => {
//     setSliders((prev) =>
//       prev.map((slider) =>
//         slider.id === sliderId ? { ...slider, value: newValue } : slider
//       )
//     );

//     if (inputSignal && apiSignal) {
//       if (equalizationTimeoutRef.current) {
//         clearTimeout(equalizationTimeoutRef.current);
//       }

//       equalizationTimeoutRef.current = setTimeout(() => {
//         if (isAIMode && aiStems) {
//           applyAIMixing();
//         } else {
//           applyEqualization();
//         }
//       }, 150);
//     }
//   };

//   const applyEqualization = useCallback(async () => {
//     if (!inputSignal || !apiSignal) return;

//     if (isProcessingRef.current) {
//       return;
//     }

//     isProcessingRef.current = true;

//     try {
//       const currentSliders = slidersRef.current;

//       const response = await fetch(`${API_BASE_URL}/api/equalize`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           signal: apiSignal.data,
//           sampleRate: apiSignal.sampleRate,
//           sliders: currentSliders,
//           mode: currentMode,
//         }),
//       });

//       if (!response.ok) {
//         let errorMessage = `HTTP error! status: ${response.status}`;
//         try {
//           const errorData = await response.json();
//           errorMessage = errorData.error || errorMessage;
//         } catch (e) {
//           errorMessage = `${response.status}: ${response.statusText}`;
//         }
//         throw new Error(errorMessage);
//       }

//       const result = await response.json();

//       if (!result.outputSignal || !Array.isArray(result.outputSignal)) {
//         throw new Error("Invalid response from equalization API");
//       }

//       const newOutputApiSignal = {
//         data: result.outputSignal,
//         sampleRate: result.sampleRate || apiSignal.sampleRate,
//         duration: inputSignal.duration,
//       };

//       setOutputSignal({
//         data: result.outputSignal,
//         sampleRate: result.sampleRate || apiSignal.sampleRate,
//         duration: inputSignal.duration,
//       });

//       if (fftTimeoutRef.current) {
//         clearTimeout(fftTimeoutRef.current);
//       }

//       fftTimeoutRef.current = setTimeout(() => {
//         computeFourierTransform(newOutputApiSignal, "output");
//       }, 200);
//     } catch (error) {
//       console.error("Error applying equalization:", error);
//       showToast("❌ Equalization failed", "error");
//     } finally {
//       isProcessingRef.current = false;
//     }
//   }, [inputSignal, apiSignal, currentMode, API_BASE_URL]);

//   const handleAddSlider = () => {
//     const currentConfig = modeConfigs?.[currentMode];
//     if (currentConfig && !allowsCustomSliders(currentConfig)) {
//       showToast(`${currentConfig.name} does not allow custom sliders.`, "info");
//       return;
//     }
//     setShowSliderModal(true);
//   };

//   const handleCreateSlider = (newSlider) => {
//     setSliders([...sliders, newSlider]);
//     setShowSliderModal(false);
//     if (equalizationTimeoutRef.current) {
//       clearTimeout(equalizationTimeoutRef.current);
//     }
//     equalizationTimeoutRef.current = setTimeout(() => {
//       applyEqualization();
//     }, 100);
//   };

//   const handleRemoveSlider = (sliderId) => {
//     setSliders((prev) => prev.filter((s) => s.id !== sliderId));
//     if (equalizationTimeoutRef.current) {
//       clearTimeout(equalizationTimeoutRef.current);
//     }
//     equalizationTimeoutRef.current = setTimeout(() => {
//       applyEqualization();
//     }, 100);
//   };

//   const handlePlay = () => {
//     setIsPlaying(true);
//     setIsPaused(false);
//   };

//   const handlePause = () => {
//     setIsPaused(true);
//     setIsPlaying(false);
//   };

//   const handleStop = () => {
//     setIsPlaying(false);
//     setIsPaused(false);
//     setCurrentTime(0);
//   };

//   const handleSpeedChange = (e) => {
//     setPlaybackSpeed(parseFloat(e.target.value));
//   };

//   const handleZoomIn = () => {
//     setZoom((prev) => Math.min(prev * 1.5, 10));
//   };

//   const handleZoomOut = () => {
//     setZoom((prev) => Math.max(prev / 1.5, 0.5));
//   };

//   const handleReset = () => {
//     setZoom(1);
//     setPan(0);
//     setCurrentTime(0);
//   };

//   const handlePlayInputAudio = () => {
//     if (inputSignal) {
//       playAudio(inputSignal);
//     }
//   };

//   const handlePlayOutputAudio = () => {
//     if (outputSignal) {
//       playAudio(outputSignal);
//     }
//   };

//   const handlePlayAIAudio = () => {
//     if (aiModelSignal) {
//       playAudio(aiModelSignal);
//     }
//   };

//   const playAudio = (signal) => {
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
//     source.start();
//   };

//   // Export with custom modal
//   const handleSaveSettings = () => {
//     setShowExportModal(true);
//   };

//   const handleExportConfirm = () => {
//     // Generate meaningful filename based on mode and date
//     const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
//     const defaultName = `${currentMode}-preset-${timestamp}`;
//     const finalName = exportPresetName.trim() || defaultName;

//     exportSettings(currentMode, sliders, finalName);
//     showToast(`✅ Settings exported as "${finalName}"`, "success");

//     setShowExportModal(false);
//     setExportPresetName("");
//   };

//   const handleLoadSettings = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     try {
//       const settings = await importSettings(file);

//       if (!validateSettings(settings)) {
//         showToast("❌ Invalid settings file format", "error");
//         return;
//       }

//       setCurrentMode(settings.mode);
//       setSliders(settings.sliders);
//       slidersRef.current = settings.sliders;

//       saveSettings(settings.mode, settings.sliders);

//       if (inputSignal && apiSignal) {
//         setTimeout(() => applyEqualization(), 100);
//       }

//       showToast("✅ Settings loaded successfully", "success");
//     } catch (error) {
//       console.error("Error loading settings:", error);
//       showToast(`❌ Failed to load settings: ${error.message}`, "error");
//     }
//   };

//   const handleAIModelResult = (aiSignal) => {
//     setAiModelSignal(aiSignal);
//     setShowAIGraphs(true);
//     setComparisonMode(null);

//     if (aiSignal.fourierData) {
//       setAiModelFourierData(aiSignal.fourierData);
//     } else {
//       computeFourierTransform(aiSignal, "ai");
//     }
//   };

//   const handleComparisonChange = (mode) => {
//     setComparisonMode(mode);
//   };

//   const getGridColumns = () => {
//     if (comparisonMode) {
//       return "1fr 1fr";
//     }
//     if (showAIGraphs && aiModelSignal) {
//       return "repeat(3, 1fr)";
//     }
//     return "1fr 1fr";
//   };

//   const canAddCustomSliders = () => {
//     if (!modeConfigs || !modeConfigs[currentMode]) return false;
//     return allowsCustomSliders(modeConfigs[currentMode]);
//   };

//   const allSlidersAtUnity = () => {
//     if (!sliders || sliders.length === 0) return true;
//     return sliders.every((slider) => Math.abs(slider.value - 1.0) < 0.0001);
//   };

//   return (
//     <div className="App">
//       {/* Toast Notification */}
//       {toast.visible && (
//         <div className={`toast toast-${toast.type}`}>{toast.message}</div>
//       )}

//       {/* Export Modal */}
//       {showExportModal && (
//         <div
//           className="modal-overlay"
//           onClick={() => setShowExportModal(false)}
//         >
//           <div className="export-modal" onClick={(e) => e.stopPropagation()}>
//             <h3>💾 Export Settings</h3>
//             <p>Enter a preset name (optional):</p>
//             <input
//               type="text"
//               className="export-input"
//               placeholder={`${currentMode}-preset-${
//                 new Date().toISOString().split("T")[0]
//               }`}
//               value={exportPresetName}
//               onChange={(e) => setExportPresetName(e.target.value)}
//               onKeyDown={(e) => {
//                 if (e.key === "Enter") handleExportConfirm();
//                 if (e.key === "Escape") setShowExportModal(false);
//               }}
//               autoFocus
//             />
//             <div className="export-buttons">
//               <button className="btn btn-primary" onClick={handleExportConfirm}>
//                 💾 Export
//               </button>
//               <button
//                 className="btn btn-secondary"
//                 onClick={() => {
//                   setShowExportModal(false);
//                   setExportPresetName("");
//                 }}
//               >
//                 ✖ Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <header className="header">
//         <div className="header-content">
//           <div className="header-left">
//             <h1>🎵 Signal Equalizer</h1>

//             {isLoadingModes ? (
//               <div className="mode-loading">⏳ Loading modes...</div>
//             ) : (
//               <div className="mode-selector-container">
//                 <select
//                   className="mode-selector"
//                   value={currentMode}
//                   onChange={handleModeChange}
//                   disabled={isLoadingModes}
//                 >
//                   <option value="generic">⚙️ Generic Mode</option>
//                   <option value="musical">🎵 Musical Instruments</option>
//                   <option value="animal">🐾 Animal Sounds</option>
//                   <option value="human">👤 Human Voices</option>
//                 </select>
//               </div>
//             )}
//           </div>

//           <div className="header-buttons">
//             <button
//               className="btn btn-secondary"
//               onClick={() => fileInputRef.current.click()}
//             >
//               📁 Load Signal
//             </button>
//             <input
//               type="file"
//               ref={fileInputRef}
//               className="file-input"
//               accept="audio/*,.wav,.mp3"
//               onChange={handleFileUpload}
//             />

//             <button
//               className="btn btn-secondary"
//               onClick={reloadConfigFromBackend}
//               disabled={isLoadingModes}
//               title="Reload configuration from modes.json file"
//             >
//               🔄 Reload from JSON
//             </button>

//             <button
//               className="btn btn-secondary"
//               onClick={handleRefreshModeConfigs}
//               disabled={isLoadingModes}
//               title="Reset all modes to default configuration"
//             >
//               🔄 Reset to Defaults
//             </button>

//             <button className="btn btn-secondary" onClick={handleSaveSettings}>
//               💾 Export Settings
//             </button>

//             <button
//               className="btn btn-secondary"
//               onClick={() => document.getElementById("loadSettings").click()}
//             >
//               📂 Import Settings
//             </button>
//             <input
//               id="loadSettings"
//               type="file"
//               className="file-input"
//               accept=".json"
//               onChange={handleLoadSettings}
//             />
//           </div>
//         </div>
//       </header>

//       {showSliderModal && (
//         <SliderCreationModal
//           onCreate={handleCreateSlider}
//           onCancel={() => setShowSliderModal(false)}
//         />
//       )}

//       <div className="main-container">
//         {isAIModeEnabled && (
//           <AIModelSection
//             mode={currentMode}
//             inputSignal={inputSignal}
//             sliderOutputSignal={outputSignal}
//             inputFourierData={inputFourierData}
//             sliderFourierData={outputFourierData}
//             onModelResult={handleAIModelResult}
//             onComparisonChange={handleComparisonChange}
//           />
//         )}
//         {currentMode === "musical" && (
//           <UnifiedMusicController
//             inputSignal={inputSignal}
//             sliders={sliders}
//             onSliderChange={handleSliderChange}
//             onAIToggle={handleAIToggle}
//             isAIEnabled={isAIMode}
//           />
//         )}

//         <section className="section">
//           <div
//             style={{
//               display: "flex",
//               justifyContent: "space-between",
//               alignItems: "center",
//             }}
//           >
//             <h2 className="section-title">
//               {modeConfigs?.[currentMode]?.icon || "⚙️"} Equalizer -{" "}
//               {modeConfigs?.[currentMode]?.name || "Unknown Mode"}
//             </h2>

//             {currentMode === "musical" && inputSignal && (
//               <button
//                 className={`btn ${isAIMode ? "btn-primary" : "btn-secondary"}`}
//                 onClick={() => {
//                   const newMode = !isAIMode;
//                   setIsAIMode(newMode);
//                   handleAIToggle(newMode, aiStems);
//                 }}
//                 style={{
//                   background: isAIMode
//                     ? "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
//                     : undefined,
//                 }}
//               >
//                 {isAIMode ? "🤖 AI Mode (ON)" : "🎛️ Switch to AI Mode"}
//               </button>
//             )}
//           </div>

//           {modeConfigs?.[currentMode]?.description && (
//             <p className="mode-description">
//               {modeConfigs[currentMode].description}
//               {currentMode === "musical" && (
//                 <span
//                   style={{
//                     display: "block",
//                     marginTop: "8px",
//                     fontStyle: "italic",
//                     opacity: 0.9,
//                   }}
//                 >
//                   {isAIMode
//                     ? "🤖 Using AI stem separation - sliders control individual instruments"
//                     : "🎛️ Using frequency-based equalization"}
//                 </span>
//               )}
//             </p>
//           )}

//           <div className="equalizer-sliders">
//             {sliders.map((slider) => (
//               <EqualizerSlider
//                 key={slider.id}
//                 slider={slider}
//                 onChange={handleSliderChange}
//                 onRemove={canAddCustomSliders() ? handleRemoveSlider : null}
//               />
//             ))}
//           </div>

//           {canAddCustomSliders() && (
//             <button className="add-slider-btn" onClick={handleAddSlider}>
//               ➕ Add Custom Slider
//             </button>
//           )}
//         </section>

//         <LinkedSignalViewers
//           inputSignal={inputSignal}
//           outputSignal={outputSignal}
//           aiModelSignal={aiModelSignal}
//           showAIViewer={aiStems && aiModelSignal}
//         />

//         <div
//           className="audio-buttons"
//           style={{
//             gridTemplateColumns:
//               aiStems && aiModelSignal ? "1fr 1fr 1fr" : "1fr 1fr",
//           }}
//         >
//           <button className="audio-btn" onClick={handlePlayInputAudio}>
//             🔊 Play Input Audio
//           </button>
//           <button className="audio-btn" onClick={handlePlayOutputAudio}>
//             🔊 Play Manual EQ Output
//           </button>
//           {aiStems && aiModelSignal && (
//             <button
//               className="audio-btn"
//               onClick={handlePlayAIAudio}
//               style={{
//                 background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
//               }}
//             >
//               🔊 Play AI Stems Output
//             </button>
//           )}
//         </div>

//         <section className="section">
//           <div className="fourier-section">
//             <h2 className="section-title">📊 Fourier Transform</h2>
//             <div className="scale-toggle">
//               <label>Scale:</label>
//               <select
//                 value={fftScale}
//                 onChange={(e) => setFftScale(e.target.value)}
//                 className="mode-selector"
//               >
//                 <option value="linear">Linear</option>
//                 <option value="audiogram">Audiogram</option>
//               </select>
//             </div>
//           </div>

//           <div
//             className="fourier-graphs-grid"
//             style={{
//               gridTemplateColumns: getGridColumns(),
//             }}
//           >
//             <FourierGraph
//               fourierData={inputFourierData}
//               scale={fftScale}
//               title="Input FFT (Original)"
//               isLoading={isLoadingFFT}
//               error={fftError}
//             />
//             {comparisonMode === "ai" && aiModelFourierData ? (
//               <FourierGraph
//                 fourierData={aiModelFourierData}
//                 scale={fftScale}
//                 title="AI Model FFT"
//                 isLoading={isLoadingFFT}
//                 error={fftError}
//               />
//             ) : comparisonMode === "slider" ? (
//               <FourierGraph
//                 fourierData={outputFourierData}
//                 scale={fftScale}
//                 title="Equalizer FFT"
//                 isLoading={isLoadingFFT}
//                 error={fftError}
//               />
//             ) : (
//               <>
//                 <FourierGraph
//                   fourierData={outputFourierData}
//                   scale={fftScale}
//                   title="Slider Output FFT"
//                   isLoading={isLoadingFFT}
//                   error={fftError}
//                 />
//                 {showAIGraphs && aiModelFourierData && (
//                   <FourierGraph
//                     fourierData={aiModelFourierData}
//                     scale={fftScale}
//                     title="AI Model FFT"
//                     isLoading={isLoadingFFT}
//                     error={fftError}
//                   />
//                 )}
//               </>
//             )}
//           </div>
//         </section>

//         <section className="spectrograms-controls">
//           <h2 className="section-title">📈 Spectrograms</h2>
//           <button
//             className={`toggle-btn ${showSpectrograms ? "active" : ""}`}
//             onClick={() => setShowSpectrograms(!showSpectrograms)}
//           >
//             {showSpectrograms ? "👁️ Hide" : "👁️ Show"}
//           </button>
//         </section>

//         {showSpectrograms && (
//           <div
//             className="spectrograms-grid"
//             style={{
//               gridTemplateColumns: getGridColumns(),
//             }}
//           >
//             <Spectrogram
//               signal={inputSignal}
//               title="Input Spectrogram (Original)"
//               visible={showSpectrograms}
//             />
//             {comparisonMode === "ai" && aiModelSignal ? (
//               <Spectrogram
//                 signal={aiModelSignal}
//                 title="AI Model Spectrogram"
//                 visible={showSpectrograms}
//               />
//             ) : comparisonMode === "slider" ? (
//               <Spectrogram
//                 signal={
//                   allSlidersAtUnity() && inputSignal
//                     ? inputSignal
//                     : outputSignal
//                 }
//                 title="Equalizer Spectrogram"
//                 visible={showSpectrograms}
//               />
//             ) : (
//               <>
//                 <Spectrogram
//                   signal={
//                     allSlidersAtUnity() && inputSignal
//                       ? inputSignal
//                       : outputSignal
//                   }
//                   title="Slider Output Spectrogram"
//                   visible={showSpectrograms}
//                 />
//                 {showAIGraphs && aiModelSignal && (
//                   <Spectrogram
//                     signal={aiModelSignal}
//                     title="AI Model Spectrogram"
//                     visible={showSpectrograms}
//                   />
//                 )}
//               </>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default MainPage;
import React, { useState, useRef, useEffect, useCallback } from "react";
import AppHeader from "../components/Header";
import EqualizerSlider from "../components/EqualizerSlider";
import SliderCreationModal from "../components/SliderCreationModal";
import Spectrogram from "../components/Spectrogram";
import FourierGraph from "../components/FourierGraph";
import AIModelSection from "../components/AIModelSection";
import UnifiedMusicController from "../components/UnifiedMusicController";
import LinkedSignalViewers from "../components/LinkedSignalViewers";
import {
  getAllModeConfigs,
  getModeConfig,
  clearCache,
  getFallbackConfig,
  allowsCustomSliders,
  autoSyncSliders,
} from "../utils/modeConfigs";
import { downsampleSignal, limitSignalSize } from "../utils/audioUtils";
import {
  saveSettings,
  loadSettings,
  clearSettings,
} from "../utils/settingsManager";

function MainPage() {
  // Toast notification state
  const [toast, setToast] = useState({
    message: "",
    type: "success",
    visible: false,
  });

  // Toast helper function
  const showToast = (message, type = "success") => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
  };

  const [currentMode, setCurrentMode] = useState("generic");
  const [sliders, setSliders] = useState([]);
  const [modeConfigs, setModeConfigs] = useState(null);
  const [isLoadingModes, setIsLoadingModes] = useState(true);
  const [modeLoadError, setModeLoadError] = useState(null);

  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);
  const [apiSignal, setApiSignal] = useState(null);
  const [aiModelSignal, setAiModelSignal] = useState(null);
  const [inputFourierData, setInputFourierData] = useState(null);
  const [outputFourierData, setOutputFourierData] = useState(null);
  const [aiModelFourierData, setAiModelFourierData] = useState(null);
  const [isAIMode, setIsAIMode] = useState(false);
  const [aiStems, setAiStems] = useState(null);
  const [showSpectrograms, setShowSpectrograms] = useState(true);
  const [fftScale, setFftScale] = useState("linear");
  const [showSliderModal, setShowSliderModal] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(null);
  const [showAIGraphs, setShowAIGraphs] = useState(false);
  const [fftError, setFftError] = useState(null);
  const [isLoadingFFT, setIsLoadingFFT] = useState(false);

  const fileInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const equalizationTimeoutRef = useRef(null);
  const fftTimeoutRef = useRef(null);
  const backendSyncTimeoutRef = useRef(null);
  const isProcessingRef = useRef(false);
  const slidersRef = useRef(sliders);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const isAIModeEnabled = currentMode === "musical" || currentMode === "human";

  // Load mode configurations on mount
  useEffect(() => {
    const loadModeConfigs = async () => {
      setIsLoadingModes(true);
      setModeLoadError(null);

      try {
        const configs = await getAllModeConfigs(API_BASE_URL);
        if (!configs || Object.keys(configs).length === 0) {
          throw new Error("No mode configurations received from backend");
        }

        setModeConfigs(configs);
        if (configs[currentMode]) {
          setSliders(configs[currentMode].sliders);
          slidersRef.current = configs[currentMode].sliders;
        }
      } catch (error) {
        console.error("❌ Failed to load mode configs:", error);
        setModeLoadError(error.message);
        const fallback = getFallbackConfig(currentMode);
        setSliders(fallback.sliders);
        slidersRef.current = fallback.sliders;
        showToast(`Failed to connect to backend`, "error");
      } finally {
        setIsLoadingModes(false);
      }
    };

    loadModeConfigs();
  }, [API_BASE_URL]);

  useEffect(() => {
    slidersRef.current = sliders;
  }, [sliders]);

  // AUTO-SAVE: localStorage + Backend Sync
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (sliders && sliders.length > 0) {
        saveSettings(currentMode, sliders);
        if (backendSyncTimeoutRef.current)
          clearTimeout(backendSyncTimeoutRef.current);

        backendSyncTimeoutRef.current = setTimeout(async () => {
          try {
            await autoSyncSliders(currentMode, sliders, API_BASE_URL);
          } catch (error) {
            console.warn("Backend sync failed:", error.message);
          }
        }, 2000);
      }
    }, 500);

    return () => {
      clearTimeout(saveTimeout);
      if (backendSyncTimeoutRef.current)
        clearTimeout(backendSyncTimeoutRef.current);
    };
  }, [sliders, currentMode, API_BASE_URL]);

  // Recompute FFT when scale changes
  useEffect(() => {
    if (apiSignal) computeFourierTransform(apiSignal, "input");
    if (outputSignal && apiSignal) computeFourierTransform(apiSignal, "output");
    if (aiModelSignal) computeFourierTransform(aiModelSignal, "ai");
  }, [fftScale]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (equalizationTimeoutRef.current)
        clearTimeout(equalizationTimeoutRef.current);
      if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
      if (backendSyncTimeoutRef.current)
        clearTimeout(backendSyncTimeoutRef.current);
    };
  }, []);

  // Handle mode change
  const handleModeChange = async (e) => {
    const newMode = e.target.value;
    setCurrentMode(newMode);

    try {
      const savedSettings = loadSettings(newMode);

      if (savedSettings && savedSettings.sliders) {
        setSliders(savedSettings.sliders);
        slidersRef.current = savedSettings.sliders;
      } else if (modeConfigs && modeConfigs[newMode]) {
        setSliders(modeConfigs[newMode].sliders);
        slidersRef.current = modeConfigs[newMode].sliders;
      } else {
        const config = await getModeConfig(newMode, API_BASE_URL);
        setSliders(config.sliders);
        slidersRef.current = config.sliders;
      }

      setAiModelSignal(null);
      setAiModelFourierData(null);
      setComparisonMode(null);
      setShowAIGraphs(false);

      if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
    } catch (error) {
      console.error(`Failed to load config for ${newMode}:`, error);
      const fallback = getFallbackConfig(newMode);
      setSliders(fallback.sliders);
      slidersRef.current = fallback.sliders;
    }
  };

  const reloadConfigFromBackend = async () => {
    setIsLoadingModes(true);
    try {
      clearCache();
      const configs = await getAllModeConfigs(API_BASE_URL, true);
      if (!configs || Object.keys(configs).length === 0) {
        throw new Error("No mode configurations received from backend");
      }

      setModeConfigs(configs);
      if (configs[currentMode]) {
        setSliders(configs[currentMode].sliders);
        slidersRef.current = configs[currentMode].sliders;
        if (inputSignal && apiSignal)
          setTimeout(() => applyEqualization(), 100);
      }

      showToast("✅ Configuration reloaded successfully", "success");
    } catch (error) {
      showToast(`❌ Failed to reload: ${error.message}`, "error");
    } finally {
      setIsLoadingModes(false);
    }
  };

  const handleRefreshModeConfigs = async () => {
    clearCache();
    setIsLoadingModes(true);
    showToast("🔄 Resetting to default configuration...", "info");

    try {
      const resetResponse = await fetch(`${API_BASE_URL}/api/modes/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!resetResponse.ok)
        throw new Error("Failed to reset backend configuration");

      ["generic", "musical", "animal", "human"].forEach((mode) =>
        clearSettings(mode)
      );

      const configs = await getAllModeConfigs(API_BASE_URL, true);
      setModeConfigs(configs);

      if (configs[currentMode]) {
        setSliders(configs[currentMode].sliders);
        slidersRef.current = configs[currentMode].sliders;
      }

      showToast("✅ All modes reset to default configuration", "success");
      if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
    } catch (error) {
      showToast(`❌ Reset failed: ${error.message}`, "error");
    } finally {
      setIsLoadingModes(false);
    }
  };

  const handleLoadSettingsFromFile = (settings) => {
    setCurrentMode(settings.mode);
    setSliders(settings.sliders);
    slidersRef.current = settings.sliders;
    saveSettings(settings.mode, settings.sliders);
    if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
  };

  const handleAIToggle = (enabled, stems) => {
    setIsAIMode(enabled);
    setAiStems(stems);
    if (enabled && stems) applyAIMixing();
    else applyEqualization();
  };

  const applyAIMixing = useCallback(async () => {
    if (!inputSignal || !aiStems || isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const stemsWithGains = {};
      slidersRef.current.forEach((slider) => {
        const stemName = slider.aiStem;
        if (stemName && aiStems[stemName]) {
          stemsWithGains[stemName] = {
            data: aiStems[stemName].data,
            gain: slider.value,
          };
        }
      });

      const response = await fetch(`${API_BASE_URL}/api/music/mix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stems: stemsWithGains,
          sampleRate: inputSignal.sampleRate,
        }),
      });

      if (!response.ok) throw new Error("Failed to mix AI stems");
      const result = await response.json();

      const newOutputSignal = {
        data: result.mixedSignal,
        sampleRate: result.sampleRate,
        duration: inputSignal.duration,
      };

      setOutputSignal(newOutputSignal);
      setAiModelSignal(newOutputSignal);
      setShowAIGraphs(true);

      if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
      fftTimeoutRef.current = setTimeout(() => {
        computeFourierTransform(newOutputSignal, "output");
        computeFourierTransform(newOutputSignal, "ai");
      }, 200);
    } catch (error) {
      showToast("❌ AI mixing failed", "error");
    } finally {
      isProcessingRef.current = false;
    }
  }, [inputSignal, aiStems, API_BASE_URL]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            window.webkitAudioContext)();
        }

        const arrayBuffer = event.target.result;
        const audioBuffer = await audioContextRef.current.decodeAudioData(
          arrayBuffer
        );
        const channelData = audioBuffer.getChannelData(0);

        const originalSignal = {
          data: Array.from(channelData),
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
        };

        const downsampled = downsampleSignal(
          channelData,
          audioBuffer.sampleRate,
          16000,
          100000
        );

        const apiSignal = {
          data: downsampled.data,
          sampleRate: downsampled.sampleRate,
          duration: audioBuffer.duration,
        };

        setInputSignal(originalSignal);
        setOutputSignal(originalSignal);
        setApiSignal(apiSignal);
        setAiModelSignal(null);
        setAiModelFourierData(null);
        setComparisonMode(null);
        setShowAIGraphs(false);

        computeFourierTransform(apiSignal, "input");
        computeFourierTransform(apiSignal, "output");

        showToast("✅ Audio file loaded successfully", "success");
      } catch (error) {
        showToast(
          "❌ Error loading file. Please try a different audio file.",
          "error"
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const computeFourierTransform = async (signal, type) => {
    if (!signal || !signal.data || signal.data.length === 0) return;

    const limitedSignal = limitSignalSize(signal.data, 100000);
    if (limitedSignal.length === 0) {
      setFftError("Signal is too large or empty");
      return;
    }

    setIsLoadingFFT(true);
    setFftError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/fft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: limitedSignal,
          sampleRate: signal.sampleRate,
          scale: fftScale,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      if (!result.frequencies || !result.magnitudes)
        throw new Error("Invalid response format from FFT API");

      if (type === "input") setInputFourierData(result);
      else if (type === "output") setOutputFourierData(result);
      else if (type === "ai") setAiModelFourierData(result);

      setIsLoadingFFT(false);
      setFftError(null);
    } catch (error) {
      setIsLoadingFFT(false);
      setFftError(error.message);
      if (type === "input") setInputFourierData(null);
      else if (type === "output") setOutputFourierData(null);
      else if (type === "ai") setAiModelFourierData(null);
    }
  };

  const handleSliderChange = (sliderId, newValue) => {
    setSliders((prev) =>
      prev.map((slider) =>
        slider.id === sliderId ? { ...slider, value: newValue } : slider
      )
    );

    if (inputSignal && apiSignal) {
      if (equalizationTimeoutRef.current)
        clearTimeout(equalizationTimeoutRef.current);
      equalizationTimeoutRef.current = setTimeout(() => {
        if (isAIMode && aiStems) applyAIMixing();
        else applyEqualization();
      }, 150);
    }
  };

  const applyEqualization = useCallback(async () => {
    if (!inputSignal || !apiSignal || isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const response = await fetch(`${API_BASE_URL}/api/equalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: apiSignal.data,
          sampleRate: apiSignal.sampleRate,
          sliders: slidersRef.current,
          mode: currentMode,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      if (!result.outputSignal || !Array.isArray(result.outputSignal)) {
        throw new Error("Invalid response from equalization API");
      }

      const newOutputApiSignal = {
        data: result.outputSignal,
        sampleRate: result.sampleRate || apiSignal.sampleRate,
        duration: inputSignal.duration,
      };

      setOutputSignal(newOutputApiSignal);

      if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
      fftTimeoutRef.current = setTimeout(() => {
        computeFourierTransform(newOutputApiSignal, "output");
      }, 200);
    } catch (error) {
      showToast("❌ Equalization failed", "error");
    } finally {
      isProcessingRef.current = false;
    }
  }, [inputSignal, apiSignal, currentMode, API_BASE_URL]);

  const handleAddSlider = () => {
    const currentConfig = modeConfigs?.[currentMode];
    if (currentConfig && !allowsCustomSliders(currentConfig)) {
      showToast(`${currentConfig.name} does not allow custom sliders.`, "info");
      return;
    }
    setShowSliderModal(true);
  };

  const handleCreateSlider = (newSlider) => {
    setSliders([...sliders, newSlider]);
    setShowSliderModal(false);
    if (equalizationTimeoutRef.current)
      clearTimeout(equalizationTimeoutRef.current);
    equalizationTimeoutRef.current = setTimeout(() => applyEqualization(), 100);
  };

  const handleRemoveSlider = (sliderId) => {
    setSliders((prev) => prev.filter((s) => s.id !== sliderId));
    if (equalizationTimeoutRef.current)
      clearTimeout(equalizationTimeoutRef.current);
    equalizationTimeoutRef.current = setTimeout(() => applyEqualization(), 100);
  };

  const handlePlayInputAudio = () => inputSignal && playAudio(inputSignal);
  const handlePlayOutputAudio = () => outputSignal && playAudio(outputSignal);
  const handlePlayAIAudio = () => aiModelSignal && playAudio(aiModelSignal);

  const playAudio = (signal) => {
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
    source.start();
  };

  const handleAIModelResult = (aiSignal) => {
    setAiModelSignal(aiSignal);
    setShowAIGraphs(true);
    setComparisonMode(null);
    if (aiSignal.fourierData) setAiModelFourierData(aiSignal.fourierData);
    else computeFourierTransform(aiSignal, "ai");
  };

  const handleComparisonChange = (mode) => setComparisonMode(mode);

  const getGridColumns = () => {
    if (comparisonMode) return "1fr 1fr";
    if (showAIGraphs && aiModelSignal) return "repeat(3, 1fr)";
    return "1fr 1fr";
  };

  const canAddCustomSliders = () => {
    if (!modeConfigs || !modeConfigs[currentMode]) return false;
    return allowsCustomSliders(modeConfigs[currentMode]);
  };

  const allSlidersAtUnity = () => {
    if (!sliders || sliders.length === 0) return true;
    return sliders.every((slider) => Math.abs(slider.value - 1.0) < 0.0001);
  };

  return (
    <div className="App">
      {/* Toast Notification */}
      {toast.visible && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      {/* Header Component (includes export modal) */}
      <AppHeader
        currentMode={currentMode}
        isLoadingModes={isLoadingModes}
        fileInputRef={fileInputRef}
        sliders={sliders}
        inputSignal={inputSignal}
        apiSignal={apiSignal}
        onModeChange={handleModeChange}
        onFileUpload={handleFileUpload}
        onReloadConfig={reloadConfigFromBackend}
        onResetDefaults={handleRefreshModeConfigs}
        onLoadSettings={handleLoadSettingsFromFile}
        onToast={showToast}
      />

      {showSliderModal && (
        <SliderCreationModal
          onCreate={handleCreateSlider}
          onCancel={() => setShowSliderModal(false)}
        />
      )}

      <div className="main-container">
        {isAIModeEnabled && (
          <AIModelSection
            mode={currentMode}
            inputSignal={inputSignal}
            sliderOutputSignal={outputSignal}
            inputFourierData={inputFourierData}
            sliderFourierData={outputFourierData}
            onModelResult={handleAIModelResult}
            onComparisonChange={handleComparisonChange}
          />
        )}

        {currentMode === "musical" && (
          <UnifiedMusicController
            inputSignal={inputSignal}
            sliders={sliders}
            onSliderChange={handleSliderChange}
            onAIToggle={handleAIToggle}
            isAIEnabled={isAIMode}
          />
        )}

        <section className="section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 className="section-title">
              {modeConfigs?.[currentMode]?.icon || "⚙️"} Equalizer -{" "}
              {modeConfigs?.[currentMode]?.name || "Unknown Mode"}
            </h2>

            {currentMode === "musical" && inputSignal && (
              <button
                className={`btn ${isAIMode ? "btn-primary" : "btn-secondary"}`}
                onClick={() => {
                  const newMode = !isAIMode;
                  setIsAIMode(newMode);
                  handleAIToggle(newMode, aiStems);
                }}
                style={{
                  background: isAIMode
                    ? "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
                    : undefined,
                }}
              >
                {isAIMode ? "🤖 AI Mode (ON)" : "🎛️ Switch to AI Mode"}
              </button>
            )}
          </div>

          {modeConfigs?.[currentMode]?.description && (
            <p className="mode-description">
              {modeConfigs[currentMode].description}
              {currentMode === "musical" && (
                <span
                  style={{
                    display: "block",
                    marginTop: "8px",
                    fontStyle: "italic",
                    opacity: 0.9,
                  }}
                >
                  {isAIMode
                    ? "🤖 Using AI stem separation - sliders control individual instruments"
                    : "🎛️ Using frequency-based equalization"}
                </span>
              )}
            </p>
          )}

          <div className="equalizer-sliders">
            {sliders.map((slider) => (
              <EqualizerSlider
                key={slider.id}
                slider={slider}
                onChange={handleSliderChange}
                onRemove={canAddCustomSliders() ? handleRemoveSlider : null}
              />
            ))}
          </div>

          {canAddCustomSliders() && (
            <button className="add-slider-btn" onClick={handleAddSlider}>
              ➕ Add Custom Slider
            </button>
          )}
        </section>

        <LinkedSignalViewers
          inputSignal={inputSignal}
          outputSignal={outputSignal}
          aiModelSignal={aiModelSignal}
          showAIViewer={aiStems && aiModelSignal}
        />

        <div
          className="audio-buttons"
          style={{
            gridTemplateColumns:
              aiStems && aiModelSignal ? "1fr 1fr 1fr" : "1fr 1fr",
          }}
        >
          <button className="audio-btn" onClick={handlePlayInputAudio}>
            🔊 Play Input Audio
          </button>
          <button className="audio-btn" onClick={handlePlayOutputAudio}>
            🔊 Play Manual EQ Output
          </button>
          {aiStems && aiModelSignal && (
            <button
              className="audio-btn"
              onClick={handlePlayAIAudio}
              style={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
              }}
            >
              🔊 Play AI Stems Output
            </button>
          )}
        </div>

        <section className="section">
          <div className="fourier-section">
            <h2 className="section-title">📊 Fourier Transform</h2>
            <div className="scale-toggle">
              <label>Scale:</label>
              <select
                value={fftScale}
                onChange={(e) => setFftScale(e.target.value)}
                className="mode-selector"
              >
                <option value="linear">Linear</option>
                <option value="audiogram">Audiogram</option>
              </select>
            </div>
          </div>

          <div
            className="fourier-graphs-grid"
            style={{ gridTemplateColumns: getGridColumns() }}
          >
            <FourierGraph
              fourierData={inputFourierData}
              scale={fftScale}
              title="Input FFT (Original)"
              isLoading={isLoadingFFT}
              error={fftError}
            />
            {comparisonMode === "ai" && aiModelFourierData ? (
              <FourierGraph
                fourierData={aiModelFourierData}
                scale={fftScale}
                title="AI Model FFT"
                isLoading={isLoadingFFT}
                error={fftError}
              />
            ) : comparisonMode === "slider" ? (
              <FourierGraph
                fourierData={outputFourierData}
                scale={fftScale}
                title="Equalizer FFT"
                isLoading={isLoadingFFT}
                error={fftError}
              />
            ) : (
              <>
                <FourierGraph
                  fourierData={outputFourierData}
                  scale={fftScale}
                  title="Slider Output FFT"
                  isLoading={isLoadingFFT}
                  error={fftError}
                />
                {showAIGraphs && aiModelFourierData && (
                  <FourierGraph
                    fourierData={aiModelFourierData}
                    scale={fftScale}
                    title="AI Model FFT"
                    isLoading={isLoadingFFT}
                    error={fftError}
                  />
                )}
              </>
            )}
          </div>
        </section>

        <section className="spectrograms-controls">
          <h2 className="section-title">📈 Spectrograms</h2>
          <button
            className={`toggle-btn ${showSpectrograms ? "active" : ""}`}
            onClick={() => setShowSpectrograms(!showSpectrograms)}
          >
            {showSpectrograms ? "👁️ Hide" : "👁️ Show"}
          </button>
        </section>

        {showSpectrograms && (
          <div
            className="spectrograms-grid"
            style={{ gridTemplateColumns: getGridColumns() }}
          >
            <Spectrogram
              signal={inputSignal}
              title="Input Spectrogram (Original)"
              visible={showSpectrograms}
            />
            {comparisonMode === "ai" && aiModelSignal ? (
              <Spectrogram
                signal={aiModelSignal}
                title="AI Model Spectrogram"
                visible={showSpectrograms}
              />
            ) : comparisonMode === "slider" ? (
              <Spectrogram
                signal={
                  allSlidersAtUnity() && inputSignal
                    ? inputSignal
                    : outputSignal
                }
                title="Equalizer Spectrogram"
                visible={showSpectrograms}
              />
            ) : (
              <>
                <Spectrogram
                  signal={
                    allSlidersAtUnity() && inputSignal
                      ? inputSignal
                      : outputSignal
                  }
                  title="Slider Output Spectrogram"
                  visible={showSpectrograms}
                />
                {showAIGraphs && aiModelSignal && (
                  <Spectrogram
                    signal={aiModelSignal}
                    title="AI Model Spectrogram"
                    visible={showSpectrograms}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MainPage;
