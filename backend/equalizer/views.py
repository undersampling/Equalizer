from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import numpy as np
from .utils import fft_magnitude_phase, compute_spectrogram, apply_equalization, fftfreq_custom


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
        "outputSignal": [array of floats]
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

        return Response({
            'outputSignal': output_signal.tolist()
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