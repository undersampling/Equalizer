
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
import numpy as np
from scipy import signal as scipy_signal
from scipy.io import wavfile
from scipy.signal import resample
import uuid
import base64
import io
import os
import tempfile
import wave

# Try importing librosa for advanced audio processing
try:
    import librosa
except ImportError:
    librosa = None

# Global storage for audio signals
AUDIO_STORAGE = {}
EPS = 1e-8


# ==================== UTILITY FUNCTIONS ====================

def fft_magnitude_phase(signal):
    """
    Compute FFT magnitude and phase
    """
    fft_result = np.fft.fft(signal)
    magnitude = np.abs(fft_result)
    phase = np.angle(fft_result)
    return magnitude, phase, fft_result


def compute_spectrogram(samples, sr, n_fft=2048, hop_length=512, n_mels=128, fmax=8000, 
                       use_mel=True, max_time_points=None, max_freq_points=None):
    """
    Compute spectrogram using librosa
    """
    if not librosa:
        return None
    
    try:
        if use_mel:
            S = librosa.feature.melspectrogram(
                y=samples, 
                sr=sr, 
                n_mels=n_mels, 
                fmax=fmax,
                n_fft=n_fft,
                hop_length=hop_length
            )
            S_dB = librosa.power_to_db(S, ref=np.max)
            freqs = librosa.mel_frequencies(n_mels=n_mels, fmax=fmax)
        else:
            stft = librosa.stft(y=samples, n_fft=n_fft, hop_length=hop_length)
            magnitude = np.abs(stft)
            S_dB = librosa.amplitude_to_db(magnitude, ref=np.max)
            freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
            
            freq_mask = freqs <= fmax
            freqs = freqs[freq_mask]
            S_dB = S_dB[freq_mask, :]
        
        S_dB = np.clip(S_dB, -80, 0)
        times = librosa.frames_to_time(np.arange(S_dB.shape[1]), sr=sr, hop_length=hop_length)
        
        if max_time_points and len(times) > max_time_points:
            time_step = max(1, len(times) // max_time_points)
            times = times[::time_step]
            S_dB = S_dB[:, ::time_step]
        
        if max_freq_points and len(freqs) > max_freq_points:
            freq_step = max(1, len(freqs) // max_freq_points)
            freqs = freqs[::freq_step]
            S_dB = S_dB[::freq_step, :]
        
        return {
            'z': S_dB.tolist(),
            'x': times.tolist(),
            'y': freqs.tolist()
        }
    except Exception as e:
        print(f"Spectrogram computation error: {e}")
        return None


def audio_to_base64(signal, sample_rate):
    """
    Convert numpy array to base64-encoded WAV
    """
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        audio_data = np.clip(signal * 32767, -32768, 32767).astype(np.int16)
        wf.writeframes(audio_data.tobytes())
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def apply_equalizer(samples, sample_rate, sliders):
    """
    Apply parametric EQ filters based on slider settings
    """
    if not sliders:
        return samples
    
    output = samples.copy()
    
    for slider in sliders:
        freq = slider.get('frequency', 1000)
        gain_db = slider.get('value', 0)
        q = slider.get('q', 1.0)
        
        if gain_db == 0:
            continue
        
        # Convert dB to linear gain
        gain = 10 ** (gain_db / 20.0)
        
        # Design peaking EQ filter
        w0 = 2 * np.pi * freq / sample_rate
        alpha = np.sin(w0) / (2 * q)
        
        A = np.sqrt(gain)
        
        # Filter coefficients (peaking EQ)
        b0 = 1 + alpha * A
        b1 = -2 * np.cos(w0)
        b2 = 1 - alpha * A
        a0 = 1 + alpha / A
        a1 = -2 * np.cos(w0)
        a2 = 1 - alpha / A
        
        # Normalize
        b = np.array([b0, b1, b2]) / a0
        a = np.array([1, a1 / a0, a2 / a0])
        
        # Apply filter
        output = scipy_signal.lfilter(b, a, output)
    
    return output


def compute_fft_for_chunk(signal_chunk, sample_rate):
    """
    Compute FFT for a given signal chunk
    Returns frequencies and magnitudes
    """
    try:
        if len(signal_chunk) == 0:
            return {'frequencies': [], 'magnitudes': []}
        
        magnitude, phase, _ = fft_magnitude_phase(signal_chunk)
        
        N = len(magnitude)
        frequencies = np.fft.fftfreq(N, 1 / sample_rate)
        
        # Only positive frequencies
        positive_idx = frequencies >= 0
        frequencies = frequencies[positive_idx]
        magnitude = magnitude[positive_idx]
        
        return {
            'frequencies': frequencies.tolist(),
            'magnitudes': magnitude.tolist()
        }
    except Exception as e:
        print(f"FFT error: {e}")
        return {'frequencies': [], 'magnitudes': []}


# ==================== API ENDPOINTS ====================

@api_view(['POST'])
@parser_classes([JSONParser])
def upload_signal(request):
    """
    Upload and store signal for cine playback
    Returns signal_id and metadata
    
    Payload:
    {
        "signal": [array of samples],
        "sampleRate": 44100,
        "duration": 10.5
    }
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = float(request.data.get('sampleRate', 44100))
        duration = float(request.data.get('duration', 0))

        if not signal_data or len(signal_data) == 0:
            return Response(
                {'error': 'Signal data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        signal_array = np.array(signal_data, dtype=float)
        
        # Generate unique ID
        signal_id = str(uuid.uuid4())
        
        # Store signal in memory
        AUDIO_STORAGE[signal_id] = {
            'samples': signal_array,
            'sample_rate': sample_rate,
            'duration': duration,
            'total_samples': len(signal_array)
        }

        return Response({
            'signal_id': signal_id,
            'duration': duration,
            'sampleRate': sample_rate,
            'totalSamples': len(signal_array)
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'Upload failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([JSONParser])
def get_static_window(request):
    """
    Get window data for zoom/pan operations with synchronized cine support
    
    This endpoint handles both:
    - Paused mode: Full processing with EQ and FFT
    - Playing mode: Fast processing (skip heavy computations)
    
    Expected payload:
    {
        "signal_id": string,
        "settings": {
            "sliders": [...],
            "mode": string
        },
        "time_start": float (seconds),
        "time_end": float (seconds),
        "is_playing": boolean  // NEW: Performance optimization flag
    }
    
    Returns:
    {
        "input_waveform": {
            "time": [...],
            "amplitude": [...]
        },
        "output_waveform": {
            "time": [...],
            "amplitude": [...]
        },
        "input_fft": {
            "frequencies": [...],
            "magnitudes": [...]
        },
        "output_fft": {
            "frequencies": [...],
            "magnitudes": [...]
        },
        "time_start": float,
        "time_end": float
    }
    """
    try:
        signal_id = request.data.get('signal_id')
        settings = request.data.get('settings', {})
        time_start = float(request.data.get('time_start', 0))
        time_end = float(request.data.get('time_end', 1))
        is_playing = request.data.get('is_playing', False)

        # Validate inputs
        if not signal_id:
            return Response(
                {'error': 'signal_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if time_end <= time_start:
            return Response(
                {'error': 'time_end must be greater than time_start'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if signal_id not in AUDIO_STORAGE:
            return Response(
                {'error': 'Signal not found. Please upload signal first.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Retrieve stored signal
        audio_data = AUDIO_STORAGE[signal_id]
        samples = audio_data['samples']
        sample_rate = audio_data['sample_rate']
        
        # Calculate sample indices for requested window
        idx_start = max(0, int(time_start * sample_rate))
        idx_end = min(len(samples), int(time_end * sample_rate))
        
        # Handle edge case: empty or invalid window
        if idx_start >= idx_end:
            empty_time = [time_start, time_end]
            empty_amp = [0, 0]
            empty_fft = {'frequencies': [], 'magnitudes': []}
            return Response({
                'input_waveform': {'time': empty_time, 'amplitude': empty_amp},
                'output_waveform': {'time': empty_time, 'amplitude': empty_amp},
                'input_fft': empty_fft,
                'output_fft': empty_fft,
                'time_start': float(time_start),
                'time_end': float(time_end)
            }, status=status.HTTP_200_OK)

        # Extract window chunk
        input_chunk = samples[idx_start:idx_end]
        
        # Create time axis
        if len(input_chunk) == 0:
            time_axis = np.array([time_start, time_end])
            input_chunk = np.array([0, 0])
        else:
            time_axis = np.linspace(time_start, time_end, len(input_chunk))

        # ===== PERFORMANCE OPTIMIZATION =====
        # When playing: Skip heavy processing for speed
        # When paused: Do full processing for accuracy
        
        if is_playing:
            # FAST MODE: Skip EQ and FFT computation
            # Just return the input signal as output (no processing)
            output_chunk = input_chunk  # No EQ applied
            input_fft = {'frequencies': [], 'magnitudes': []}
            output_fft = {'frequencies': [], 'magnitudes': []}
        else:
            # FULL MODE: Apply EQ and compute FFT
            sliders = settings.get('sliders', [])
            output_chunk = apply_equalizer(input_chunk, sample_rate, sliders)
            
            # Compute FFT for both input and output
            input_fft = compute_fft_for_chunk(input_chunk, sample_rate)
            output_fft = compute_fft_for_chunk(output_chunk, sample_rate)
        
        # Prepare waveform data
        input_waveform = {
            'time': time_axis.tolist(),
            'amplitude': input_chunk.tolist()
        }
        
        output_waveform = {
            'time': time_axis.tolist(),
            'amplitude': output_chunk.tolist()
        }
        
        return Response({
            'input_waveform': input_waveform,
            'output_waveform': output_waveform,
            'input_fft': input_fft,
            'output_fft': output_fft,
            'time_start': float(time_start),
            'time_end': float(time_end)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch window: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([JSONParser])
def get_cine_window(request):
    """
    Get synchronized window data for linked cine viewers (LEGACY - kept for compatibility)
    
    This endpoint handles continuous scrolling cine mode.
    Consider using get_static_window instead for better performance.
    
    Expected payload:
    {
        "signal_id": string,
        "settings": {
            "sliders": [...],
            "mode": string
        },
        "current_position": float (seconds),
        "window_size": float (seconds),
        "playback_speed": float,
        "is_playing": boolean
    }
    """
    try:
        signal_id = request.data.get('signal_id')
        settings = request.data.get('settings', {})
        current_position = float(request.data.get('current_position', 0))
        window_size = float(request.data.get('window_size', 2.0))
        playback_speed = float(request.data.get('playback_speed', 1.0))
        is_playing = request.data.get('is_playing', False)

        if not signal_id:
            return Response(
                {'error': 'signal_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if signal_id not in AUDIO_STORAGE:
            return Response(
                {'error': 'Signal not found. Please upload signal first.'},
                status=status.HTTP_404_NOT_FOUND
            )

        audio_data = AUDIO_STORAGE[signal_id]
        samples = audio_data['samples']
        sample_rate = audio_data['sample_rate']
        duration = audio_data['duration']
        total_samples = audio_data['total_samples']

        # Calculate sample indices
        start_time = max(0.0, current_position)
        end_time = min(duration, start_time + window_size)
        
        start_idx = int(start_time * sample_rate)
        end_idx = int(end_time * sample_rate)
        
        start_idx = max(0, min(start_idx, total_samples))
        end_idx = max(start_idx, min(end_idx, total_samples))
        
        if start_idx >= end_idx:
            return Response(
                {'error': 'Invalid window range'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extract chunks
        input_chunk = samples[start_idx:end_idx]
        
        # Apply equalization
        sliders = settings.get('sliders', [])
        output_chunk = apply_equalizer(input_chunk, sample_rate, sliders)
        
        # Create time axis
        time_axis = np.linspace(start_time, end_time, len(input_chunk))
        
        # Prepare waveforms
        input_waveform = {
            'time': time_axis.tolist(),
            'amplitude': input_chunk.tolist(),
            'window_start': float(start_time),
            'window_end': float(end_time)
        }
        
        output_waveform = {
            'time': time_axis.tolist(),
            'amplitude': output_chunk.tolist(),
            'window_start': float(start_time),
            'window_end': float(end_time)
        }
        
        # Compute FFT
        input_fft = compute_fft_for_chunk(input_chunk, sample_rate)
        output_fft = compute_fft_for_chunk(output_chunk, sample_rate)
        
        # Calculate next position
        if is_playing:
            step_size = (window_size * 0.05) * playback_speed
            next_position = current_position + step_size
        else:
            next_position = current_position
        
        is_complete = (next_position + window_size) >= duration
        
        return Response({
            'input_waveform': input_waveform,
            'output_waveform': output_waveform,
            'input_fft': input_fft,
            'output_fft': output_fft,
            'next_position': float(next_position),
            'is_complete': is_complete,
            'duration': float(duration),
            'sample_rate': int(sample_rate)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch window: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([JSONParser])
def compute_fft(request):
    """
    Compute FFT of full signal
    
    Payload:
    {
        "signal": [array],
        "sampleRate": 44100
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

        signal = np.array(signal_data, dtype=float)

        # Clean signal
        if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        magnitude, phase, _ = fft_magnitude_phase(signal)

        N = len(magnitude)
        frequencies = np.fft.fftfreq(N, 1 / sample_rate)

        # Only positive frequencies
        positive_freq_idx = frequencies >= 0
        frequencies = frequencies[positive_freq_idx]
        magnitude = magnitude[positive_freq_idx]
        phase = phase[positive_freq_idx]

        return Response({
            'frequencies': frequencies.tolist(),
            'magnitudes': magnitude.tolist(),
            'phases': phase.tolist(),
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'FFT computation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([JSONParser])
def compute_spectrogram_view(request):
    """
    Compute spectrogram
    
    Payload:
    {
        "signal": [array],
        "sampleRate": 44100,
        "n_fft": 2048,
        "hop_length": 512,
        "n_mels": 128,
        "fmax": 8000,
        "use_mel": true
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

        if not signal_data:
            return Response(
                {'error': 'Signal data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        signal = np.array(signal_data, dtype=float)

        if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        spectrogram_data = compute_spectrogram(
            signal,
            sample_rate,
            n_fft=n_fft,
            hop_length=hop_length,
            n_mels=n_mels,
            fmax=fmax,
            use_mel=use_mel
        )

        if spectrogram_data is None:
            return Response(
                {'error': 'librosa not available or spectrogram computation failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(spectrogram_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'Spectrogram computation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([JSONParser])
def equalize_signal(request):
    """
    Apply equalization to full signal
    
    Payload:
    {
        "signal": [array],
        "sampleRate": 44100,
        "sliders": [
            {"frequency": 100, "value": 3, "q": 1.0},
            ...
        ]
    }
    """
    try:
        signal_data = request.data.get('signal', [])
        sample_rate = request.data.get('sampleRate', 44100)
        sliders = request.data.get('sliders', [])

        if not signal_data:
            return Response(
                {'error': 'Signal data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        signal = np.array(signal_data, dtype=float)
        output_signal = apply_equalizer(signal, sample_rate, sliders)

        return Response({
            'outputSignal': output_signal.tolist()
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'Equalization failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def downsample_audio(request):
    """
    Downsample audio file to a new sample rate
    
    Form data:
    - file: audio file (WAV/MP3)
    - new_rate: target sample rate (integer)
    """
    try:
        file = request.FILES.get('file')
        new_rate_str = request.data.get('new_rate', '0')
       
        if not file:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
       
        file_ext = file.name.lower().split('.')[-1]
        if file_ext not in ['wav', 'mp3']:
            return Response({'error': 'Only WAV and MP3 files are supported.'},
                          status=status.HTTP_400_BAD_REQUEST)
       
        try:
            new_rate = int(new_rate_str)
        except ValueError:
            return Response({'error': 'Invalid sample rate'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Save to temporary file
        file.seek(0)
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp_file:
            tmp_file.write(file.read())
            tmp_path = tmp_file.name
       
        try:
            # Load audio
            if file_ext == 'wav':
                rate, samples = wavfile.read(tmp_path)
                if len(samples.shape) > 1:
                    samples = samples[:, 0]
                samples = samples.astype(float) / 32768
            else:
                if not librosa:
                    return Response({'error': 'librosa required for MP3 files'}, 
                                  status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                samples, rate = librosa.load(tmp_path, sr=None, mono=True)
           
            # Downsample
            if new_rate <= 0:
                new_rate = rate // 2
            if new_rate >= rate:
                new_rate = rate
            
            num_samples = int(len(samples) * new_rate / rate)
            new_signal = resample(samples, num_samples)
            
            # Convert to base64
            original_b64 = audio_to_base64(samples, rate)
            down_b64 = audio_to_base64(new_signal, new_rate)
            
            return Response({
                'original_rate': int(rate),
                'new_rate': new_rate,
                'original_audio': f"data:audio/wav;base64,{original_b64}",
                'downsampled_audio': f"data:audio/wav;base64,{down_b64}",
            })
       
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
           
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def clear_signal(request, signal_id):
    """
    Clear stored signal from memory
    """
    try:
        if signal_id in AUDIO_STORAGE:
            del AUDIO_STORAGE[signal_id]
            return Response({'message': 'Signal cleared'}, status=status.HTTP_200_OK)
        return Response({'error': 'Signal not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def clear_cache(request):
    """
    Clear all cached signals
    """
    try:
        AUDIO_STORAGE.clear()
        return Response({'message': 'Cache cleared'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)