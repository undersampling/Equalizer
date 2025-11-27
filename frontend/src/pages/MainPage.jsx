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
  const [toast, setToast] = useState({
    message: "",
    type: "success",
    visible: false,
  });
  const [currentMode, setCurrentMode] = useState("generic");
  const [sliders, setSliders] = useState([]);
  const [modeConfigs, setModeConfigs] = useState(null);
  const [isLoadingModes, setIsLoadingModes] = useState(true);

  // Signals
  const [inputSignal, setInputSignal] = useState(null);
  const [outputSignal, setOutputSignal] = useState(null);
  const [apiSignal, setApiSignal] = useState(null); // Stores the original signal for processing
  const [aiModelSignal, setAiModelSignal] = useState(null);

  // PREVIEW DATA (Spectrogram Only)
  const [previewSpectrogramData, setPreviewSpectrogramData] = useState(null);

  // Fourier Data
  const [inputFourierData, setInputFourierData] = useState(null);
  const [outputFourierData, setOutputFourierData] = useState(null);
  const [aiModelFourierData, setAiModelFourierData] = useState(null);

  // Playback & View
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isPlayingSecondary, setIsPlayingSecondary] = useState(false);

  // UI Toggles & Data
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
  const isStoppedManuallyRef = useRef(false);
  const lastPreviewTimeRef = useRef(0);

  // --- Helpers ---
  const showToast = (message, type = "success") => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
  };
  const isAIModeEnabled = currentMode === "musical" || currentMode === "human";
  const allSlidersAtUnity = useCallback(() => {
    if (!sliders || sliders.length === 0) return true;
    const eqSliders = sliders.filter((s) => !s.isVoice);
    return eqSliders.every((slider) => Math.abs(slider.value - 1.0) < 0.0001);
  }, [sliders]);
  const canAddCustomSliders = () =>
    modeConfigs &&
    modeConfigs[currentMode] &&
    allowsCustomSliders(modeConfigs[currentMode]);

  // --- Signal Getters ---
  const getPrimarySignal = useCallback(
    () =>
      comparisonMode === "equalizer_vs_ai"
        ? allSlidersAtUnity() && inputSignal
          ? inputSignal
          : outputSignal
        : inputSignal,
    [comparisonMode, inputSignal, outputSignal, allSlidersAtUnity]
  );
  const getSecondarySignal = useCallback(() => {
    if (comparisonMode === "ai") return aiModelSignal;
    if (comparisonMode === "slider")
      return allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
    if (comparisonMode === "equalizer_vs_ai") return aiModelSignal;
    return outputSignal;
  }, [
    comparisonMode,
    inputSignal,
    outputSignal,
    aiModelSignal,
    allSlidersAtUnity,
  ]);
  const getSignalByType = (type) => {
    if (comparisonMode === "equalizer_vs_ai")
      return type === "input"
        ? allSlidersAtUnity() && inputSignal
          ? inputSignal
          : outputSignal
        : aiModelSignal;
    if (comparisonMode === "ai")
      return type === "input" ? inputSignal : aiModelSignal;
    if (comparisonMode === "slider")
      return type === "input"
        ? inputSignal
        : allSlidersAtUnity() && inputSignal
        ? inputSignal
        : outputSignal;
    return type === "input" ? inputSignal : outputSignal;
  };
  const getTitleByType = (type, isFFT = false) => {
    const suffix = isFFT ? " FFT" : " Signal";
    const aiSuffix = hasAIStems ? " Stem Mix" : " Output";
    if (comparisonMode === "equalizer_vs_ai")
      return type === "input" ? `Equalizer${suffix}` : `AI Model${suffix}`;
    if (comparisonMode === "ai")
      return type === "input"
        ? `Input${suffix} (Original)`
        : `AI Model${suffix}`;
    if (comparisonMode === "slider")
      return type === "input"
        ? `Input${suffix} (Original)`
        : `Equalizer${suffix}`;
    return type === "input"
      ? `Input${suffix} (Original)`
      : hasAIStems
      ? `AI${aiSuffix}${suffix}`
      : `Equalizer${suffix}`;
  };
  const getFourierDataByType = (type) => {
    if (comparisonMode === "equalizer_vs_ai")
      return type === "input" ? outputFourierData : aiModelFourierData;
    if (comparisonMode === "ai")
      return type === "input" ? inputFourierData : aiModelFourierData;
    if (comparisonMode === "slider")
      return type === "input" ? inputFourierData : outputFourierData;
    return type === "input" ? inputFourierData : outputFourierData;
  };

  // --- Compute FFT (Optimized with Silent Mode) ---
  const computeFourierTransform = async (signal, type, silent = false) => {
    if (!signal || !signal.data || signal.data.length === 0) return;

    // Only show spinner if NOT silent
    if (!silent) setIsLoadingFFT(true);
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
    } catch (error) {
      setIsLoadingFFT(false);
      setFftError(error.message);
    }
  };

  // --- Apply Equalization (Core Logic) ---
  // --- Apply Equalization (Core Logic) ---
const applyEqualization = useCallback(
  async (isPreview = false) => {
    if (!inputSignal || !apiSignal || isProcessingRef.current) return;

    // Don't lock processing for previews
    if (!isPreview) isProcessingRef.current = true;

    try {
      // Ensure we ONLY send the original EQ sliders, filtering out voice sliders
      const eqSliders = slidersRef.current.filter((s) => !s.isVoice);
      
      console.log(`Applying equalization (preview: ${isPreview}) with ${eqSliders.length} sliders:`, eqSliders); // Debug log

      const response = await apiService.equalize(
        apiSignal.data,
        apiSignal.sampleRate,
        eqSliders,
        currentMode,
        isPreview // true = fast spectrogram, false = full audio
      );

      if (isPreview) {
        // PREVIEW MODE: Update ONLY the spectrogram graph immediately
        if (response.data.spectrogram) {
          console.log("Setting preview spectrogram data"); // Debug log
          setPreviewSpectrogramData(response.data.spectrogram);
        } else {
          console.warn("No spectrogram data in preview response"); // Debug log
        }
      } else {
        // FULL MODE: Update the Audio Signal
        const result = response.data;
        const newOutputSignal = {
          data: result.outputSignal,
          sampleRate: result.sampleRate || apiSignal.sampleRate,
          duration: inputSignal.duration,
        };

        console.log("Setting new output signal"); // Debug log
        setOutputSignal(newOutputSignal);

        // Update FFT silently
        if (fftTimeoutRef.current) clearTimeout(fftTimeoutRef.current);
        fftTimeoutRef.current = setTimeout(() => {
          computeFourierTransform(newOutputSignal, "output", true); // silent=true
        }, 100);
      }
    } catch (error) {
      console.error("Equalization error:", error); // Debug log
      if (!isPreview) showToast("❌ Equalization failed", "error");
    } finally {
      if (!isPreview) isProcessingRef.current = false;
    }
  },
  [inputSignal, apiSignal, currentMode]
);

  // --- Apply AI Mixing ---
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
        computeFourierTransform(newOutputSignal, "output", true);
        computeFourierTransform(newOutputSignal, "ai", true);
      }, 200);
    } catch (error) {
      showToast("❌ AI mixing failed", "error");
    } finally {
      isProcessingRef.current = false;
    }
  }, [inputSignal, aiStems]);

  // --- Slider Handler ---
  // --- Slider Handler ---
const handleSliderChange = (sliderId, newValue) => {
  const updatedSliders = sliders.map((slider) =>
    slider.id === sliderId ? { ...slider, value: newValue } : slider
  );
  setSliders(updatedSliders);
  slidersRef.current = updatedSliders;

  // Determine what kind of slider changed
  const changedSlider = updatedSliders.find((s) => s.id === sliderId);
  const isVoiceSlider = changedSlider?.isVoice;

  if (inputSignal && apiSignal) {
    const now = Date.now();

    if (isVoiceSlider) {
      // === CLEAR PREVIEW DATA ===
      // If we are moving a voice slider, the EQ preview data is irrelevant and causes visual glitches.
      if (previewSpectrogramData) setPreviewSpectrogramData(null);
      
      // Debounce AI Processing
      if (equalizationTimeoutRef.current) clearTimeout(equalizationTimeoutRef.current);
      equalizationTimeoutRef.current = setTimeout(() => {
           if (aiModelRef.current) {
              const voiceGains = {};
              updatedSliders.forEach((s) => {
                if (s.isVoice && s.voiceKey) voiceGains[s.voiceKey] = s.value;
              });
              aiModelRef.current.remixVoices(voiceGains);
          }
      }, 300);

    } else {
      // === ORIGINAL EQ SLIDER CHANGED ===
      // 1. Fast Preview (ALWAYS for non-voice sliders in generic/human/musical modes)
      if (now - lastPreviewTimeRef.current > 50) {
        console.log("Triggering fast preview for slider:", sliderId); // Debug log
        applyEqualization(true); // isPreview = true
        lastPreviewTimeRef.current = now;
      }

      // 2. Full Update
      if (equalizationTimeoutRef.current) clearTimeout(equalizationTimeoutRef.current);
      equalizationTimeoutRef.current = setTimeout(() => {
          console.log("Triggering full update for slider:", sliderId); // Debug log
          
          if (currentMode === "musical" && hasAIStems && aiModelRef.current) {
              aiModelRef.current.remixStems();
          } else if (currentMode === "human" && aiStems) {
              applyAIMixing();
          } else {
              // FIXED: Always apply EQ for generic mode and when not in AI override mode
              applyEqualization(false);
          }
      }, 300);
    }
  }
};

  // --- Mode Change ---
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
      setPreviewSpectrogramData(null); // CLEAR PREVIEW HERE

      if (inputSignal && apiSignal)
        setTimeout(() => applyEqualization(false), 100);
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
    
    // Clear any stuck EQ preview data to force spectrogram to render the new AI signal
    setPreviewSpectrogramData(null);

    if (aiSignal.fourierData) setAiModelFourierData(aiSignal.fourierData);
    else computeFourierTransform(aiSignal, "ai");
  };

  // --- File Upload ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!audioContextRef.current)
          audioContextRef.current = new (window.AudioContext ||
            window.webkitAudioContext)();

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

        // 1. Set Input State
        setInputSignal(originalSignal);
        setApiSignal(originalSignal);

        // Reset generic UI states
        setAiModelSignal(null);
        setAiModelFourierData(null);
        setComparisonMode(null);
        setShowAIGraphs(false);
        setHasAIStems(false);
        setPreviewSpectrogramData(null);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsPaused(false);

        // 2. CHECK EXISTING SLIDERS
        const currentSliders = slidersRef.current.filter((s) => !s.isVoice);
        const hasChanges = currentSliders.some(
          (s) => Math.abs(s.value - 1.0) > 0.001
        );

        if (hasChanges) {
          showToast("⏳ Processing with current sliders...", "info");
          try {
            const response = await apiService.equalize(
              originalSignal.data,
              originalSignal.sampleRate,
              currentSliders,
              currentMode,
              false
            );
            const result = response.data;
            const processedSignal = {
              data: result.outputSignal,
              sampleRate: result.sampleRate || originalSignal.sampleRate,
              duration: originalSignal.duration,
            };
            setOutputSignal(processedSignal);
            computeFourierTransform(processedSignal, "output"); 
          } catch (error) {
            console.error(error);
            setOutputSignal(originalSignal);
            computeFourierTransform(originalSignal, "output");
          }
        } else {
          setOutputSignal(originalSignal);
          computeFourierTransform(originalSignal, "output");
        }
        computeFourierTransform(originalSignal, "input");
        showToast("✅ Audio file loaded successfully", "success");
      } catch (error) {
        console.error(error);
        showToast("❌ Error loading file.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleVoiceGainsUpdate = (voiceSliders) => {
    setSliders((prev) => {
      const nonVoiceSliders = prev.filter((slider) => !slider.isVoice);
      return [...nonVoiceSliders, ...voiceSliders];
    });
  };

  // --- Audio Playback Logic ---
  const playAudioFromTime = useCallback(
  (startTime, useSecondarySignal = false) => {
    let signalToPlay;
    if (useSecondarySignal) {
      if (comparisonMode === "ai") signalToPlay = aiModelSignal;
      else if (comparisonMode === "slider")
        signalToPlay = allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
      else if (comparisonMode === "equalizer_vs_ai")
        signalToPlay = aiModelSignal;
      else signalToPlay = outputSignal;
    } else {
      if (comparisonMode === "equalizer_vs_ai")
        signalToPlay = allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
      else signalToPlay = inputSignal;
    }

    if (!signalToPlay || !signalToPlay.data) return;
    
    if (!audioContextRef.current)
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    const audioContext = audioContextRef.current;

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Stop any existing audio
    if (audioSourceRef.current) {
      isStoppedManuallyRef.current = true;
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
    }

    const audioBuffer = audioContext.createBuffer(
      1,
      signalToPlay.data.length,
      signalToPlay.sampleRate
    );
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < signalToPlay.data.length; i++) {
      channelData[i] = signalToPlay.data[i];
    }

    audioSourceRef.current = audioContext.createBufferSource();
    audioSourceRef.current.buffer = audioBuffer;
    audioSourceRef.current.playbackRate.value = playbackSpeed;
    audioSourceRef.current.connect(audioContext.destination);

    isStoppedManuallyRef.current = false;
    audioSourceRef.current.start(0, startTime);

    // CRITICAL FIX: Set currentTime here for animation sync
    setCurrentTime(startTime);
    setIsPlaying(true);
    setIsPaused(false);
    setIsPlayingSecondary(useSecondarySignal);

    audioSourceRef.current.onended = () => {
      if (!isStoppedManuallyRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(inputSignal?.duration || 0);
      }
    };
  },
  [
    playbackSpeed,
    comparisonMode,
    inputSignal,
    outputSignal,
    aiModelSignal,
    allSlidersAtUnity,
  ]
);
  const playAudio = useCallback(
    (useSecondarySignal = false) => {
      playAudioFromTime(currentTime, useSecondarySignal);
    },
    [currentTime, playAudioFromTime]
  );
  const handlePlay = () => playAudio(isPlayingSecondary);
  const handlePause = () => {
  if (isPlaying) {
    // CRITICAL FIX: Capture current audio time before stopping
    if (audioSourceRef.current && audioContextRef.current) {
      // Calculate current position based on when audio started
      const audioStartTime = audioContextRef.current.currentTime - (currentTime / playbackSpeed);
      const actualCurrentTime = audioContextRef.current.currentTime - audioStartTime;
      setCurrentTime(actualCurrentTime); // Update to exact position
    }

    isStoppedManuallyRef.current = true;
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(true);
  }
};
  const handleStop = () => {
    isStoppedManuallyRef.current = true;
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
  };
  const handleSeek = useCallback(
  (seekTime) => {
    if (!inputSignal) return;

    // CRITICAL FIX: Always update currentTime immediately
    setCurrentTime(seekTime);

    if (isPlaying) {
      // Stop current audio and animation
      if (audioSourceRef.current) {
        isStoppedManuallyRef.current = true;
        try {
          audioSourceRef.current.stop();
        } catch (e) {}
        audioSourceRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // CRITICAL FIX: Force animation restart by toggling isPlaying
      setIsPlaying(false);
      setTimeout(() => {
        setIsPlaying(true); // This will trigger the useEffect to restart animation
        playAudioFromTime(seekTime, isPlayingSecondary);
      }, 10);
    } else {
      setIsPaused(true);
    }
  },
  [inputSignal, isPlaying, isPlayingSecondary, playAudioFromTime]
);

  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    setPlaybackSpeed(newSpeed);
    if (audioSourceRef.current && isPlaying)
      audioSourceRef.current.playbackRate.value = newSpeed;
  };
  const handleZoomIn = () => setZoom((prev) => Math.min(100, prev * 1.2));
  const handleZoomOut = () => setZoom((prev) => Math.max(1, prev / 1.2));
  const handleResetView = () => {
    setZoom(1);
    setPan(0);
  };
  const handleToggleAudio = () => {
  const newIsSecondary = !isPlayingSecondary;
  
  if (isPlaying) {
    // CRITICAL FIX: Capture current time before stopping
    let currentPos = currentTime;
    if (audioSourceRef.current && audioContextRef.current) {
      // More accurate time calculation
      const now = audioContextRef.current.currentTime;
      // Estimate start time based on current position and playback speed
      const estimatedStartTime = now - (currentTime / playbackSpeed);
      currentPos = (now - estimatedStartTime) * playbackSpeed;
      setCurrentTime(currentPos);
    }

    // Stop current audio
    if (audioSourceRef.current) {
      isStoppedManuallyRef.current = true;
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }

    // Update secondary signal state
    setIsPlayingSecondary(newIsSecondary);

    // CRITICAL FIX: Force animation restart
    setIsPlaying(false);
    setTimeout(() => {
      setIsPlaying(true); // This triggers useEffect to restart animation
      playAudioFromTime(currentPos, newIsSecondary);
    }, 10);
  } else {
    setIsPlayingSecondary(newIsSecondary);
  }
};

  useEffect(() => {
  if (!isPlaying || !inputSignal || !audioContextRef.current) {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    return;
  }

  // Store the initial state for this animation session
  const sessionStartTime = audioContextRef.current.currentTime;
  const sessionInitialTime = currentTime;

  const animate = () => {
    if (!audioContextRef.current || !isPlaying) {
      return;
    }

    const now = audioContextRef.current.currentTime;
    const audioElapsed = now - sessionStartTime;
    const newTime = sessionInitialTime + audioElapsed * playbackSpeed;

    if (newTime <= inputSignal.duration) {
      setCurrentTime(newTime);
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      handleStop();
    }
  };

  animationFrameRef.current = requestAnimationFrame(animate);

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };
}, [isPlaying, inputSignal, playbackSpeed, currentTime]);

  useEffect(() => {
    if (apiSignal) computeFourierTransform(apiSignal, "input", true);
    if (outputSignal) computeFourierTransform(outputSignal, "output", true);
    if (aiModelSignal) computeFourierTransform(aiModelSignal, "ai", true);
  }, [fftScale]);

  useEffect(() => {
    const loadModeConfigs = async () => {
      setIsLoadingModes(true);
      try {
        const configs = await getAllModeConfigs();
        setModeConfigs(configs);
        if (configs[currentMode]) {
          setSliders(configs[currentMode].sliders);
          slidersRef.current = configs[currentMode].sliders;
        }
      } finally {
        setIsLoadingModes(false);
      }
    };
    loadModeConfigs();
  }, []);

  useEffect(() => {
    slidersRef.current = sliders;
  }, [sliders]);
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (sliders.length > 0) {
        const nonVoice = sliders.filter((s) => !s.isVoice);
        if (nonVoice.length > 0) {
          saveSettings(currentMode, nonVoice);
          if (backendSyncTimeoutRef.current)
            clearTimeout(backendSyncTimeoutRef.current);
          backendSyncTimeoutRef.current = setTimeout(async () => {
            try {
              await autoSyncSliders(currentMode, nonVoice);
            } catch (e) {}
          }, 2000);
        }
      }
    }, 500);
    return () => {
      clearTimeout(saveTimeout);
      if (backendSyncTimeoutRef.current)
        clearTimeout(backendSyncTimeoutRef.current);
    };
  }, [sliders, currentMode]);

  useEffect(() => {
    return () => {
      isStoppedManuallyRef.current = true;
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {}
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // === SPECTROGRAM PREVIEW LOGIC FIX ===
  // This function decides if we should pass the Equalizer Preview Data to a specific graph.
  // We ONLY want to pass it if the graph is currently displaying the Equalizer Output.
  const getOverrideData = (type) => {
      if (!previewSpectrogramData) return null;

      // Logic: 
      // 1. If mode is 'equalizer_vs_ai', "input" graph shows EQ, "output" graph shows AI.
      //    Therefore, pass preview ONLY to "input".
      // 2. If mode is 'ai' (Original vs AI), neither shows EQ. Pass NULL.
      // 3. If mode is normal (Original vs EQ), "output" graph shows EQ. Pass preview to "output".

      if (comparisonMode === "equalizer_vs_ai") {
          return type === "input" ? previewSpectrogramData : null; 
      } else if (comparisonMode === "ai") {
          return null;
      } else {
          // Default comparison (slider or null): Output is Equalizer
          return type === "output" ? previewSpectrogramData : null;
      }
  };

  return (
    <div className="App">
      {toast.visible && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
      <AppHeader
        currentMode={currentMode}
        isLoadingModes={isLoadingModes}
        fileInputRef={fileInputRef}
        sliders={sliders.filter((s) => !s.isVoice)}
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
              const currentVoiceSliders = sliders.filter((s) => s.isVoice);
              const newBaseSliders = configs[currentMode].sliders;
              setSliders([...newBaseSliders, ...currentVoiceSliders]);
              slidersRef.current = [...newBaseSliders, ...currentVoiceSliders];
              if (inputSignal && apiSignal)
                setTimeout(() => applyEqualization(false), 100);
            }
            showToast("✅ Reloaded", "success");
          } catch (e) {
            showToast("❌ Failed", "error");
          } finally {
            setIsLoadingModes(false);
          }
        }}
        onResetDefaults={async () => {
          clearCache();
          setIsLoadingModes(true);
          try {
            setPreviewSpectrogramData(null);
            await apiService.resetModes();
            clearSettings(currentMode);
            const configs = await getAllModeConfigs(null, true);
            setModeConfigs(configs);
            if (configs[currentMode]) {
              const currentVoiceSliders = sliders.filter((s) => s.isVoice);
              const newBaseSliders = configs[currentMode].sliders;
              setSliders([...newBaseSliders, ...currentVoiceSliders]);
              slidersRef.current = [...newBaseSliders, ...currentVoiceSliders];
            }
            showToast("✅ Reset", "success");
            if (inputSignal && apiSignal)
              setTimeout(() => applyEqualization(false), 100);
          } catch (e) {
            showToast("❌ Reset Failed", "error");
          } finally {
            setIsLoadingModes(false);
          }
        }}
        onLoadSettings={(s) => {
          setCurrentMode(s.mode);
          const currentVoiceSliders = sliders.filter(
            (slider) => slider.isVoice
          );
          const combinedSliders = [...s.sliders, ...currentVoiceSliders];
          setSliders(combinedSliders);
          slidersRef.current = combinedSliders;
          if (inputSignal && apiSignal)
            setTimeout(() => applyEqualization(false), 100);
        }}
        onToast={showToast}
      />

      {showSliderModal && (
        <SliderCreationModal
          onCreate={(newSlider) => {
            setSliders([...sliders, newSlider]);
            setShowSliderModal(false);
            setTimeout(() => applyEqualization(false), 100);
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
              <h3>
                {modeConfigs?.[currentMode]?.icon}{" "}
                {modeConfigs?.[currentMode]?.name} Equalizer
              </h3>
            </div>
            {canAddCustomSliders() && !hasAIStems && (
              <button
                className="add-slider-btn-compact"
                onClick={() => setShowSliderModal(true)}
              >
                ➕
              </button>
            )}
          </div>
          <div className="compact-sliders-grid">
            {sliders.map((slider) => (
              <EqualizerSlider
                key={slider.id}
                slider={slider}
                onChange={handleSliderChange}
                onRemove={
                  canAddCustomSliders() && !slider.isVoice
                    ? (id) => {
                        setSliders((prev) => prev.filter((s) => s.id !== id));
                        setPreviewSpectrogramData(null);
                        setTimeout(() => applyEqualization(false), 100);
                      }
                    : null
                }
                isAIControlled={
                  (currentMode === "musical" && hasAIStems) ||
                  (currentMode === "human" && slider.isVoice)
                }
                compact={true}
                ultra={true}
              />
            ))}
          </div>
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
            duration={inputSignal.duration}
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
                  onSeek={handleSeek}
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
                  onSeek={handleSeek}
                />
              </div>
              <div className="spectrograms-container">
                <div className="spectrogram-controls">
                  <h4>📈 Spectrograms</h4>
                  <button
                    className={`toggle-btn-mini ${
                      showSpectrograms ? "active" : ""
                    }`}
                    onClick={() => setShowSpectrograms(!showSpectrograms)}
                  >
                    {showSpectrograms ? "Hide" : "Show"}
                  </button>
                </div>
                {showSpectrograms && (
                  <div className="spectrograms-pair">
                    <Spectrogram
                      signal={getSignalByType("input")}
                      title={getTitleByType("input") + " Spectrogram"}
                      overrideData={getOverrideData("input")}
                      visible={showSpectrograms}
                      compact={true}
                    />
                    <Spectrogram
                      signal={getSignalByType("output")}
                      title={getTitleByType("output") + " Spectrogram"}
                      overrideData={getOverrideData("output")}
                      visible={showSpectrograms}
                      compact={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="fft-section">
          <div className="fft-header">
            <h3>📊 Fourier Transform</h3>
            <div className="fft-controls">
              <select
                value={fftScale}
                onChange={(e) => setFftScale(e.target.value)}
                className="scale-selector-mini"
              >
                <option value="linear">Linear</option>
                <option value="audiogram">Audiogram</option>
              </select>
            </div>
          </div>
          <div className="fft-graphs">
            <FourierGraph
              fourierData={getFourierDataByType("input")}
              scale={fftScale}
              title={getTitleByType("input", true)}
              isLoading={isLoadingFFT}
              error={fftError}
              compact={true}
            />
            <FourierGraph
              fourierData={getFourierDataByType("output")}
              scale={fftScale}
              title={getTitleByType("output", true)}
              isLoading={isLoadingFFT}
              error={fftError}
              compact={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainPage;