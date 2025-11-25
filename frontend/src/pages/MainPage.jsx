// import React, { useState, useRef, useEffect, useCallback } from "react";
// import AppHeader from "../components/Header";
// import EqualizerSlider from "../components/EqualizerSlider";
// import SliderCreationModal from "../components/SliderCreationModal";
// import Spectrogram from "../components/Spectrogram";
// import FourierGraph from "../components/FourierGraph";
// import AIModelSection from "../components/AIModelSection";
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

//   // State to track if AI has processed stems
//   const [hasAIStems, setHasAIStems] = useState(false);

//   const fileInputRef = useRef(null);
//   const audioContextRef = useRef(null);
//   const equalizationTimeoutRef = useRef(null);
//   const fftTimeoutRef = useRef(null);
//   const backendSyncTimeoutRef = useRef(null);
//   const isProcessingRef = useRef(false);
//   const slidersRef = useRef(sliders);

//   // Ref for AIModelSection to call its methods
//   const aiModelRef = useRef(null);

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

//       // Reset AI-related states when changing modes
//       setAiModelSignal(null);
//       setAiModelFourierData(null);
//       setComparisonMode(null);
//       setShowAIGraphs(false);
//       setHasAIStems(false);

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
//         setHasAIStems(false);

//         computeFourierTransform(originalSignal, "input");
//         computeFourierTransform(originalSignal, "output");

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

//     if (!signal.data || signal.data.length === 0) {
//       setFftError("Signal is empty");
//       return;
//     }

//     setIsLoadingFFT(true);
//     setFftError(null);

//     try {
//       // Send the full signal data to backend
//       const response = await apiService.computeFFT(
//         signal.data,
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
//         // If we're in musical mode and have AI stems, trigger AI remixing
//         if (currentMode === "musical" && hasAIStems && aiModelRef.current) {
//           aiModelRef.current.remixStems();
//         } 
//         // Otherwise use regular equalization
//         else if (isAIMode && aiStems) {
//           applyAIMixing();
//         } else {
//           applyEqualization();
//         }
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
//       signalToPlay =
//         allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
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
//       signalToPlay =
//         allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
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
//     setHasAIStems(true); // Set this when AI model produces results
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
//             ref={aiModelRef}
//             mode={currentMode}
//             inputSignal={inputSignal}
//             outputSignal={outputSignal}
//             sliders={sliders}
//             onModelResult={handleAIModelResult}
//             onComparisonChange={handleComparisonChange}
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
            
//             {/* Show AI integration status */}
//             {currentMode === "musical" && hasAIStems && (
//               <div className="ai-integration-badge">
//                 <span className="ai-badge-icon">🤖</span>
//                 <span className="ai-badge-text">AI Stems Active</span>
//               </div>
//             )}
//           </div>

//           {modeConfigs?.[currentMode]?.description && (
//             <p className="mode-description">
//               {modeConfigs[currentMode].description}
//               {currentMode === "musical" && hasAIStems && (
//                 <span className="ai-integration-note">
//                   {" "}• These sliders now control AI-separated stems in real-time!
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
//                 isAIControlled={currentMode === "musical" && hasAIStems}
//               />
//             ))}
//           </div>

//           {canAddCustomSliders() && !hasAIStems && (
//             <button className="add-slider-btn" onClick={handleAddSlider}>
//               ➕ Add Custom Slider
//             </button>
//           )}

//           {hasAIStems && (
//             <div className="ai-controls-info">
//               <div className="ai-controls-header">
//                 <span>🎛️</span>
//                 <span>Real-time AI Stem Control</span>
//               </div>
//               <p>Move the sliders above to adjust individual instrument levels in real-time!</p>
//             </div>
//           )}
//         </section>

//         <LinkedSignalViewers
//           inputSignal={
//             comparisonMode === "equalizer_vs_ai"
//               ? allSlidersAtUnity() && inputSignal
//                 ? inputSignal
//                 : outputSignal
//               : inputSignal
//           }
//           outputSignal={
//             comparisonMode === "ai"
//               ? aiModelSignal
//               : comparisonMode === "slider"
//               ? allSlidersAtUnity() && inputSignal
//                 ? inputSignal
//                 : outputSignal
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
//               : hasAIStems
//               ? "AI Stem Mix Output"
//               : "Equalizer Output"
//           }
//         />

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
//                 comparisonMode === "equalizer_vs_ai"
//                   ? outputFourierData
//                   : inputFourierData
//               }
//               scale={fftScale}
//               title={
//                 comparisonMode === "equalizer_vs_ai"
//                   ? hasAIStems
//                     ? "AI Stem Mix FFT"
//                     : "Equalizer FFT"
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
//                 title={hasAIStems ? "AI Stem Mix FFT" : "Equalizer FFT"}
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
//                 title={hasAIStems ? "AI Stem Mix FFT" : "Slider Output FFT"}
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
//                   ? allSlidersAtUnity() && inputSignal
//                     ? inputSignal
//                     : outputSignal
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
//                   allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal
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
//                 signal={
//                   allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal
//                 }
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
import SignalViewer from "../components/SignalViewer";
import CineController from "../components/CineController";
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
  // === STATE MANAGEMENT ===
  const [toast, setToast] = useState({ message: "", type: "success", visible: false });
  const [currentMode, setCurrentMode] = useState("generic");
  const [sliders, setSliders] = useState([]);
  const [modeConfigs, setModeConfigs] = useState(null);
  const [isLoadingModes, setIsLoadingModes] = useState(true);

  // Signal states
  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);
  const [apiSignal, setApiSignal] = useState(null);
  const [aiModelSignal, setAiModelSignal] = useState(null);
  
  // Fourier data states
  const [inputFourierData, setInputFourierData] = useState(null);
  const [outputFourierData, setOutputFourierData] = useState(null);
  const [aiModelFourierData, setAiModelFourierData] = useState(null);
  
  // UI states - PLAYBACK CONTROL
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  
  // Tracks if we are playing the "Secondary" signal
  const [isPlayingSecondary, setIsPlayingSecondary] = useState(false);
  
  const [isAIMode, setIsAIMode] = useState(false);
  const [aiStems, setAiStems] = useState(null);
  const [showSpectrograms, setShowSpectrograms] = useState(true);
  const [fftScale, setFftScale] = useState("linear");
  const [showSliderModal, setShowSliderModal] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(null);
  const [showAIGraphs, setShowAIGraphs] = useState(false);
  const [fftError, setFftError] = useState(null);
  const [isLoadingFFT, setIsLoadingFFT] = useState(false);
  const [hasAIStems, setHasAIStems] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const equalizationTimeoutRef = useRef(null);
  const fftTimeoutRef = useRef(null);
  const backendSyncTimeoutRef = useRef(null);
  const isProcessingRef = useRef(false);
  const slidersRef = useRef(sliders);
  const aiModelRef = useRef(null);
  const animationFrameRef = useRef(null);
  // Helper ref to track playback offset for sync
  const startTimeRef = useRef(0);

  // === HELPER FUNCTIONS ===
  const showToast = (message, type = "success") => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
  };

  const isAIModeEnabled = currentMode === "musical" || currentMode === "human";

  const allSlidersAtUnity = () => {
    if (!sliders || sliders.length === 0) return true;
    const eqSliders = sliders.filter(s => !s.isVoice);
    return eqSliders.every((slider) => Math.abs(slider.value - 1.0) < 0.0001);
  };

  const canAddCustomSliders = () => {
    if (!modeConfigs || !modeConfigs[currentMode]) return false;
    return allowsCustomSliders(modeConfigs[currentMode]);
  };

  // === SIGNAL SELECTION (Exact Match to your Code) ===
  const getPrimarySignal = () => {
    if (comparisonMode === "equalizer_vs_ai") {
      return allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
    }
    return inputSignal;
  };

  const getSecondarySignal = () => {
    if (comparisonMode === "ai") {
      return aiModelSignal;
    } else if (comparisonMode === "slider") {
      return allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
    } else if (comparisonMode === "equalizer_vs_ai") {
      return aiModelSignal;
    } else {
      return outputSignal;
    }
  };

  const getSignalByType = (type) => {
    if (comparisonMode === "equalizer_vs_ai") {
      return type === "input" 
        ? (allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal)
        : aiModelSignal;
    }
    
    if (comparisonMode === "ai") {
      return type === "input" ? inputSignal : aiModelSignal;
    }
    
    if (comparisonMode === "slider") {
      return type === "input" 
        ? inputSignal 
        : (allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal);
    }
    
    return type === "input" ? inputSignal : outputSignal;
  };

  const getTitleByType = (type, isFFT = false) => {
    const suffix = isFFT ? " FFT" : " Signal";
    const aiSuffix = hasAIStems ? " Stem Mix" : " Output";
    
    if (comparisonMode === "equalizer_vs_ai") {
      return type === "input" ? `Equalizer${suffix}` : `AI Model${suffix}`;
    }
    if (comparisonMode === "ai") {
      return type === "input" ? `Input${suffix} (Original)` : `AI Model${suffix}`;
    }
    if (comparisonMode === "slider") {
      return type === "input" ? `Input${suffix} (Original)` : `Equalizer${suffix}`;
    }
    return type === "input" ? `Input${suffix} (Original)` : hasAIStems ? `AI${aiSuffix}${suffix}` : `Equalizer${suffix}`;
  };

  const getFourierDataByType = (type) => {
    if (comparisonMode === "equalizer_vs_ai") {
      return type === "input" ? outputFourierData : aiModelFourierData;
    }
    if (comparisonMode === "ai") {
      return type === "input" ? inputFourierData : aiModelFourierData;
    }
    if (comparisonMode === "slider") {
      return type === "input" ? inputFourierData : outputFourierData;
    }
    return type === "input" ? inputFourierData : outputFourierData;
  };

  // === CORE PROCESSING ===
  const computeFourierTransform = async (signal, type) => {
    if (!signal || !signal.data || signal.data.length === 0) return;

    setIsLoadingFFT(true);
    setFftError(null);

    try {
      const response = await apiService.computeFFT(
        signal.data,
        signal.sampleRate,
        fftScale
      );
      const result = response.data;

      if (type === "input") setInputFourierData(result);
      else if (type === "output") setOutputFourierData(result);
      else if (type === "ai") setAiModelFourierData(result);
      
      setIsLoadingFFT(false);
      setFftError(null);
    } catch (error) {
      setIsLoadingFFT(false);
      setFftError(error.message);
    }
  };

  const applyEqualization = useCallback(async () => {
    if (!inputSignal || !apiSignal || isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      // Filter out voice sliders to prevent EQ backend crash
      const eqSliders = slidersRef.current.filter(s => !s.isVoice);

      const response = await apiService.equalize(
        apiSignal.data,
        apiSignal.sampleRate,
        eqSliders,
        currentMode
      );
      const result = response.data;

      const newOutputSignal = {
        data: result.outputSignal,
        sampleRate: result.sampleRate || apiSignal.sampleRate,
        duration: inputSignal.duration,
      };

      setOutputSignal(newOutputSignal);

      if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
      fftTimeoutRef.current = setTimeout(() => {
        computeFourierTransform(newOutputSignal, "output");
      }, 200);
    } catch (error) {
      showToast("❌ Equalization failed", "error");
    } finally {
      isProcessingRef.current = false;
    }
  }, [inputSignal, apiSignal, currentMode]);

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

  // === AUDIO PLAYBACK ENGINE (FIXED) ===
  useEffect(() => {
    if (!isPlaying || !inputSignal || !audioContextRef.current) return;

    // Capture offset to fix "Wrong way after first time" bug
    const initialTime = currentTime; 
    const startTime = audioContextRef.current.currentTime;

    const animate = () => {
      if (!audioContextRef.current) return;
      
      // Calculate elapsed time relative to Play Start
      const now = audioContextRef.current.currentTime;
      const timeElapsed = now - startTime;
      const newTime = initialTime + timeElapsed;
      
      if (newTime <= inputSignal.duration) {
        setCurrentTime(newTime); 
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(0);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, inputSignal]);

  const playAudio = (useSecondarySignal = false) => {
    const signalToPlay = useSecondarySignal ? getSecondarySignal() : getPrimarySignal();
    if (!signalToPlay || !signalToPlay.data) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    if (audioSourceRef.current) try { audioSourceRef.current.stop(); } catch (e) {}

    const audioBuffer = audioContext.createBuffer(1, signalToPlay.data.length, signalToPlay.sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < signalToPlay.data.length; i++) channelData[i] = signalToPlay.data[i];

    audioSourceRef.current = audioContext.createBufferSource();
    audioSourceRef.current.buffer = audioBuffer;
    audioSourceRef.current.playbackRate.value = playbackSpeed;
    audioSourceRef.current.connect(audioContext.destination);
    
    // Play
    audioSourceRef.current.start(0, currentTime);

    setIsPlaying(true);
    setIsPaused(false);
    setIsPlayingSecondary(useSecondarySignal);

    audioSourceRef.current.onended = () => {
      // Optional: Let the animation loop handle the state reset for smoother UI
    };
  };

  // === CONTROLLER HANDLERS ===
  const handlePlay = () => playAudio(false);
  const handlePause = () => {
    if (audioSourceRef.current && isPlaying) {
      audioSourceRef.current.stop();
      if (audioContextRef.current) setCurrentTime(currentTime); // Keep current UI time
      setIsPlaying(false);
      setIsPaused(true);
    }
  };
  const handleStop = () => {
    if (audioSourceRef.current) try { audioSourceRef.current.stop(); } catch(e) {}
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
  };
  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    setPlaybackSpeed(newSpeed);
    if (audioSourceRef.current && isPlaying) audioSourceRef.current.playbackRate.value = newSpeed;
  };
  const handleZoomIn = () => setZoom((prev) => Math.min(100, prev * 1.2));
  const handleZoomOut = () => setZoom((prev) => Math.max(1, prev / 1.2));
  const handleResetView = () => { setZoom(1); setPan(0); };
  const handleToggleAudio = () => {
    const newIsSecondary = !isPlayingSecondary;
    playAudio(newIsSecondary);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = event.target.result;
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const originalSignal = {
          data: Array.from(channelData),
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
        };

        setInputSignal(originalSignal);
        setOutputSignal(originalSignal);
        setApiSignal(originalSignal);
        setAiModelSignal(null);
        setAiModelFourierData(null);
        setComparisonMode(null);
        setShowAIGraphs(false);
        setHasAIStems(false);
        setSliders(prev => prev.filter(slider => !slider.isVoice));
        
        setCurrentTime(0);
        setIsPlaying(false);
        setIsPaused(false);
        setZoom(1);
        setPan(0);
        setPlaybackSpeed(1);
        setIsPlayingSecondary(false);

        computeFourierTransform(originalSignal, "input");
        computeFourierTransform(originalSignal, "output");
        showToast("✅ Audio file loaded successfully", "success");
      } catch (error) {
        showToast("❌ Error loading file.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleVoiceGainsUpdate = (voiceSliders) => {
    setSliders(prev => {
      const nonVoiceSliders = prev.filter(slider => !slider.isVoice);
      return [...nonVoiceSliders, ...voiceSliders];
    });
  };

  // === SLIDER HANDLER (Non-Exclusive for Musical Mode) ===
  const handleSliderChange = (sliderId, newValue) => {
    const updatedSliders = sliders.map((slider) =>
      slider.id === sliderId ? { ...slider, value: newValue } : slider
    );
    setSliders(updatedSliders);
    slidersRef.current = updatedSliders;

    if (inputSignal && apiSignal) {
      if (equalizationTimeoutRef.current)
        clearTimeout(equalizationTimeoutRef.current);
      
      equalizationTimeoutRef.current = setTimeout(() => {
        const changedSlider = updatedSliders.find(s => s.id === sliderId);

        // 1. AI Stems (Musical Mode)
        if (currentMode === "musical" && hasAIStems && aiModelRef.current) {
          aiModelRef.current.remixStems();
          // NO RETURN: Fall through to also trigger EQ
        } 
        
        // 2. AI Voices (Human Mode)
        if (changedSlider && changedSlider.isVoice && aiModelRef.current) {
          const voiceGains = {};
          updatedSliders.forEach(s => {
             if (s.isVoice && s.voiceKey) voiceGains[s.voiceKey] = s.value;
          });
          aiModelRef.current.remixVoices(voiceGains);
        }
        // Legacy manual AI mix
        else if (isAIMode && aiStems && currentMode !== "musical") {
          applyAIMixing();
        } 

        // 3. Standard Equalization
        // Execute this for Musical Mode (Dual Effect) and Generic Mode.
        if (!(isAIMode && aiStems && currentMode !== "musical")) {
           applyEqualization();
        }
        
      }, 150);
    }
  };

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
      setHasAIStems(false);
      
      if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
    } catch (error) {
      const fallback = getFallbackConfig(newMode);
      setSliders(fallback.sliders);
      slidersRef.current = fallback.sliders;
    }
  };

  const handleAIModelResult = (aiSignal) => {
    setAiModelSignal(aiSignal);
    setShowAIGraphs(true);
    setHasAIStems(true);
    setComparisonMode(null); 
    if (aiSignal.fourierData) setAiModelFourierData(aiSignal.fourierData);
    else computeFourierTransform(aiSignal, "ai");
  };

  // === EFFECTS ===
  useEffect(() => {
    const loadModeConfigs = async () => {
      setIsLoadingModes(true);
      try {
        const configs = await getAllModeConfigs();
        if (!configs) throw new Error("No mode configs");
        setModeConfigs(configs);
        if (configs[currentMode]) {
          setSliders(configs[currentMode].sliders);
          slidersRef.current = configs[currentMode].sliders;
        }
      } catch (error) {
        const fallback = getFallbackConfig(currentMode);
        setSliders(fallback.sliders);
        slidersRef.current = fallback.sliders;
      } finally {
        setIsLoadingModes(false);
      }
    };
    loadModeConfigs();
  }, []);

  useEffect(() => { slidersRef.current = sliders; }, [sliders]);

  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (sliders && sliders.length > 0) {
        const nonVoiceSliders = sliders.filter(slider => !slider.isVoice);
        if (nonVoiceSliders.length > 0) {
          saveSettings(currentMode, nonVoiceSliders);
          if (backendSyncTimeoutRef.current) clearTimeout(backendSyncTimeoutRef.current);
          backendSyncTimeoutRef.current = setTimeout(async () => {
            try { await autoSyncSliders(currentMode, nonVoiceSliders); } catch (e) {}
          }, 2000);
        }
      }
    }, 500);
    return () => {
      clearTimeout(saveTimeout);
      if (backendSyncTimeoutRef.current) clearTimeout(backendSyncTimeoutRef.current);
    };
  }, [sliders, currentMode]);

  useEffect(() => {
    if (apiSignal) computeFourierTransform(apiSignal, "input");
    if (outputSignal && apiSignal) computeFourierTransform(apiSignal, "output");
    if (aiModelSignal) computeFourierTransform(aiModelSignal, "ai");
  }, [fftScale]);

  return (
    <div className="App">
      {toast.visible && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <AppHeader
        currentMode={currentMode}
        isLoadingModes={isLoadingModes}
        fileInputRef={fileInputRef}
        sliders={sliders.filter(s => !s.isVoice)}
        inputSignal={inputSignal}
        apiSignal={apiSignal}
        onModeChange={handleModeChange}
        onFileUpload={handleFileUpload}
        onReloadConfig={async () => {
          setIsLoadingModes(true);
          try {
            clearCache();
            const configs = await getAllModeConfigs(null, true);
            setModeConfigs(configs);
            if (configs[currentMode]) {
              const currentVoiceSliders = sliders.filter(s => s.isVoice);
              const newBaseSliders = configs[currentMode].sliders;
              setSliders([...newBaseSliders, ...currentVoiceSliders]);
              slidersRef.current = [...newBaseSliders, ...currentVoiceSliders];
              if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
            }
            showToast("✅ Reloaded", "success");
          } catch (e) { showToast("❌ Failed", "error"); }
          finally { setIsLoadingModes(false); }
        }}
        onResetDefaults={async () => {
          clearCache();
          setIsLoadingModes(true);
          try {
            await apiService.resetModes();
            clearSettings(currentMode);
            const configs = await getAllModeConfigs(null, true);
            setModeConfigs(configs);
            if (configs[currentMode]) {
              const currentVoiceSliders = sliders.filter(s => s.isVoice);
              const newBaseSliders = configs[currentMode].sliders;
              setSliders([...newBaseSliders, ...currentVoiceSliders]);
              slidersRef.current = [...newBaseSliders, ...currentVoiceSliders];
            }
            showToast("✅ Reset", "success");
            if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
          } catch (e) { showToast("❌ Reset Failed", "error"); }
          finally { setIsLoadingModes(false); }
        }}
        onLoadSettings={(s) => {
          setCurrentMode(s.mode);
          const currentVoiceSliders = sliders.filter(slider => slider.isVoice);
          const combinedSliders = [...s.sliders, ...currentVoiceSliders];
          setSliders(combinedSliders);
          slidersRef.current = combinedSliders;
          if (inputSignal && apiSignal) setTimeout(() => applyEqualization(), 100);
        }}
        onToast={showToast}
      />

      {showSliderModal && (
        <SliderCreationModal
          onCreate={(newSlider) => {
            setSliders([...sliders, newSlider]);
            setShowSliderModal(false);
            if (equalizationTimeoutRef.current) clearTimeout(equalizationTimeoutRef.current);
            equalizationTimeoutRef.current = setTimeout(() => applyEqualization(), 100);
          }}
          onCancel={() => setShowSliderModal(false)}
        />
      )}

      <div className="main-content">
        {isAIModeEnabled && (
          <div className="ai-section">
            <AIModelSection
              ref={aiModelRef}
              mode={currentMode}
              inputSignal={inputSignal}
              outputSignal={outputSignal}
              sliders={sliders}
              onModelResult={handleAIModelResult}
              onComparisonChange={setComparisonMode}
              onVoiceGainsUpdate={handleVoiceGainsUpdate}
            />
          </div>
        )}

        <div className="sliders-section">
          <div className="sliders-header">
            <div className="sliders-title">
              <h3>{modeConfigs?.[currentMode]?.icon || "⚙️"} {modeConfigs?.[currentMode]?.name || "Unknown"} Equalizer</h3>
              {currentMode === "musical" && hasAIStems && (
                <div className="ai-integration-badge">
                  <span className="ai-badge-icon">🤖</span><span>AI Stems Active</span>
                </div>
              )}
            </div>
            {canAddCustomSliders() && !hasAIStems && (
              <button className="add-slider-btn-compact" onClick={() => setShowSliderModal(true)}>➕</button>
            )}
          </div>

          <div className="compact-sliders-grid">
            {sliders.map((slider) => (
              <EqualizerSlider
                key={slider.id}
                slider={slider}
                onChange={handleSliderChange}
                onRemove={canAddCustomSliders() && !slider.isVoice ? (id) => {
                  setSliders((prev) => prev.filter((s) => s.id !== id));
                  if (equalizationTimeoutRef.current) clearTimeout(equalizationTimeoutRef.current);
                  equalizationTimeoutRef.current = setTimeout(() => applyEqualization(), 100);
                } : null}
                isAIControlled={(currentMode === "musical" && hasAIStems) || (currentMode === "human" && slider.isVoice)}
                compact={true}
                ultra={true}
              />
            ))}
          </div>
          {hasAIStems && <div className="ai-controls-info-compact"><span>🎛️ AI Stem Control Active</span></div>}
        </div>

        {inputSignal && (
          <CineController
            isPlaying={isPlaying}
            isPaused={isPaused}
            playbackSpeed={playbackSpeed}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onSpeedChange={handleSpeedChange}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleResetView}
            currentTime={currentTime}
            duration={inputSignal?.duration || 0}
            onToggleAudio={handleToggleAudio}
            isPlayingOriginal={!isPlayingSecondary}
          />
        )}

        <div className="signals-section">
          <div className="signals-with-spectrograms">
            <div className="signal-spectro-layout">
              <div className="signal-viewers-stack">
                <SignalViewer
                  signal={getSignalByType("input")}
                  title={`📺 ${getTitleByType("input")}`}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  zoom={zoom}
                  pan={pan}
                  onPanChange={setPan}
                  onZoomChange={setZoom}
                  isCineMode={true}
                />
                <SignalViewer
                  signal={getSignalByType("output")}
                  title={`📺 ${getTitleByType("output")}`}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  zoom={zoom}
                  pan={pan}
                  onPanChange={setPan}
                  onZoomChange={setZoom}
                  isCineMode={true}
                />
              </div>

              {showSpectrograms && (
                <div className="spectrograms-container">
                  <div className="spectrogram-controls">
                    <h4>📈 Spectrograms</h4>
                    <button className={`toggle-btn-mini ${showSpectrograms ? "active" : ""}`} onClick={() => setShowSpectrograms(!showSpectrograms)}>
                      {showSpectrograms ? "👁️" : "👁"}
                    </button>
                  </div>
                  <div className="spectrograms-pair">
                    <Spectrogram signal={getSignalByType("input")} title={getTitleByType("input") + " Spectrogram"} visible={showSpectrograms} compact={true} />
                    <Spectrogram signal={getSignalByType("output")} title={getTitleByType("output") + " Spectrogram"} visible={showSpectrograms} compact={true} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="fft-section">
          <div className="fft-header">
            <h3>📊 Fourier Transform</h3>
            <div className="fft-controls">
              <select value={fftScale} onChange={(e) => setFftScale(e.target.value)} className="scale-selector-mini">
                <option value="linear">Linear</option>
                <option value="audiogram">Audiogram</option>
              </select>
            </div>
          </div>
          <div className="fft-graphs">
            <FourierGraph fourierData={getFourierDataByType("input")} scale={fftScale} title={getTitleByType("input", true)} isLoading={isLoadingFFT} error={fftError} compact={true} />
            <FourierGraph fourierData={getFourierDataByType("output")} scale={fftScale} title={getTitleByType("output", true)} isLoading={isLoadingFFT} error={fftError} compact={true} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainPage;