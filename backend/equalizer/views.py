from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import numpy as np
from .utils import fft_magnitude_phase, compute_spectrogram, apply_equalization, apply_filter_to_spectrogram, fftfreq_custom

import os
import subprocess
import shlex
import tempfile
from django.conf import settings
from scipy.io import wavfile
import json

# Voice separation imports
import torch
import torchaudio
from speechbrain.inference.separation import SepformerSeparation

os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

if not hasattr(torchaudio, 'list_audio_backends'):
    torchaudio.list_audio_backends = lambda: []
    torchaudio.get_audio_backend = lambda: "sox_io"
    torchaudio.set_audio_backend = lambda x: None

# Global voice separation model instance (load once)
_voice_separation_model = None

def get_voice_separation_model():
    """Lazy load the voice separation model with Windows symlink fix"""
    global _voice_separation_model
    if _voice_separation_model is None:
        print("🔄 Loading SpeechBrain model without symlinks...")
        try:
            # Force LocalStrategy to avoid symlinks on Windows
            _voice_separation_model = SepformerSeparation.from_hparams(
                source="speechbrain/sepformer-wsj03mix",
                savedir='pretrained_models/sepformer-wsj03mix',
                run_opts={"device": "cuda" if torch.cuda.is_available() else "cpu"},
                use_auth_token=False,
                local_strategy="copy"  # CRITICAL: Use copy instead of symlink
            )
            print("✅ Voice separation model loaded successfully!")
        except Exception as e:
            print(f"❌ Error loading voice separation model: {e}")
            # Fallback: try without savedir (downloads to default cache)
            try:
                print("🔄 Trying fallback without custom savedir...")
                _voice_separation_model = SepformerSeparation.from_hparams(
                    source="speechbrain/sepformer-wsj03mix",
                    run_opts={"device": "cuda" if torch.cuda.is_available() else "cpu"},
                    use_auth_token=False,
                )
                print("✅ Voice separation model loaded with fallback!")
            except Exception as e2:
                print(f"❌ Fallback also failed: {e2}")
                raise
    return _voice_separation_model

@api_view(['POST'])
def separate_music_ai(request):
    """
    Separate music using Demucs 6-stem AI model
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = int(request.data.get('sampleRate', 44100))

        if not signal_data:
            return Response(
                {'error': 'Signal data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert to numpy array
        signal = np.array(signal_data, dtype=np.float32)

        # Handle NaN or Inf values
        if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        # Normalize signal to prevent clipping
        if np.max(np.abs(signal)) > 1.0:
            signal = signal / np.max(np.abs(signal)) * 0.95

        # Convert to int16 for WAV file
        signal_int16 = (signal * 32767).astype(np.int16)

        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save input signal as temporary WAV file
            input_wav_path = os.path.join(temp_dir, 'input.wav')
            wavfile.write(input_wav_path, sample_rate, signal_int16)

            # Run Demucs separation with 6-stem model
            output_dir = os.path.join(temp_dir, 'separated')
            os.makedirs(output_dir, exist_ok=True)

            try:
                # Use htdemucs_6s for 6 stems: drums, bass, vocals, guitar, piano, other
                cmd = [
                    'demucs',
                    '-n', 'htdemucs_6s',  # Use 6-stem model
                    '--out', output_dir,
                    input_wav_path
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )

                if result.returncode != 0:
                    raise Exception(f"Demucs failed: {result.stderr}")

                # Load separated stems
                model_name = "htdemucs_6s"
                file_name = "input"
                stems_path = os.path.join(output_dir, model_name, file_name)

                if not os.path.exists(stems_path):
                    raise Exception(f"Stems directory not found: {stems_path}")

                # Read separated stems (6 stems for htdemucs_6s)
                stems_data = {}
                available_stems = ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other']

                for stem_name in available_stems:
                    stem_file = os.path.join(stems_path, f'{stem_name}.wav')

                    if os.path.exists(stem_file):
                        # Read WAV file
                        sr, stem_audio = wavfile.read(stem_file)

                        # Convert to float32 and normalize
                        if stem_audio.dtype == np.int16:
                            stem_audio = stem_audio.astype(np.float32) / 32768.0
                        elif stem_audio.dtype == np.int32:
                            stem_audio = stem_audio.astype(np.float32) / 2147483648.0

                        # Handle stereo to mono conversion
                        if len(stem_audio.shape) > 1:
                            stem_audio = np.mean(stem_audio, axis=1)

                        stems_data[stem_name] = {
                            'data': stem_audio.tolist(),
                            'sampleRate': sr
                        }

                if not stems_data:
                    raise Exception("No stems were successfully separated")

                return Response({
                    'stems': stems_data,
                    'availableStems': list(stems_data.keys())
                }, status=status.HTTP_200_OK)

            except subprocess.TimeoutExpired:
                return Response(
                    {'error': 'Music separation timed out (>5 minutes)'},
                    status=status.HTTP_408_REQUEST_TIMEOUT
                )
            except FileNotFoundError:
                return Response(
                    {'error': 'Demucs not found. Please install: pip install demucs'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    except Exception as e:
        return Response(
            {'error': f'Music separation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def apply_stem_mixing(request):
    """
    Mix separated stems with individual gain controls
    """
    try:
        stems_data = request.data.get('stems', {})
        sample_rate = request.data.get('sampleRate', 44100)

        if not stems_data:
            return Response(
                {'error': 'Stems data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Initialize mixed signal
        mixed_signal = None
        max_length = 0

        # First pass: find maximum length
        for stem_name, stem_info in stems_data.items():
            stem_data = np.array(stem_info.get('data', []), dtype=np.float32)
            max_length = max(max_length, len(stem_data))

        # Second pass: mix all stems
        mixed_signal = np.zeros(max_length, dtype=np.float32)

        for stem_name, stem_info in stems_data.items():
            stem_data = np.array(stem_info.get('data', []), dtype=np.float32)
            gain = float(stem_info.get('gain', 1.0))

            # Pad shorter stems with zeros
            if len(stem_data) < max_length:
                stem_data = np.pad(stem_data, (0, max_length - len(stem_data)), mode='constant')

            # Apply gain and add to mix
            mixed_signal += stem_data * gain

        # Normalize to prevent clipping
        max_val = np.max(np.abs(mixed_signal))
        if max_val > 1.0:
            mixed_signal = mixed_signal / max_val * 0.95

        return Response({
            'mixedSignal': mixed_signal.tolist(),
            'sampleRate': sample_rate
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'Stem mixing failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view(['POST'])
def compute_fft(request):
    """
    Compute FFT with comprehensive error handling
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = float(request.data.get('sampleRate', 44100))

        print(f"📊 FFT Request: signal length={len(signal_data)}, sr={sample_rate}")

        if not signal_data:
            return Response(
                {'error': 'Signal data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(signal_data, list):
            return Response(
                {'error': 'Signal must be an array'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(signal_data) == 0:
            return Response(
                {'error': 'Signal array cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert to numpy array
        signal = np.array(signal_data, dtype=float)

        # Handle NaN or Inf values
        if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
            print("⚠️ Cleaning NaN/Inf from signal")
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        # Compute FFT
        magnitude, phase, fft_result = fft_magnitude_phase(signal)

        # Calculate frequencies
        N = len(magnitude)
        d = 1.0 / sample_rate
        frequencies = fftfreq_custom(N, d)

        # Only positive frequencies
        positive_freq_idx = frequencies >= 0
        frequencies = frequencies[positive_freq_idx]
        magnitude = magnitude[positive_freq_idx]
        phase = phase[positive_freq_idx]

        if len(frequencies) == 0 or len(magnitude) == 0:
            return Response(
                {'error': 'FFT computation resulted in empty data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Downsample for transmission
        MAX_DISPLAY_POINTS = 5000
        if len(frequencies) > MAX_DISPLAY_POINTS:
            block_size = len(frequencies) // MAX_DISPLAY_POINTS
            n_keep = MAX_DISPLAY_POINTS * block_size
            
            freq_reshaped = frequencies[:n_keep].reshape(MAX_DISPLAY_POINTS, block_size)
            mag_reshaped = magnitude[:n_keep].reshape(MAX_DISPLAY_POINTS, block_size)
            phase_reshaped = phase[:n_keep].reshape(MAX_DISPLAY_POINTS, block_size)
            
            max_indices = np.argmax(mag_reshaped, axis=1)
            row_indices = np.arange(MAX_DISPLAY_POINTS)
            
            magnitude = mag_reshaped[row_indices, max_indices]
            frequencies = freq_reshaped[row_indices, max_indices]
            phase = phase_reshaped[row_indices, max_indices]

        print(f"✅ FFT Success: {len(frequencies)} points returned")

        response_data = {
            'frequencies': frequencies.tolist(),
            'magnitudes': magnitude.tolist(),
            'phases': phase.tolist(),
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except ValueError as e:
        print(f"❌ FFT ValueError: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Invalid input: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        print(f"❌ FFT Exception: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'FFT computation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def compute_spectrogram_view(request):
    """
    Compute spectrogram of input signal
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = float(request.data.get('sampleRate', 44100))
        n_fft = request.data.get('n_fft', 2048)
        hop_length = request.data.get('hop_length', 512)
        n_mels = request.data.get('n_mels', 128)
        fmax = request.data.get('fmax', 8000)
        use_mel = request.data.get('use_mel', True)
        
        # Default to reasonable display limits if not provided
        max_time_points = request.data.get('max_time_points', 800)
        max_freq_points = request.data.get('max_freq_points', 600)

        if not signal_data:
            return Response(
                {'error': 'Signal data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert to numpy array
        signal = np.array(signal_data, dtype=float)

        # Handle NaN or Inf values
        if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        # Compute spectrogram using custom FFT implementation
        spectrogram_data = compute_spectrogram(
            signal,
            sample_rate,
            n_fft=n_fft,
            hop_length=hop_length,
            n_mels=n_mels,
            fmax=fmax,
            use_mel=use_mel,
            max_time_points=max_time_points,
            max_freq_points=max_freq_points
        )

        return Response(spectrogram_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def equalize_signal(request):
    """
    Apply equalization with PREVIEW support.
    
    If 'preview' is True in request data:
        - Returns ONLY spectrogram data derived mathematically (Fast, ~100KB)
        - DOES NOT compute full audio (Slow, ~30MB)
        
    If 'preview' is False (default):
        - Returns FULL filtered audio for playback
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = float(request.data.get('sampleRate', 44100))
        sliders = request.data.get('sliders', [])
        
        # NEW FLAG: Check if this is just a graph preview request
        is_preview = request.data.get('preview', False)

        if not signal_data:
            return Response({'error': 'Signal data is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Convert to numpy array
        signal = np.array(signal_data, dtype=float)

        # Handle NaN or Inf values
        if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        # Validate sample rate
        if sample_rate <= 0:
            return Response({'error': 'Sample rate must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        # === PREVIEW MODE (FAST GRAPH UPDATE) ===
        if is_preview:
            # Bypass IFFT, only calculate frequency domain changes for graph
            spectrogram_data = apply_filter_to_spectrogram(
                signal, 
                sample_rate, 
                sliders
            )
            return Response({
                'spectrogram': spectrogram_data,
                'isPreview': True
            }, status=status.HTTP_200_OK)

        # === FULL MODE (AUDIO PLAYBACK) ===
        # Apply full equalization including IFFT
        print(f"\n{'='*60}")
        print(f"📥 EQUALIZATION REQUEST (FULL AUDIO)")
        output_signal = apply_equalization(signal, sample_rate, sliders)
        print(f"{'='*60}\n")

        # Return with SAME sample rate
        return Response({
            'outputSignal': output_signal.tolist(),
            'sampleRate': sample_rate,
            'isPreview': False
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        print(f"❌ ValueError: {e}")
        return Response({'error': f'Invalid input: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback
        traceback.print_exc()
        return Response({'error': f'Equalization failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def separate_voices_ai(request):
    """
    Separate human voices using SpeechBrain SepformerSeparation
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = int(request.data.get('sampleRate', 44100))

        if not signal_data:
            return Response(
                {'error': 'Signal data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convert to numpy array
        signal = np.array(signal_data, dtype=np.float32)

        # Handle NaN or Inf values
        if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        # Normalize signal to prevent clipping
        if np.max(np.abs(signal)) > 1.0:
            signal = signal / np.max(np.abs(signal)) * 0.95

        # Convert to torch tensor (1D -> 2D: [1, samples])
        mixed_tensor = torch.from_numpy(signal).unsqueeze(0)

        # Downsample to 8kHz for separation (model requirement)
        model_sample_rate = 8000
        if sample_rate != model_sample_rate:
            resampler = torchaudio.transforms.Resample(sample_rate, model_sample_rate)
            mixed_tensor_8k = resampler(mixed_tensor)
        else:
            mixed_tensor_8k = mixed_tensor

        # Separate voices
        model = get_voice_separation_model()
        est_sources = model.separate_batch(mixed_tensor_8k)
        separated_sources = est_sources[0].cpu()  # Get first batch item
        
        # Handle different tensor shapes from SpeechBrain
        if len(separated_sources.shape) == 3:
            # Shape: [1, samples, num_voices]
            separated_sources = separated_sources.squeeze(0)  # Remove batch dimension: [samples, num_voices]
        elif len(separated_sources.shape) == 2:
            # Shape: [samples, num_voices] - already correct
            pass
        else:
            raise ValueError(f"Unexpected tensor shape: {separated_sources.shape}")
        
        # Now separated_sources should be [samples, num_voices]
        num_samples, num_voices = separated_sources.shape

        # Upsample back to original sample rate
        if sample_rate != model_sample_rate:
            resampler_up = torchaudio.transforms.Resample(model_sample_rate, sample_rate)
            # Resample first voice to get the output length
            first_voice_8k = separated_sources[:, 0].unsqueeze(0)  # [1, samples]
            first_voice_up = resampler_up(first_voice_8k)
            upsampled_length = first_voice_up.shape[1]
            
            # Create tensor for upsampled voices
            separated_sources_up = torch.zeros(upsampled_length, num_voices)
            separated_sources_up[:, 0] = first_voice_up.squeeze(0)
            
            # Resample remaining voices
            for i in range(1, num_voices):
                voice_8k = separated_sources[:, i].unsqueeze(0)  # [1, samples]
                voice_up = resampler_up(voice_8k)
                separated_sources_up[:, i] = voice_up.squeeze(0)  # [samples]
            separated_sources = separated_sources_up

        # Convert to numpy and extract voices
        voices_data = {}
        
        for i in range(num_voices):
            voice_tensor = separated_sources[:, i]  # [samples]
            voice_array = voice_tensor.numpy().astype(np.float32)
            
            # Normalize each voice
            max_val = np.max(np.abs(voice_array))
            if max_val > 0:
                voice_array = voice_array / max_val * 0.95
            
            voices_data[f"voice_{i}"] = {
                'data': voice_array.tolist(),
                'sampleRate': sample_rate
            }

        return Response({
            'voices': voices_data,
            'originalSampleRate': sample_rate,
            'numVoices': num_voices
        }, status=status.HTTP_200_OK)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Voice separation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def mix_voices_with_gains(request):
    """
    Mix separated voices with individual gain controls
    """
    try:
        voices_data = request.data.get('voices', {})
        sample_rate = request.data.get('sampleRate', 44100)

        if not voices_data:
            return Response(
                {'error': 'Voices data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Initialize mixed signal
        mixed_signal = None
        max_length = 0

        # First pass: find maximum length
        for voice_name, voice_info in voices_data.items():
            voice_data = np.array(voice_info.get('data', []), dtype=np.float32)
            max_length = max(max_length, len(voice_data))

        if max_length == 0:
            return Response(
                {'error': 'No valid voice data found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Second pass: mix all voices with gains
        mixed_signal = np.zeros(max_length, dtype=np.float32)

        for voice_name, voice_info in voices_data.items():
            voice_data = np.array(voice_info.get('data', []), dtype=np.float32)
            gain = float(voice_info.get('gain', 1.0))
            
            # Clamp gain to [0, 2]
            gain = np.clip(gain, 0.0, 2.0)

            # Pad shorter voices with zeros
            if len(voice_data) < max_length:
                voice_data = np.pad(voice_data, (0, max_length - len(voice_data)), mode='constant')

            # Apply gain and add to mix
            mixed_signal += voice_data * gain

        # Normalize to prevent clipping
        max_val = np.max(np.abs(mixed_signal))
        if max_val > 1.0:
            mixed_signal = mixed_signal / max_val * 0.95

        return Response({
            'mixedSignal': mixed_signal.tolist(),
            'sampleRate': sample_rate
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'Voice mixing failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )