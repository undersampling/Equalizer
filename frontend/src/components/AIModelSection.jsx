import React, { useState, useRef, useImperativeHandle, forwardRef } from "react";
import apiService from "../services/api";
import "../styles/AIModelSection.css";

function AIModelSection({ mode, inputSignal, outputSignal, sliders, onModelResult, onComparisonChange, onVoiceGainsUpdate }, ref) {
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Music separation states
  const [separatedStems, setSeparatedStems] = useState(null);
  const [isRemixing, setIsRemixing] = useState(false);
  const [playingStem, setPlayingStem] = useState(null);
  
  // Voice separation states
  const [separatedVoices, setSeparatedVoices] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(null);
  
  const audioContextRef = useRef(null);
  const audioSourceRefs = useRef({});

  const processWithAI = async () => {
    if (!inputSignal) {
      alert("Please load an audio file first.");
      return;
    }

    setIsProcessing(true);

    try {
      if (mode === "musical") {
        // Music stem separation using Demucs 6-stem model
        const response = await apiService.separateMusic(
          inputSignal.data,
          inputSignal.sampleRate
        );
        const result = response.data;
        setSeparatedStems(result.stems);

        // Initial mix using current slider values
        await remixStems(result.stems);
        
      } else if (mode === "human") {
        // Human voice separation
        const response = await apiService.separateVoices(
          inputSignal.data,
          inputSignal.sampleRate
        );
        const result = response.data;
        setSeparatedVoices(result.voices);
        
        // Notify parent about voice separation for adding to equalizer
        // Create voice sliders for main equalizer
        if (onVoiceGainsUpdate) {
          const voiceSliders = Object.keys(result.voices).map((voiceKey, index) => ({
            id: `voice-${voiceKey}`,
            label: `👤 Voice ${index + 1}`,
            value: 1.0,
            min: 0,
            max: 2,
            voiceKey: voiceKey,
            isVoice: true, // This flag is critical for logic separation in MainPage
            freqRanges: null
          }));
          onVoiceGainsUpdate(voiceSliders);
        }

        await remixVoices(result.voices);
      }
    } catch (error) {
      console.error("AI processing error:", error);
      alert(`Error processing with AI: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const remixStems = async (stems) => {
    if (!stems || !sliders) return;
    
    setIsRemixing(true);
    try {
      const stemMapping = {
        '🎤 Vocals': 'vocals',
        '🥁 Drums': 'drums', 
        '🎸 Bass': 'bass',
        '🎸 Guitar': 'guitar',
        '🎹 Piano': 'piano',   
        '🎧 Other': 'other'
      };

      const stemsWithGains = {};
      
      sliders.forEach((slider) => {
        const stemName = stemMapping[slider.label];
        if (stemName && stems[stemName]) {
          stemsWithGains[stemName] = {
            data: stems[stemName].data,
            gain: slider.value,
          };
        }
      });

      if (Object.keys(stemsWithGains).length === 0) {
        console.warn("No matching stems found for sliders");
        setIsRemixing(false);
        setIsProcessing(false);
        return;
      }

      const response = await apiService.mixStems(
        stemsWithGains,
        inputSignal.sampleRate
      );
      const result = response.data;

      const aiSignal = {
        data: result.mixedSignal,
        sampleRate: result.sampleRate,
        duration: inputSignal.duration,
      };

      onModelResult(aiSignal);
      
      // Automatically show comparison after AI processing
      onComparisonChange("equalizer_vs_ai");
      
    } catch (error) {
      console.error("Remix error:", error);
      alert(`Error remixing stems: ${error.message}`);
    } finally {
      setIsRemixing(false);
      setIsProcessing(false);
    }
  };

  const remixVoices = async (voices, gains = null) => {
    if (!voices) return;
    
    setIsRemixing(true);
    try {
      const voicesWithGains = {};
      
      if (gains) {
        // Use provided gains (from equalizer sliders)
        Object.keys(voices).forEach((voiceKey) => {
          const gain = gains[voiceKey] !== undefined ? gains[voiceKey] : 1.0;
          voicesWithGains[voiceKey] = {
            data: voices[voiceKey].data,
            gain: gain,
          };
        });
      } else {
        // Initial remix with default gains
        Object.keys(voices).forEach((voiceKey) => {
          voicesWithGains[voiceKey] = {
            data: voices[voiceKey].data,
            gain: 1.0,
          };
        });
      }

      const response = await apiService.mixVoices(
        voicesWithGains,
        inputSignal.sampleRate
      );
      const result = response.data;

      const aiSignal = {
        data: result.mixedSignal,
        sampleRate: result.sampleRate,
        duration: inputSignal.duration,
      };

      onModelResult(aiSignal);
      
      // Automatically show comparison after AI processing
      onComparisonChange("equalizer_vs_ai");
      
    } catch (error) {
      console.error("Remix error:", error);
      alert(`Error remixing voices: ${error.message}`);
    } finally {
      setIsRemixing(false);
      setIsProcessing(false);
    }
  };

  const playStem = async (stemKey) => {
    if (!separatedStems || !separatedStems[stemKey]) return;

    if (playingStem && audioSourceRefs.current[playingStem]) {
      try {
        audioSourceRefs.current[playingStem].stop();
      } catch (e) {}
      audioSourceRefs.current[playingStem] = null;
    }

    if (playingStem === stemKey) {
      setPlayingStem(null);
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const stemData = separatedStems[stemKey].data;
      const sampleRate = separatedStems[stemKey].sampleRate;

      const audioBuffer = audioContextRef.current.createBuffer(1, stemData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(stemData);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        setPlayingStem(null);
        audioSourceRefs.current[stemKey] = null;
      };

      source.start(0);
      audioSourceRefs.current[stemKey] = source;
      setPlayingStem(stemKey);
    } catch (error) {
      console.error("Error playing stem:", error);
      alert(`Error playing stem: ${error.message}`);
    }
  };

  const playVoice = async (voiceKey) => {
    if (!separatedVoices || !separatedVoices[voiceKey]) return;

    if (playingVoice && audioSourceRefs.current[playingVoice]) {
      try {
        audioSourceRefs.current[playingVoice].stop();
      } catch (e) {}
      audioSourceRefs.current[playingVoice] = null;
    }

    if (playingVoice === voiceKey) {
      setPlayingVoice(null);
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const voiceData = separatedVoices[voiceKey].data;
      const sampleRate = separatedVoices[voiceKey].sampleRate;

      const audioBuffer = audioContextRef.current.createBuffer(1, voiceData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(voiceData);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        setPlayingVoice(null);
        audioSourceRefs.current[voiceKey] = null;
      };

      source.start(0);
      audioSourceRefs.current[voiceKey] = source;
      setPlayingVoice(voiceKey);
    } catch (error) {
      console.error("Error playing voice:", error);
      alert(`Error playing voice: ${error.message}`);
    }
  };

  const getStemDisplayName = (stemKey) => {
    const names = {
      drums: '🥁',
      bass: '🎸',
      vocals: '🎤',
      guitar: '🎸',
      piano: '🎹',
      other: '🎧'
    };
    return names[stemKey] || stemKey;
  };

  // Expose remix function to parent component
  useImperativeHandle(ref, () => ({
    remixStems: () => {
      if (separatedStems) {
        remixStems(separatedStems);
      }
    },
    remixVoices: (voiceGains) => {
      if (separatedVoices) {
        remixVoices(separatedVoices, voiceGains);
      }
    }
  }));

  return (
    <section className="section ai-model-section">
      <h2 className="section-title">
        🤖 AI Model - {mode === "musical" ? "Music" : "Voice"} Processing
      </h2>

      <div className="ai-controls">
        <div className="ai-status">
          <span className="status-indicator loaded">✓</span>
          <span className="status-text">
            {mode === "musical" 
              ? "Demucs 6-Stem Model Ready" 
              : mode === "human" 
              ? "Voice Separation Model Ready" 
              : "Mock Model Ready"
            }
          </span>
        </div>

        <button
          className="btn ai-process-btn"
          onClick={processWithAI}
          disabled={!inputSignal || isProcessing || isRemixing}
        >
          {isProcessing ? "⏳ Processing..." : isRemixing ? "🔄 Remixing..." : "🚀 Process with AI"}
        </button>
      </div>

      {/* Compact Stem/Voice Icons - Show after processing */}
      {mode === "musical" && separatedStems && (
        <div className="compact-stems-section">
          <h4 className="compact-section-title">🎵 Individual Stems</h4>
          <div className="compact-stems-grid">
            {Object.keys(separatedStems).map((stemKey) => (
              <button
                key={stemKey}
                className={`compact-stem-btn ${playingStem === stemKey ? 'playing' : ''}`}
                onClick={() => playStem(stemKey)}
                title={`Play ${stemKey} stem`}
              >
                <span className="compact-stem-icon">{getStemDisplayName(stemKey)}</span>
                <span className="compact-stem-state">{playingStem === stemKey ? "⏸️" : "▶️"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "human" && separatedVoices && (
        <div className="compact-stems-section">
          <h4 className="compact-section-title">👥 Individual Voices</h4>
          <div className="compact-stems-grid">
            {Object.keys(separatedVoices).map((voiceKey, index) => (
              <button
                key={voiceKey}
                className={`compact-stem-btn ${playingVoice === voiceKey ? 'playing' : ''}`}
                onClick={() => playVoice(voiceKey)}
                title={`Play voice ${index + 1}`}
              >
                <span className="compact-stem-icon">👤</span>
                <span className="compact-stem-label">V{index + 1}</span>
                <span className="compact-stem-state">{playingVoice === voiceKey ? "⏸️" : "▶️"}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default forwardRef(AIModelSection);