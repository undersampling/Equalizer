
// import React, { useState, useRef, useEffect, useCallback } from "react";
// import AppHeader from "../components/Header";
// import EqualizerSlider from "../components/EqualizerSlider";
// import SliderCreationModal from "../components/SliderCreationModal";
// import Spectrogram from "../components/Spectrogram";
// import FourierGraph from "../components/FourierGraph";
// import AIModelSection from "../components/AIModelSection";
// // import UnifiedMusicController from "../components/UnifiedMusicController";
// import LinkedSignalViewers from "../components/LinkedSignalViewers";
// import apiService from "../services/api";
// import {
//   getAllModeConfigs,
//   getModeConfig,
//   clearCache,
//   getFallbackConfig,
//   allowsCustomSliders,
//   autoSyncSliders,
// } from "../utils/modeConfigs";
// // Downsampling removed - using full signal for accurate processing
// import {
//   saveSettings,
//   loadSettings,
//   clearSettings,
// } from "../utils/settingsManager";

// function MainPage() {
//   // Toast notification state
//   const [toast, setToast] = useState({
//     message: "",
//     type: "success",
//     visible: false,
//   });

//   // Toast helper function
//   const showToast = (message, type = "success") => {
//     setToast({ message, type, visible: true });
//     setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
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
//   const [showSpectrograms, setShowSpectrograms] = useState(true);
//   const [fftScale, setFftScale] = useState("linear");
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

//   const isAIModeEnabled = currentMode === "musical" || currentMode === "human";

//   // Load mode configurations on mount
//   useEffect(() => {
//     const loadModeConfigs = async () => {
//       setIsLoadingModes(true);
//       setModeLoadError(null);

//       try {
//         const configs = await getAllModeConfigs();
//         if (!configs || Object.keys(configs).length === 0) {
//           throw new Error("No mode configurations received from backend");
//         }

//         setModeConfigs(configs);
//         if (configs[currentMode]) {
//           setSliders(configs[currentMode].sliders);
//           slidersRef.current = configs[currentMode].sliders;
//         }
//       } catch (error) {
//         console.error("❌ Failed to load mode configs:", error);
//         setModeLoadError(error.message);
//         const fallback = getFallbackConfig(currentMode);
//         setSliders(fallback.sliders);
//         slidersRef.current = fallback.sliders;
//         showToast(`Failed to connect to backend`, "error");
//       } finally {
//         setIsLoadingModes(false);
//       }
//     };

//     loadModeConfigs();
//   }, []);

//   useEffect(() => {
//     slidersRef.current = sliders;
//   }, [sliders]);

//   // AUTO-SAVE: localStorage + Backend Sync
//   useEffect(() => {
//     const saveTimeout = setTimeout(() => {
//       if (sliders && sliders.length > 0) {
//         saveSettings(currentMode, sliders);
//         if (backendSyncTimeoutRef.current)
//           clearTimeout(backendSyncTimeoutRef.current);

//         backendSyncTimeoutRef.current = setTimeout(async () => {
//           try {
//             await autoSyncSliders(currentMode, sliders);
//           } catch (error) {
//             console.warn("Backend sync failed:", error.message);
//           }
//         }, 2000);
//       }
//     }, 500);

//     return () => {
//       clearTimeout(saveTimeout);
//       if (backendSyncTimeoutRef.current)
//         clearTimeout(backendSyncTimeoutRef.current);
//     };
//   }, [sliders, currentMode]);

//   // Recompute FFT when scale changes
//   useEffect(() => {
//     if (apiSignal) computeFourierTransform(apiSignal, "input");
//     if (outputSignal && apiSignal) computeFourierTransform(apiSignal, "output");
//     if (aiModelSignal) computeFourierTransform(aiModelSignal, "ai");
//   }, [fftScale]);

//   // Cleanup timeouts on unmount
//   useEffect(() => {
//     return () => {
//       if (equalizationTimeoutRef.current)
//         clearTimeout(equalizationTimeoutRef.current);
//       if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
//       if (backendSyncTimeoutRef.current)
//         clearTimeout(backendSyncTimeoutRef.current);
//     };
//   }, []);

//   // Handle mode change
//   const handleModeChange = async (e) => {
//     const newMode = e.target.value;
//     setCurrentMode(newMode);

//     try {
//       const savedSettings = loadSettings(newMode);

//       if (savedSettings && savedSettings.sliders) {
//         setSliders(savedSettings.sliders);
//         slidersRef.current = savedSettings.sliders;
//       } else if (modeConfigs && modeConfigs[newMode]) {
//         setSliders(modeConfigs[newMode].sliders);
//         slidersRef.current = modeConfigs[newMode].sliders;
//       } else {
//         const config = await getModeConfig(newMode);
//         setSliders(config.sliders);
//         slidersRef.current = config.sliders;
//       }

//       setAiModelSignal(null);
//       setAiModelFourierData(null);
//       setComparisonMode(null);
//       setShowAIGraphs(false);

//       if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
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
//       clearCache();
//       const configs = await getAllModeConfigs(null, true);
//       if (!configs || Object.keys(configs).length === 0) {
//         throw new Error("No mode configurations received from backend");
//       }

//       setModeConfigs(configs);
//       if (configs[currentMode]) {
//         setSliders(configs[currentMode].sliders);
//         slidersRef.current = configs[currentMode].sliders;
//         if (inputSignal && apiSignal)
//           setTimeout(() => applyEqualization(), 100);
//       }

//       showToast("✅ Configuration reloaded successfully", "success");
//     } catch (error) {
//       showToast(`❌ Failed to reload: ${error.message}`, "error");
//     } finally {
//       setIsLoadingModes(false);
//     }
//   };

//   const handleRefreshModeConfigs = async () => {
//     clearCache();
//     setIsLoadingModes(true);
//     showToast("🔄 Resetting to default configuration...", "info");

//     try {
//       await apiService.resetModes();

//       ["generic", "musical", "animal", "human"].forEach((mode) =>
//         clearSettings(mode)
//       );

//       const configs = await getAllModeConfigs(null, true);
//       setModeConfigs(configs);

//       if (configs[currentMode]) {
//         setSliders(configs[currentMode].sliders);
//         slidersRef.current = configs[currentMode].sliders;
//       }

//       showToast("✅ All modes reset to default configuration", "success");
//       if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
//     } catch (error) {
//       showToast(`❌ Reset failed: ${error.message}`, "error");
//     } finally {
//       setIsLoadingModes(false);
//     }
//   };

//   const handleLoadSettingsFromFile = (settings) => {
//     setCurrentMode(settings.mode);
//     setSliders(settings.sliders);
//     slidersRef.current = settings.sliders;
//     saveSettings(settings.mode, settings.sliders);
//     if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
//   };

//   const handleAIToggle = (enabled, stems) => {
//     setIsAIMode(enabled);
//     setAiStems(stems);
//     if (enabled && stems) applyAIMixing();
//     else applyEqualization();
//   };

//   const applyAIMixing = useCallback(async () => {
//     if (!inputSignal || !aiStems || isProcessingRef.current) return;
//     isProcessingRef.current = true;

//     try {
//       const stemsWithGains = {};
//       slidersRef.current.forEach((slider) => {
//         const stemName = slider.aiStem;
//         if (stemName && aiStems[stemName]) {
//           stemsWithGains[stemName] = {
//             data: aiStems[stemName].data,
//             gain: slider.value,
//           };
//         }
//       });

//       const response = await apiService.mixMusic(
//         stemsWithGains,
//         inputSignal.sampleRate
//       );
//       const result = response.data;

//       const newOutputSignal = {
//         data: result.mixedSignal,
//         sampleRate: result.sampleRate,
//         duration: inputSignal.duration,
//       };

//       setOutputSignal(newOutputSignal);
//       setAiModelSignal(newOutputSignal);
//       setShowAIGraphs(true);

//       if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
//       fftTimeoutRef.current = setTimeout(() => {
//         computeFourierTransform(newOutputSignal, "output");
//         computeFourierTransform(newOutputSignal, "ai");
//       }, 200);
//     } catch (error) {
//       showToast("❌ AI mixing failed", "error");
//     } finally {
//       isProcessingRef.current = false;
//     }
//   }, [inputSignal, aiStems]);

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

//         // Use full original signal - NO DOWNSAMPLING
//         const originalSignal = {
//           data: Array.from(channelData),
//           sampleRate: audioBuffer.sampleRate,
//           duration: audioBuffer.duration,
//         };

//         // Use the same original signal for all processing
//         setInputSignal(originalSignal);
//         setOutputSignal(originalSignal);
//         setApiSignal(originalSignal);
//         setAiModelSignal(null);
//         setAiModelFourierData(null);
//         setComparisonMode(null);
//         setShowAIGraphs(false);

//         computeFourierTransform(apiSignal, "input");
//         computeFourierTransform(apiSignal, "output");

//         showToast("✅ Audio file loaded successfully", "success");
//       } catch (error) {
//         showToast(
//           "❌ Error loading file. Please try a different audio file.",
//           "error"
//         );
//       }
//     };
//     reader.readAsArrayBuffer(file);
//   };

//   const computeFourierTransform = async (signal, type) => {
//     if (!signal || !signal.data || signal.data.length === 0) return;

//     // Use full signal - NO DOWNSAMPLING
//     if (!signal.data || signal.data.length === 0) {
//       setFftError("Signal is empty");
//       return;
//     }

//     setIsLoadingFFT(true);
//     setFftError(null);

//     try {
//       // Limit signal size for FFT to improve performance
//       // We don't need the full signal for the frequency graph
//       const limitedSignal = limitSignalSize(signal.data, 10000);

//       const response = await apiService.computeFFT(
//         limitedSignal,
//         signal.sampleRate,
//         fftScale
//       );
//       const result = response.data;

//       if (!result.frequencies || !result.magnitudes)
//         throw new Error("Invalid response format from FFT API");

//       if (type === "input") setInputFourierData(result);
//       else if (type === "output") setOutputFourierData(result);
//       else if (type === "ai") setAiModelFourierData(result);

//       setIsLoadingFFT(false);
//       setFftError(null);
//     } catch (error) {
//       setIsLoadingFFT(false);
//       setFftError(error.message);
//       if (type === "input") setInputFourierData(null);
//       else if (type === "output") setOutputFourierData(null);
//       else if (type === "ai") setAiModelFourierData(null);
//     }
//   };

//   const handleSliderChange = (sliderId, newValue) => {
//     setSliders((prev) =>
//       prev.map((slider) =>
//         slider.id === sliderId ? { ...slider, value: newValue } : slider
//       )
//     );

//     if (inputSignal && apiSignal) {
//       if (equalizationTimeoutRef.current)
//         clearTimeout(equalizationTimeoutRef.current);
//       equalizationTimeoutRef.current = setTimeout(() => {
//         if (isAIMode && aiStems) applyAIMixing();
//         else applyEqualization();
//       }, 150);
//     }
//   };

//   const applyEqualization = useCallback(async () => {
//     if (!inputSignal || !apiSignal || isProcessingRef.current) return;
//     isProcessingRef.current = true;

//     try {
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

//       const newOutputApiSignal = {
//         data: result.outputSignal,
//         sampleRate: result.sampleRate || apiSignal.sampleRate,
//         duration: inputSignal.duration,
//       };

//       setOutputSignal(newOutputApiSignal);

//       if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
//       fftTimeoutRef.current = setTimeout(() => {
//         computeFourierTransform(newOutputApiSignal, "output");
//       }, 200);
//     } catch (error) {
//       showToast("❌ Equalization failed", "error");
//     } finally {
//       isProcessingRef.current = false;
//     }
//   }, [inputSignal, apiSignal, currentMode]);

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
//     if (equalizationTimeoutRef.current)
//       clearTimeout(equalizationTimeoutRef.current);
//     equalizationTimeoutRef.current = setTimeout(() => applyEqualization(), 100);
//   };

//   const handleRemoveSlider = (sliderId) => {
//     setSliders((prev) => prev.filter((s) => s.id !== sliderId));
//     if (equalizationTimeoutRef.current)
//       clearTimeout(equalizationTimeoutRef.current);
//     equalizationTimeoutRef.current = setTimeout(() => applyEqualization(), 100);
//   };

//   const handlePlayInputAudio = () => {
//     let signalToPlay = inputSignal;
    
//     // Update signal based on comparison mode
//     if (comparisonMode === "equalizer_vs_ai") {
//       signalToPlay = allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
//     } else {
//       signalToPlay = inputSignal;
//     }
    
//     if (signalToPlay && signalToPlay.data && signalToPlay.data.length > 0) {
//       playAudio(signalToPlay);
//     }
//   };

//   const handlePlayOutputAudio = () => {
//     let signalToPlay = outputSignal;
    
//     // Update signal based on comparison mode
//     if (comparisonMode === "ai") {
//       signalToPlay = aiModelSignal;
//     } else if (comparisonMode === "slider") {
//       signalToPlay = allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
//     } else if (comparisonMode === "equalizer_vs_ai") {
//       signalToPlay = aiModelSignal;
//     } else {
//       signalToPlay = outputSignal;
//     }
    
//     if (signalToPlay && signalToPlay.data && signalToPlay.data.length > 0) {
//       playAudio(signalToPlay);
//     }
//   };

//   const getFirstButtonLabel = () => {
//     if (comparisonMode === "equalizer_vs_ai") {
//       return "🔊 Play Equalizer Output";
//     } else {
//       return "🔊 Play Input Audio";
//     }
//   };

//   const getSecondButtonLabel = () => {
//     if (comparisonMode === "ai") {
//       return "🔊 Play AI Output";
//     } else if (comparisonMode === "slider") {
//       return "🔊 Play Equalizer Output";
//     } else if (comparisonMode === "equalizer_vs_ai") {
//       return "🔊 Play AI Output";
//     } else {
//       return "🔊 Play Manual EQ Output";
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

//   const handleAIModelResult = (aiSignal) => {
//     setAiModelSignal(aiSignal);
//     setShowAIGraphs(true);
//     // Reset comparison mode when AI signal is updated (e.g., after remixing voices)
//     // This makes buttons return to default labels and signals
//     setComparisonMode(null);
//     if (aiSignal.fourierData) setAiModelFourierData(aiSignal.fourierData);
//     else computeFourierTransform(aiSignal, "ai");
//   };

//   const handleComparisonChange = (mode) => setComparisonMode(mode);

//   const getGridColumns = () => {
//     // Always show 2 columns (Original vs Equalizer by default)
//     // Only show 2 columns when comparison mode is active
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

//       {/* Header Component (includes export modal) */}
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
//           onCreate={handleCreateSlider}
//           onCancel={() => setShowSliderModal(false)}
//         />
//       )}

//       <div className="main-container">
//         {isAIModeEnabled && (
//           <AIModelSection
//             mode={currentMode}
//             inputSignal={inputSignal}
//             outputSignal={outputSignal}
//             sliderOutputSignal={outputSignal}
//             inputFourierData={inputFourierData}
//             sliderFourierData={outputFourierData}
//             onModelResult={handleAIModelResult}
//             onComparisonChange={handleComparisonChange}
//           />
//         )}

//         {/* {currentMode === "musical" && (
//           <UnifiedMusicController
//             inputSignal={inputSignal}
//             sliders={sliders}
//             onSliderChange={handleSliderChange}
//             onAIToggle={handleAIToggle}
//             isAIEnabled={isAIMode}
//           />
//         )} */}

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
//                     }
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
//           inputSignal={
//             comparisonMode === "equalizer_vs_ai" 
//               ? (allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal)
//               : inputSignal
//           }
//           outputSignal={
//             comparisonMode === "ai" 
//               ? aiModelSignal 
//               : comparisonMode === "slider"
//               ? (allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal)
//               : comparisonMode === "equalizer_vs_ai"
//               ? aiModelSignal
//               : outputSignal
//           }
//           aiModelSignal={aiModelSignal}
//           showAIViewer={false}
//           comparisonMode={comparisonMode}
//           inputTitle={
//             comparisonMode === "equalizer_vs_ai" 
//               ? "Equalizer Output" 
//               : "Input Signal (Original)"
//           }
//           outputTitle={
//             comparisonMode === "ai" 
//               ? "AI Model Output" 
//               : comparisonMode === "slider"
//               ? "Equalizer Output"
//               : comparisonMode === "equalizer_vs_ai"
//               ? "AI Model Output"
//               : "Equalizer Output"
//           }
//         />

//         <div
//           className="audio-buttons"
//           style={{
//             gridTemplateColumns: "1fr 1fr",
//           }}
//         >
//           <button className="audio-btn" onClick={handlePlayInputAudio}>
//             {getFirstButtonLabel()}
//           </button>
//           <button className="audio-btn" onClick={handlePlayOutputAudio}>
//             {getSecondButtonLabel()}
//           </button>
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
//             style={{ gridTemplateColumns: getGridColumns() }}
//           >
//             <FourierGraph
//               fourierData={
//                 comparisonMode === "equalizer_vs_ai" ? outputFourierData : inputFourierData
//               }
//               scale={fftScale}
//               title={
//                 comparisonMode === "equalizer_vs_ai" 
//                   ? "Equalizer FFT" 
//                   : comparisonMode === "ai"
//                   ? "Input FFT (Original)"
//                   : comparisonMode === "slider"
//                   ? "Input FFT (Original)"
//                   : "Input FFT (Original)"
//               }
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
//             ) : comparisonMode === "equalizer_vs_ai" && aiModelFourierData ? (
//               <FourierGraph
//                 fourierData={aiModelFourierData}
//                 scale={fftScale}
//                 title="AI Model FFT"
//                 isLoading={isLoadingFFT}
//                 error={fftError}
//               />
//             ) : (
//               <FourierGraph
//                 fourierData={outputFourierData}
//                 scale={fftScale}
//                 title="Slider Output FFT"
//                 isLoading={isLoadingFFT}
//                 error={fftError}
//               />
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
//             style={{ gridTemplateColumns: getGridColumns() }}
//           >
//             <Spectrogram
//               signal={
//                 comparisonMode === "equalizer_vs_ai" 
//                   ? (allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal)
//                   : inputSignal
//               }
//               title={
//                 comparisonMode === "equalizer_vs_ai" 
//                   ? "Equalizer Spectrogram" 
//                   : comparisonMode === "ai"
//                   ? "Input Spectrogram (Original)"
//                   : comparisonMode === "slider"
//                   ? "Input Spectrogram (Original)"
//                   : "Input Spectrogram (Original)"
//               }
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
//             ) : comparisonMode === "equalizer_vs_ai" && aiModelSignal ? (
//               <Spectrogram
//                 signal={aiModelSignal}
//                 title="AI Model Spectrogram"
//                 visible={showSpectrograms}
//               />
//             ) : (
//               <Spectrogram
//                 signal={allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal}
//                 title="Slider Output Spectrogram"
//                 visible={showSpectrograms}
//               />
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
import LinkedSignalViewers from "../components/LinkedSignalViewers";
import apiService from "../services/api";
import {
  getAllModeConfigs,
  getModeConfig,
  clearCache,
  getFallbackConfig,
  allowsCustomSliders,
  autoSyncSliders,
} from "../utils/modeConfigs";
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
  const requestCounterRef = useRef(0);

  const isAIModeEnabled = currentMode === "musical" || currentMode === "human";

  // Load mode configurations on mount
  useEffect(() => {
    const loadModeConfigs = async () => {
      setIsLoadingModes(true);
      setModeLoadError(null);

      try {
        const configs = await getAllModeConfigs();
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
  }, []);

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
            await autoSyncSliders(currentMode, sliders);
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
  }, [sliders, currentMode]);

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
        const config = await getModeConfig(newMode);
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
      const configs = await getAllModeConfigs(null, true);
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
      await apiService.resetModes();

      ["generic", "musical", "animal", "human"].forEach((mode) =>
        clearSettings(mode)
      );

      const configs = await getAllModeConfigs(null, true);
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

      const response = await apiService.mixMusic(
        stemsWithGains,
        inputSignal.sampleRate
      );
      const result = response.data;

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
  }, [inputSignal, aiStems]);

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

        // Use full original signal - NO DOWNSAMPLING
        const originalSignal = {
          data: Array.from(channelData),
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
        };

        // Use the same original signal for all processing
        setInputSignal(originalSignal);
        setOutputSignal(originalSignal);
        setApiSignal(originalSignal);
        setAiModelSignal(null);
        setAiModelFourierData(null);
        setComparisonMode(null);
        setShowAIGraphs(false);

        computeFourierTransform(originalSignal, "input");
        computeFourierTransform(originalSignal, "output");

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

    if (!signal.data || signal.data.length === 0) {
      setFftError("Signal is empty");
      return;
    }

    setIsLoadingFFT(true);
    setFftError(null);

    try {
      // FIX: REMOVED CALL TO UNDEFINED limitSignalSize.
      // WE NOW SEND THE FULL SIGNAL DATA.
      const response = await apiService.computeFFT(
        signal.data,
        signal.sampleRate,
        fftScale
      );
      const result = response.data;

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

  const handleSliderChange = (sliderId, newValue, shouldEqualize = false) => {
    // Always update visual state immediately for smooth dragging
    setSliders((prev) =>
      prev.map((slider) =>
        slider.id === sliderId ? { ...slider, value: newValue } : slider
      )
    );

    // Only trigger equalization if explicitly requested (on mouse release)
    if (shouldEqualize && inputSignal && apiSignal) {
      if (equalizationTimeoutRef.current)
        clearTimeout(equalizationTimeoutRef.current);
      
      // Increment counter to invalidate previous requests
      requestCounterRef.current += 1;
      const currentRequest = requestCounterRef.current;
      
      // Small delay to ensure state is updated
      equalizationTimeoutRef.current = setTimeout(() => {
        if (isAIMode && aiStems) applyAIMixing();
        else applyEqualization(currentRequest);
      }, 50);
    }
  };

  // Handler for mouse up - triggers equalization
  const handleSliderMouseUp = (sliderId, newValue) => {
    // Trigger equalization on mouse release
    if (inputSignal && apiSignal) {
      if (equalizationTimeoutRef.current)
        clearTimeout(equalizationTimeoutRef.current);
      
      requestCounterRef.current += 1;
      const currentRequest = requestCounterRef.current;
      
      // Small delay to ensure all state is updated
      equalizationTimeoutRef.current = setTimeout(() => {
        if (isAIMode && aiStems) applyAIMixing();
        else applyEqualization(currentRequest);
      }, 50);
    }
  };

  const applyEqualization = useCallback(async (expectedRequestId) => {
    if (!inputSignal || !apiSignal || isProcessingRef.current) return;
    
    // If no request ID provided, use current counter (for non-slider triggers)
    const requestId = expectedRequestId ?? requestCounterRef.current;
    
    // Check if this request is still valid
    if (requestId !== requestCounterRef.current) {
      return; // This request is stale, ignore it
    }
    
    isProcessingRef.current = true;

    try {
      const response = await apiService.equalize(
        apiSignal.data,
        apiSignal.sampleRate,
        slidersRef.current,
        currentMode
      );
      
      // Double-check request is still valid after async operation
      if (requestId !== requestCounterRef.current) {
        return; // Stale request, ignore result
      }
      
      const result = response.data;

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
      }, 100);
    } catch (error) {
      // Only show error if this is still the current request
      if (requestId === requestCounterRef.current) {
        showToast("❌ Equalization failed", "error");
      }
    } finally {
      if (requestId === requestCounterRef.current) {
        isProcessingRef.current = false;
      }
    }
  }, [inputSignal, apiSignal, currentMode]);

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

  const handlePlayInputAudio = () => {
    let signalToPlay = inputSignal;

    // Update signal based on comparison mode
    if (comparisonMode === "equalizer_vs_ai") {
      signalToPlay =
        allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
    } else {
      signalToPlay = inputSignal;
    }

    if (signalToPlay && signalToPlay.data && signalToPlay.data.length > 0) {
      playAudio(signalToPlay);
    }
  };

  const handlePlayOutputAudio = () => {
    let signalToPlay = outputSignal;

    // Update signal based on comparison mode
    if (comparisonMode === "ai") {
      signalToPlay = aiModelSignal;
    } else if (comparisonMode === "slider") {
      signalToPlay =
        allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
    } else if (comparisonMode === "equalizer_vs_ai") {
      signalToPlay = aiModelSignal;
    } else {
      signalToPlay = outputSignal;
    }

    if (signalToPlay && signalToPlay.data && signalToPlay.data.length > 0) {
      playAudio(signalToPlay);
    }
  };

  const getFirstButtonLabel = () => {
    if (comparisonMode === "equalizer_vs_ai") {
      return "🔊 Play Equalizer Output";
    } else {
      return "🔊 Play Input Audio";
    }
  };

  const getSecondButtonLabel = () => {
    if (comparisonMode === "ai") {
      return "🔊 Play AI Output";
    } else if (comparisonMode === "slider") {
      return "🔊 Play Equalizer Output";
    } else if (comparisonMode === "equalizer_vs_ai") {
      return "🔊 Play AI Output";
    } else {
      return "🔊 Play Manual EQ Output";
    }
  };

  const handlePlayAIAudio = () => {
    if (aiModelSignal) {
      playAudio(aiModelSignal);
    }
  };

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
    // Reset comparison mode when AI signal is updated (e.g., after remixing voices)
    // This makes buttons return to default labels and signals
    setComparisonMode(null);
    if (aiSignal.fourierData) setAiModelFourierData(aiSignal.fourierData);
    else computeFourierTransform(aiSignal, "ai");
  };

  const handleComparisonChange = (mode) => setComparisonMode(mode);

  const getGridColumns = () => {
    // Always show 2 columns (Original vs Equalizer by default)
    // Only show 2 columns when comparison mode is active
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
            outputSignal={outputSignal}
            sliderOutputSignal={outputSignal}
            inputFourierData={inputFourierData}
            sliderFourierData={outputFourierData}
            onModelResult={handleAIModelResult}
            onComparisonChange={handleComparisonChange}
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
          </div>

          {modeConfigs?.[currentMode]?.description && (
            <p className="mode-description">
              {modeConfigs[currentMode].description}
            </p>
          )}

          <div className="equalizer-sliders">
            {sliders.map((slider) => (
              <EqualizerSlider
                key={slider.id}
                slider={slider}
                onChange={handleSliderChange}
                onMouseUp={handleSliderMouseUp}
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
          inputSignal={
            comparisonMode === "equalizer_vs_ai"
              ? allSlidersAtUnity() && inputSignal
                ? inputSignal
                : outputSignal
              : inputSignal
          }
          outputSignal={
            comparisonMode === "ai"
              ? aiModelSignal
              : comparisonMode === "slider"
              ? allSlidersAtUnity() && inputSignal
                ? inputSignal
                : outputSignal
              : comparisonMode === "equalizer_vs_ai"
              ? aiModelSignal
              : outputSignal
          }
          aiModelSignal={aiModelSignal}
          showAIViewer={false}
          comparisonMode={comparisonMode}
          inputTitle={
            comparisonMode === "equalizer_vs_ai"
              ? "Equalizer Output"
              : "Input Signal (Original)"
          }
          outputTitle={
            comparisonMode === "ai"
              ? "AI Model Output"
              : comparisonMode === "slider"
              ? "Equalizer Output"
              : comparisonMode === "equalizer_vs_ai"
              ? "AI Model Output"
              : "Equalizer Output"
          }
        />


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
              fourierData={
                comparisonMode === "equalizer_vs_ai"
                  ? outputFourierData
                  : inputFourierData
              }
              scale={fftScale}
              title={
                comparisonMode === "equalizer_vs_ai"
                  ? "Equalizer FFT"
                  : comparisonMode === "ai"
                  ? "Input FFT (Original)"
                  : comparisonMode === "slider"
                  ? "Input FFT (Original)"
                  : "Input FFT (Original)"
              }
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
            ) : comparisonMode === "equalizer_vs_ai" && aiModelFourierData ? (
              <FourierGraph
                fourierData={aiModelFourierData}
                scale={fftScale}
                title="AI Model FFT"
                isLoading={isLoadingFFT}
                error={fftError}
              />
            ) : (
              <FourierGraph
                fourierData={outputFourierData}
                scale={fftScale}
                title="Slider Output FFT"
                isLoading={isLoadingFFT}
                error={fftError}
              />
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
              signal={
                comparisonMode === "equalizer_vs_ai"
                  ? allSlidersAtUnity() && inputSignal
                    ? inputSignal
                    : outputSignal
                  : inputSignal
              }
              title={
                comparisonMode === "equalizer_vs_ai"
                  ? "Equalizer Spectrogram"
                  : comparisonMode === "ai"
                  ? "Input Spectrogram (Original)"
                  : comparisonMode === "slider"
                  ? "Input Spectrogram (Original)"
                  : "Input Spectrogram (Original)"
              }
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
                  allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal
                }
                title="Equalizer Spectrogram"
                visible={showSpectrograms}
              />
            ) : comparisonMode === "equalizer_vs_ai" && aiModelSignal ? (
              <Spectrogram
                signal={aiModelSignal}
                title="AI Model Spectrogram"
                visible={showSpectrograms}
              />
            ) : (
              <Spectrogram
                signal={
                  allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal
                }
                title="Slider Output Spectrogram"
                visible={showSpectrograms}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MainPage;