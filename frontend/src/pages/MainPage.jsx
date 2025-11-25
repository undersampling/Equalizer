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
  const isStoppedManuallyRef = useRef(false); // Track if audio was stopped manually

  // === HELPER FUNCTIONS ===
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

  const canAddCustomSliders = () => {
    if (!modeConfigs || !modeConfigs[currentMode]) return false;
    return allowsCustomSliders(modeConfigs[currentMode]);
  };

  // === SIGNAL SELECTION ===
  const getPrimarySignal = useCallback(() => {
    if (comparisonMode === "equalizer_vs_ai") {
      return allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
    }
    return inputSignal;
  }, [comparisonMode, inputSignal, outputSignal, allSlidersAtUnity]);

  const getSecondarySignal = useCallback(() => {
    if (comparisonMode === "ai") {
      return aiModelSignal;
    } else if (comparisonMode === "slider") {
      return allSlidersAtUnity() && inputSignal ? inputSignal : outputSignal;
    } else if (comparisonMode === "equalizer_vs_ai") {
      return aiModelSignal;
    } else {
      return outputSignal;
    }
  }, [
    comparisonMode,
    inputSignal,
    outputSignal,
    aiModelSignal,
    allSlidersAtUnity,
  ]);

  const getSignalByType = (type) => {
    if (comparisonMode === "equalizer_vs_ai") {
      return type === "input"
        ? allSlidersAtUnity() && inputSignal
          ? inputSignal
          : outputSignal
        : aiModelSignal;
    }

    if (comparisonMode === "ai") {
      return type === "input" ? inputSignal : aiModelSignal;
    }

    if (comparisonMode === "slider") {
      return type === "input"
        ? inputSignal
        : allSlidersAtUnity() && inputSignal
        ? inputSignal
        : outputSignal;
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
      return type === "input"
        ? `Input${suffix} (Original)`
        : `AI Model${suffix}`;
    }
    if (comparisonMode === "slider") {
      return type === "input"
        ? `Input${suffix} (Original)`
        : `Equalizer${suffix}`;
    }
    return type === "input"
      ? `Input${suffix} (Original)`
      : hasAIStems
      ? `AI${aiSuffix}${suffix}`
      : `Equalizer${suffix}`;
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
      const eqSliders = slidersRef.current.filter((s) => !s.isVoice);

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

  // === AUDIO PLAYBACK ENGINE ===

  // === AUDIO PLAYBACK ENGINE ===

  // Animation loop for updating currentTime during playback
  useEffect(() => {
    if (!isPlaying || !inputSignal || !audioContextRef.current) return;

    const initialTime = currentTime;
    const startTime = audioContextRef.current.currentTime;

    const animate = () => {
      if (!audioContextRef.current || !isPlaying) return;

      const now = audioContextRef.current.currentTime;
      const timeElapsed = now - startTime;
      const newTime = initialTime + timeElapsed * playbackSpeed;

      if (newTime <= inputSignal.duration) {
        setCurrentTime(newTime);
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Reached end of audio naturally - RESET TO START
        isStoppedManuallyRef.current = true; // Prevent onended from also triggering

        if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
          } catch (e) {}
          audioSourceRef.current = null;
        }

        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(0); // RESET TO 0
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, inputSignal, playbackSpeed]);

  // Play audio from a specific time
  // Play audio from a specific time
  const playAudioFromTime = useCallback(
    (startTime, useSecondarySignal = false) => {
      let signalToPlay;
      if (useSecondarySignal) {
        if (comparisonMode === "ai") {
          signalToPlay = aiModelSignal;
        } else if (comparisonMode === "slider") {
          const unity = sliders
            .filter((s) => !s.isVoice)
            .every((slider) => Math.abs(slider.value - 1.0) < 0.0001);
          signalToPlay = unity && inputSignal ? inputSignal : outputSignal;
        } else if (comparisonMode === "equalizer_vs_ai") {
          signalToPlay = aiModelSignal;
        } else {
          signalToPlay = outputSignal;
        }
      } else {
        if (comparisonMode === "equalizer_vs_ai") {
          const unity = sliders
            .filter((s) => !s.isVoice)
            .every((slider) => Math.abs(slider.value - 1.0) < 0.0001);
          signalToPlay = unity && inputSignal ? inputSignal : outputSignal;
        } else {
          signalToPlay = inputSignal;
        }
      }

      if (!signalToPlay || !signalToPlay.data) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // Stop any existing source
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

      // Start from the specified time
      isStoppedManuallyRef.current = false;
      audioSourceRef.current.start(0, startTime);

      // Update state
      setCurrentTime(startTime);
      setIsPlaying(true);
      setIsPaused(false);
      setIsPlayingSecondary(useSecondarySignal);

      // Handle natural end of audio (not manual stop) - RESET TO START
      audioSourceRef.current.onended = () => {
        if (!isStoppedManuallyRef.current) {
          // Audio ended naturally - reset to beginning
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTime(0); // RESET TO 0
        }
      };
    },
    [
      playbackSpeed,
      comparisonMode,
      inputSignal,
      outputSignal,
      aiModelSignal,
      sliders,
    ]
  );

  // Wrapper that uses current time
  const playAudio = useCallback(
    (useSecondarySignal = false) => {
      playAudioFromTime(currentTime, useSecondarySignal);
    },
    [currentTime, playAudioFromTime]
  );

  // Seek handler - called when user drags the playhead
  const handleSeek = useCallback(
    (seekTime) => {
      if (!inputSignal) return;

      // If playing, restart from new position
      if (isPlaying) {
        // Stop current audio
        if (audioSourceRef.current) {
          isStoppedManuallyRef.current = true;
          try {
            audioSourceRef.current.stop();
          } catch (e) {}
          audioSourceRef.current = null;
        }

        // Cancel animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Restart playback from new position
        setTimeout(() => {
          playAudioFromTime(seekTime, isPlayingSecondary);
        }, 10);
      } else {
        // If not playing, just update position
        setCurrentTime(seekTime);
        setIsPaused(true);
      }
    },
    [inputSignal, isPlaying, isPlayingSecondary, playAudioFromTime]
  );

  // === CONTROLLER HANDLERS ===
  const handlePlay = () => playAudio(isPlayingSecondary);

  const handlePause = () => {
    if (isPlaying) {
      // Mark as manually stopped so onended doesn't reset time
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

      // Keep currentTime as is!
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
    setCurrentTime(0); // Only Stop resets to 0
  };

  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    setPlaybackSpeed(newSpeed);
    if (audioSourceRef.current && isPlaying) {
      audioSourceRef.current.playbackRate.value = newSpeed;
    }
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
      playAudioFromTime(currentTime, newIsSecondary);
    } else {
      setIsPlayingSecondary(newIsSecondary);
    }
  };

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

        setInputSignal(originalSignal);
        setOutputSignal(originalSignal);
        setApiSignal(originalSignal);
        setAiModelSignal(null);
        setAiModelFourierData(null);
        setComparisonMode(null);
        setShowAIGraphs(false);
        setHasAIStems(false);
        setSliders((prev) => prev.filter((slider) => !slider.isVoice));

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
    setSliders((prev) => {
      const nonVoiceSliders = prev.filter((slider) => !slider.isVoice);
      return [...nonVoiceSliders, ...voiceSliders];
    });
  };

  // === SLIDER HANDLER ===
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
        const changedSlider = updatedSliders.find((s) => s.id === sliderId);

        if (currentMode === "musical" && hasAIStems && aiModelRef.current) {
          aiModelRef.current.remixStems();
        }

        if (changedSlider && changedSlider.isVoice && aiModelRef.current) {
          const voiceGains = {};
          updatedSliders.forEach((s) => {
            if (s.isVoice && s.voiceKey) voiceGains[s.voiceKey] = s.value;
          });
          aiModelRef.current.remixVoices(voiceGains);
        } else if (isAIMode && aiStems && currentMode !== "musical") {
          applyAIMixing();
        }

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

  useEffect(() => {
    slidersRef.current = sliders;
  }, [sliders]);

  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (sliders && sliders.length > 0) {
        const nonVoiceSliders = sliders.filter((slider) => !slider.isVoice);
        if (nonVoiceSliders.length > 0) {
          saveSettings(currentMode, nonVoiceSliders);
          if (backendSyncTimeoutRef.current)
            clearTimeout(backendSyncTimeoutRef.current);
          backendSyncTimeoutRef.current = setTimeout(async () => {
            try {
              await autoSyncSliders(currentMode, nonVoiceSliders);
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
    if (apiSignal) computeFourierTransform(apiSignal, "input");
    if (outputSignal && apiSignal) computeFourierTransform(apiSignal, "output");
    if (aiModelSignal) computeFourierTransform(aiModelSignal, "ai");
  }, [fftScale]);

  // Cleanup on unmount
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
                setTimeout(() => applyEqualization(), 100);
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
              setTimeout(() => applyEqualization(), 100);
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
            setTimeout(() => applyEqualization(), 100);
        }}
        onToast={showToast}
      />

      {showSliderModal && (
        <SliderCreationModal
          onCreate={(newSlider) => {
            setSliders([...sliders, newSlider]);
            setShowSliderModal(false);
            if (equalizationTimeoutRef.current)
              clearTimeout(equalizationTimeoutRef.current);
            equalizationTimeoutRef.current = setTimeout(
              () => applyEqualization(),
              100
            );
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
                {modeConfigs?.[currentMode]?.icon || "⚙️"}{" "}
                {modeConfigs?.[currentMode]?.name || "Unknown"} Equalizer
              </h3>
              {currentMode === "musical" && hasAIStems && (
                <div className="ai-integration-badge">
                  <span className="ai-badge-icon">🤖</span>
                  <span>AI Stems Active</span>
                </div>
              )}
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
                        if (equalizationTimeoutRef.current)
                          clearTimeout(equalizationTimeoutRef.current);
                        equalizationTimeoutRef.current = setTimeout(
                          () => applyEqualization(),
                          100
                        );
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
          {hasAIStems && (
            <div className="ai-controls-info-compact">
              <span>🎛️ AI Stem Control Active</span>
            </div>
          )}
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
                  onSeek={handleSeek}
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
                  onSeek={handleSeek}
                  isCineMode={true}
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
                    {showSpectrograms ? "👁️ Hide" : "👁 Show"}
                  </button>
                </div>

                {showSpectrograms && (
                  <div className="spectrograms-pair">
                    <Spectrogram
                      signal={getSignalByType("input")}
                      title={getTitleByType("input") + " Spectrogram"}
                      visible={showSpectrograms}
                      compact={true}
                    />
                    <Spectrogram
                      signal={getSignalByType("output")}
                      title={getTitleByType("output") + " Spectrogram"}
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
