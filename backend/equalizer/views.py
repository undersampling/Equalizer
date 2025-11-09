from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import numpy as np
from .utils import fft_magnitude_phase, compute_spectrogram, apply_equalization, fftfreq_custom

import os
import subprocess
import shlex
import tempfile
from django.conf import settings
from scipy.io import wavfile
import json


@api_view(['POST'])
def separate_music_ai(request):
    """
    Separate music using Demucs AI model
    Expected payload:
    {
        "signal": [array of floats],
        "sampleRate": float,
        "stems": ["drums", "bass", "other", "vocals"]  // optional, default all
    }
    Returns:
    {
        "stems": {
            "drums": {"data": [...], "sampleRate": float},
            "bass": {"data": [...], "sampleRate": float},
            "other": {"data": [...], "sampleRate": float},
            "vocals": {"data": [...], "sampleRate": float}
        }
    }
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = int(request.data.get('sampleRate', 44100))
        requested_stems = request.data.get('stems', ['drums', 'bass', 'other', 'vocals'])

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

            # Run Demucs separation
            output_dir = os.path.join(temp_dir, 'separated')
            os.makedirs(output_dir, exist_ok=True)

            try:
                # Run Demucs command
                cmd = [
                    'demucs',
                    '-n', 'htdemucs_6s',
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

                # Read separated stems
                stems_data = {}
                available_stems = ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano']

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

                        # Only include requested stems
                        if stem_name in requested_stems:
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
    Expected payload:
    {
        "stems": {
            "drums": {"data": [...], "gain": float},
            "bass": {"data": [...], "gain": float},
            ...
        },
        "sampleRate": float
    }
    Returns:
    {
        "mixedSignal": [array of floats],
        "sampleRate": float
    }
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
    Compute FFT of input signal
    Expected payload:
    {
        "signal": [array of floats],
        "sampleRate": float
    }
    Returns:
    {
        "frequencies": [array of floats],
        "magnitudes": [array of floats],
        "phases": [array of floats] (optional)
    }
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = float(request.data.get('sampleRate', 44100))

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
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        # Compute FFT
        magnitude, phase, fft_result = fft_magnitude_phase(signal)

        # Calculate frequencies using custom fftfreq function
        N = len(magnitude)
        d = 1.0 / sample_rate
        frequencies = fftfreq_custom(N, d)

        # Only return positive frequencies (first half)
        positive_freq_idx = frequencies >= 0
        frequencies = frequencies[positive_freq_idx]
        magnitude = magnitude[positive_freq_idx]
        phase = phase[positive_freq_idx]

        # Handle empty results
        if len(frequencies) == 0 or len(magnitude) == 0:
            return Response(
                {'error': 'FFT computation resulted in empty data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Prepare response in the exact format FourierGraph expects
        response_data = {
            'frequencies': frequencies.tolist(),
            'magnitudes': magnitude.tolist(),
            'phases': phase.tolist(),  # Optional, for future use
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response(
            {'error': f'Invalid input: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'FFT computation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def compute_spectrogram_view(request):
    """
    Compute spectrogram of input signal
    Expected payload:
    {
        "signal": [array of floats],
        "sampleRate": float,
        "n_fft": int (optional, default 2048),
        "hop_length": int (optional, default 512),
        "n_mels": int (optional, default 128),
        "fmax": float (optional, default 8000),
        "use_mel": bool (optional, default true),
        "max_time_points": int (optional),
        "max_freq_points": int (optional)
    }
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = float(request.data.get('sampleRate', 44100))
        n_fft = request.data.get('n_fft', 2048)
        hop_length = request.data.get('hop_length', 512)
        n_mels = request.data.get('n_mels', 128)
        fmax = request.data.get('fmax', 8000)
        use_mel = request.data.get('use_mel', True)
        max_time_points = request.data.get('max_time_points', None)
        max_freq_points = request.data.get('max_freq_points', None)

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
    Apply equalization to input signal based on slider values
    FIXED: Always return the SAME sample rate as input
    Expected payload:
    {
        "signal": [array of floats],
        "sampleRate": float,
        "sliders": [
            {
                "id": int,
                "label": string,
                "value": float,  // Gain factor (1.0 = unity, <1.0 = lower, >1.0 = raise)
                "freqRanges": [[min_freq, max_freq], ...]  // Frequency intervals to equalize
            },
            ...
        ],
        "mode": string (optional)
    }
    Returns:
    {
        "outputSignal": [array of floats],
        "sampleRate": float  // ALWAYS SAME AS INPUT
    }
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = float(request.data.get('sampleRate', 44100))
        sliders = request.data.get('sliders', [])

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
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        # Validate sample rate
        if sample_rate <= 0:
            return Response(
                {'error': 'Sample rate must be positive'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Apply equalization using the utility function
        output_signal = apply_equalization(signal, sample_rate, sliders)

        # CRITICAL FIX: Return the SAME sample rate as input
        return Response({
            'outputSignal': output_signal.tolist(),
            'sampleRate': sample_rate  # Use input sample rate, not modified
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response(
            {'error': f'Invalid input: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Equalization failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )