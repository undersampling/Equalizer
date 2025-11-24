import numpy as np
import cmath
from numba import jit, prange, complex128, float64, int32
from multiprocessing import Pool, cpu_count

# FFT cache for performance optimization
_fft_cache = {}

def clear_fft_cache():
    """Clear the FFT cache. Useful for memory management or when signal changes."""
    global _fft_cache
    _fft_cache.clear()
    print("🗑️ FFT cache cleared")

def get_signal_hash(signal, sample_rate):
    """
    Generate a hash for the signal to detect changes.
    Uses signal length, sample rate, and a sample of data points.
    """
    # Convert to numpy array if needed
    if not isinstance(signal, np.ndarray):
        signal = np.array(signal, dtype=float)
    
    # Use a combination of length, sample rate, and sample points for hash
    signal_len = len(signal)
    sample_size = min(100, signal_len)  # Sample first 100 points for hash
    
    if signal_len == 0:
        return hash((0, sample_rate))
    
    # Get sample points and convert to tuple for hashing
    sample_points = tuple(signal[:sample_size].tolist())
    first_val = float(signal[0])
    last_val = float(signal[-1])
    
    return hash((signal_len, sample_rate, sample_points, first_val, last_val))


@jit(complex128[:](complex128[:]), nopython=True, cache=True)
def fft_custom_iterative(x):
    n = len(x)
    
    if n <= 1:
        return x

    # Pad to power of 2
    log2n = np.log2(n)
    if log2n != np.floor(log2n):
        next_pow2 = 2 ** int(np.ceil(log2n))
        new_x = np.zeros(next_pow2, dtype=np.complex128)
        new_x[:n] = x
        x = new_x
        n = next_pow2

    # Bit-reversal permutation
    j = 0
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j ^= bit
        if i < j:
            temp = x[i]
            x[i] = x[j]
            x[j] = temp

    # Iterative FFT
    length = 2
    while length <= n:
        half_length = length // 2
        angle = -2.0 * np.pi / length
        wlen_real = np.cos(angle)
        wlen_imag = np.sin(angle)
        
        for i in range(0, n, length):
            w_real = 1.0
            w_imag = 0.0
            for j in range(half_length):
                u_real = x[i + j].real
                u_imag = x[i + j].imag
                
                v_real = x[i + j + half_length].real
                v_imag = x[i + j + half_length].imag
                
                vw_real = v_real * w_real - v_imag * w_imag
                vw_imag = v_real * w_imag + v_imag * w_real
                
                x[i + j] = complex(u_real + vw_real, u_imag + vw_imag)
                x[i + j + half_length] = complex(u_real - vw_real, u_imag - vw_imag)
                
                w_temp_real = w_real * wlen_real - w_imag * wlen_imag
                w_imag = w_real * wlen_imag + w_imag * wlen_real
                w_real = w_temp_real
        
        length *= 2

    return x


def fft_custom(x):
    """Custom FFT with validation"""
    try:
        x = np.array(x, dtype=complex)
        
        if len(x) == 0:
            raise ValueError("Input signal is empty")
        
        if np.any(np.isnan(x)) or np.any(np.isinf(x)):
            x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
        
        return fft_custom_iterative(x)
    except Exception as e:
        print(f"❌ FFT Error: {e}")
        raise


def ifft_custom(x):
    """Custom IFFT with error handling"""
    try:
        x = np.array(x, dtype=complex)
        N = len(x)

        if N <= 1:
            return x

        if np.any(np.isnan(x)) or np.any(np.isinf(x)):
            x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)

        result = np.conj(fft_custom_iterative(np.conj(x))) / N
        return result
    except Exception as e:
        print(f"❌ IFFT Error: {e}")
        raise


@jit(float64[:](int32, float64), nopython=True, cache=True)
def fftfreq_custom(n, d=1.0):
    """Custom FFT frequency bins calculation"""
    if n <= 0:
        return np.zeros(0, dtype=np.float64)

    k = np.arange(n, dtype=np.float64)
    mid_point = (n + 1) // 2
    
    frequencies = np.empty(n, dtype=np.float64)
    for i in range(n):
        if i < mid_point:
            frequencies[i] = k[i] / (d * n)
        else:
            frequencies[i] = (k[i] - n) / (d * n)

    return frequencies


def stft_custom(y, n_fft=2048, hop_length=512, win_length=None, window='hann'):
    """
    Custom Short-Time Fourier Transform using custom FFT implementation.
    """
    if win_length is None:
        win_length = n_fft

    y = np.array(y, dtype=float)
    signal_length = len(y)

    # Create window function
    if window == 'hann':
        window_func = np.array([0.5 * (1 - np.cos(2 * np.pi * n / (win_length - 1)))
                                if win_length > 1 else 1.0
                                for n in range(win_length)])
    elif window == 'hamming':
        window_func = np.array([0.54 - 0.46 * np.cos(2 * np.pi * n / (win_length - 1))
                                if win_length > 1 else 1.0
                                for n in range(win_length)])
    else:
        window_func = np.ones(win_length)

    # Pad the signal
    pad_length = n_fft // 2
    y_padded = np.pad(y, (pad_length, pad_length), mode='constant')

    # Calculate number of frames
    n_frames = 1 + (len(y_padded) - n_fft) // hop_length

    # Initialize STFT matrix
    stft_matrix = np.zeros((n_fft // 2 + 1, n_frames), dtype=complex)

    # Process each frame
    for i in range(n_frames):
        start_idx = i * hop_length
        end_idx = start_idx + n_fft

        if end_idx > len(y_padded):
            frame = np.zeros(n_fft)
            available_length = len(y_padded) - start_idx
            frame[:available_length] = y_padded[start_idx:]
        else:
            frame = y_padded[start_idx:end_idx]

        # Apply window
        if win_length <= n_fft:
            frame_windowed = np.zeros(n_fft)
            frame_windowed[:win_length] = frame[:win_length] * window_func
        else:
            frame_windowed = frame * window_func[:n_fft]

        # Compute FFT
        fft_result = fft_custom(frame_windowed)
        stft_matrix[:, i] = fft_result[:n_fft // 2 + 1]

    return stft_matrix


@jit(float64(float64), nopython=True, cache=True)
def hz_to_mel(hz):
    """Convert Hz to Mel scale"""
    return 2595.0 * np.log10(1.0 + hz / 700.0)


@jit(float64(float64), nopython=True, cache=True)
def mel_to_hz(mel):
    """Convert Mel to Hz"""
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


@jit(float64[:](int32, float64, float64), nopython=True, cache=True)
def mel_frequencies_custom(n_mels=128, fmin=0.0, fmax=8000.0):
    """
    Custom implementation of mel frequency bins.
    Returns the center frequencies of each mel bin.
    """
    mel_min = hz_to_mel(fmin)
    mel_max = hz_to_mel(fmax)

    mels = np.linspace(mel_min, mel_max, n_mels + 2)
    freqs = np.array([mel_to_hz(m) for m in mels])

    return freqs[1:-1]


def mel_filter_bank_custom(sr, n_fft, n_mels=128, fmin=0.0, fmax=8000.0):
    """
    Create a mel filter bank matrix.
    """
    mel_min = hz_to_mel(fmin)
    mel_max = hz_to_mel(fmax)

    mels = np.linspace(mel_min, mel_max, n_mels + 2)
    mel_freqs = np.array([mel_to_hz(m) for m in mels])

    d = 1.0 / sr
    fft_freqs = fftfreq_custom(n_fft, d)
    fft_freqs = fft_freqs[:n_fft // 2 + 1]

    filter_bank = np.zeros((n_mels, len(fft_freqs)))

    for i in range(n_mels):
        lower = mel_freqs[i]
        center = mel_freqs[i + 1]
        upper = mel_freqs[i + 2]

        for j in range(len(fft_freqs)):
            freq = fft_freqs[j]
            if lower <= freq <= center:
                filter_bank[i, j] = (freq - lower) / (center - lower) if center != lower else 0.0
            elif center < freq <= upper:
                filter_bank[i, j] = (upper - freq) / (upper - center) if upper != center else 0.0

    return filter_bank


def power_to_db_custom(S, ref=1.0, amin=1e-10, top_db=80.0):
    """Convert power spectrogram to dB scale"""
    S = np.array(S)
    S = np.maximum(S, amin)
    S_db = 10.0 * np.log10(S / ref)
    S_db = np.maximum(S_db, S_db.max() - top_db)
    return S_db


def amplitude_to_db_custom(S, ref=1.0, amin=1e-10, top_db=80.0):
    """Convert amplitude spectrogram to dB scale"""
    S = np.array(S)
    S = np.maximum(np.abs(S), amin)
    S_db = 20.0 * np.log10(S / ref)
    S_db = np.maximum(S_db, S_db.max() - top_db)
    return S_db


def compute_spectrogram(samples, sr, n_fft=2048, hop_length=512, n_mels=128, fmax=8000,
                        use_mel=True, max_time_points=None, max_freq_points=None):
    """
    Compute spectrogram with comprehensive error handling
    """
    try:
        if samples is None or len(samples) == 0:
            raise ValueError("Sample data is empty")
        
        if sr <= 0:
            raise ValueError(f"Invalid sample rate: {sr}")
        
        samples = np.array(samples, dtype=float)
        if np.any(np.isnan(samples)) or np.any(np.isinf(samples)):
            print("⚠️ Warning: Cleaning NaN/Inf from samples")
            samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
        
        nyquist = sr / 2.0
        if fmax is None or fmax > nyquist:
            fmax = nyquist
        
        print(f"🎵 Computing spectrogram: sr={sr}Hz, fmax={fmax}Hz, n_mels={n_mels}, use_mel={use_mel}")

        stft = stft_custom(samples, n_fft=n_fft, hop_length=hop_length, window='hann')

        if use_mel:
            magnitude = np.abs(stft)
            power = magnitude ** 2

            mel_bank = mel_filter_bank_custom(sr, n_fft, n_mels=n_mels, fmin=0.0, fmax=fmax)
            mel_spectrogram = np.dot(mel_bank, power)

            epsilon = 1e-10
            mel_spectrogram = np.maximum(mel_spectrogram, epsilon)

            S_dB = power_to_db_custom(mel_spectrogram, ref=np.max(mel_spectrogram))
            freqs = mel_frequencies_custom(n_mels=n_mels, fmin=0.0, fmax=fmax)

            print(f"✅ Mel spectrogram: {len(freqs)} bins from 0Hz to {fmax}Hz")
        else:
            magnitude = np.abs(stft)
            epsilon = 1e-10
            magnitude = np.maximum(magnitude, epsilon)

            S_dB = amplitude_to_db_custom(magnitude, ref=np.max(magnitude))

            d = 1.0 / sr
            freqs = fftfreq_custom(n_fft, d)
            freqs = freqs[:n_fft // 2 + 1]

            freq_mask = freqs <= fmax
            freqs = freqs[freq_mask]
            S_dB = S_dB[freq_mask, :]

            print(f"✅ Linear spectrogram: {len(freqs)} bins from 0Hz to {freqs[-1]:.1f}Hz")

        S_dB_flat = S_dB.flatten()
        percentile_5 = np.percentile(S_dB_flat, 5)
        S_dB_min = max(percentile_5, -80)
        S_dB = np.clip(S_dB, S_dB_min, 0)

        print(f"✅ dB range: {S_dB.min():.1f} to {S_dB.max():.1f}")

        n_frames = S_dB.shape[1]
        times = np.array([i * hop_length / sr for i in range(n_frames)])

        if max_time_points and len(times) > max_time_points:
            time_step = max(1, len(times) // max_time_points)
            times = times[::time_step]
            S_dB = S_dB[:, ::time_step]

        if max_freq_points and len(freqs) > max_freq_points:
            freq_step = max(1, len(freqs) // max_freq_points)
            freqs = freqs[::freq_step]
            S_dB = S_dB[::freq_step, :]

        print(f"✅ Final shape: {S_dB.shape}, time: {len(times)}, freq: {len(freqs)}")

        return {
            'z': S_dB.tolist(),
            'x': times.tolist(),
            'y': freqs.tolist()
        }
    except Exception as e:
        print(f"❌ Spectrogram computation failed: {e}")
        import traceback
        traceback.print_exc()
        raise


def fft_magnitude_phase(signal_data):
    """Compute FFT and return magnitude and phase"""
    try:
        signal_data = np.array(signal_data, dtype=float)
        
        if len(signal_data) == 0:
            raise ValueError("Signal data is empty")
        
        if np.any(np.isnan(signal_data)) or np.any(np.isinf(signal_data)):
            signal_data = np.nan_to_num(signal_data, nan=0.0, posinf=0.0, neginf=0.0)
        
        fft_result = fft_custom(signal_data)
        magnitude = np.abs(fft_result)
        phase = np.angle(fft_result)

        return magnitude, phase, fft_result
    except Exception as e:
        print(f"❌ FFT magnitude/phase error: {e}")
        raise

def apply_equalization(signal, sample_rate, sliders):
    """
    Apply equalization with proper frequency removal and identity preservation
    """
    try:
        if not sliders or len(sliders) == 0:
            print("⚠️ No sliders provided, returning original signal")
            return signal

        signal = np.array(signal, dtype=float)

        if len(signal) == 0:
            return signal

        # Clean data
        if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
            print("⚠️ Cleaning NaN/Inf from input signal")
            signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)

        # ✅ CRITICAL FIX: Check if all sliders are at unity (1.0)
        all_unity = True
        for slider in sliders:
            value = float(slider.get('value', 1.0))
            if abs(value - 1.0) > 1e-6:  # Use epsilon comparison
                all_unity = False
                break
        
        if all_unity:
            print("✅ All sliders at unity gain - returning original signal (identity)")
            return signal

        original_length = len(signal)
        
        # Generate signal hash for caching
        signal_hash = get_signal_hash(signal, sample_rate)
        
        print(f"\n🎚️ Starting equalization: {original_length} samples @ {sample_rate}Hz")
        result = apply_equalization_direct(signal, sample_rate, sliders, original_length, signal_hash)
        print(f"✅ Equalization complete\n")
        
        return result
        
    except Exception as e:
        print(f"❌ Equalization failed: {e}")
        import traceback
        traceback.print_exc()
        raise


def apply_equalization_direct(signal, sample_rate, sliders, original_length, signal_hash=None):
    """
    Direct FFT processing with PROPER frequency removal/boosting
    SUPPORTS ALL GAIN VALUES: 0.0 (mute) to 2.0 (2x boost)
    Uses FFT caching for performance optimization.
    """
    print(f"🎛️ Applying equalization: {len(sliders)} sliders, signal length: {original_length}")
    
    # Check FFT cache
    cache_key = signal_hash if signal_hash is not None else get_signal_hash(signal, sample_rate)
    
    if cache_key in _fft_cache:
        fft_result, frequencies = _fft_cache[cache_key]
        print(f"✅ Using cached FFT (cache hit)")
    else:
        # Compute FFT and cache it
        print(f"💾 Computing FFT (cache miss)")
        fft_result = fft_custom(signal)
        N = len(fft_result)
        d = 1.0 / sample_rate
        frequencies = fftfreq_custom(N, d)
        # Cache the FFT result and frequencies
        _fft_cache[cache_key] = (fft_result, frequencies)
        print(f"💾 FFT cached for future use")
    
    N = len(fft_result)
    
    # ✅ Start with unity gain everywhere (1.0 = no change)
    gain_mask = np.ones(N, dtype=np.float64)  # Use float64 for better precision

    # Apply each slider's equalization
    for idx, slider in enumerate(sliders):
        freq_ranges = slider.get('freqRanges', [])
        if not freq_ranges:
            continue

        gain_factor = float(slider.get('value', 1.0))
        
        # ✅ Skip processing if gain is exactly 1.0
        if abs(gain_factor - 1.0) < 1e-9:
            continue
        
        print(f"  Slider {idx}: gain={gain_factor:.6f}, ranges={freq_ranges}")

        # Apply gain to each frequency range
        for freq_range in freq_ranges:
            if len(freq_range) != 2:
                continue

            min_freq = float(freq_range[0])
            max_freq = float(freq_range[1])

            # Validate range
            if min_freq >= max_freq or min_freq < 0:
                continue
            if max_freq > sample_rate / 2:
                max_freq = sample_rate / 2

            # Apply to BOTH positive AND negative frequencies
            abs_frequencies = np.abs(frequencies)
            freq_mask = (abs_frequencies >= min_freq) & (abs_frequencies <= max_freq)
            
            affected_bins = np.sum(freq_mask)
            if affected_bins > 0:
                print(f"    Range {min_freq}-{max_freq}Hz: affecting {affected_bins} bins")
            
            # Apply gain (multiplicative)
            gain_mask[freq_mask] *= gain_factor

    # Check if any modification was made
    modified_bins = np.sum(np.abs(gain_mask - 1.0) > 1e-9)
    
    if modified_bins == 0:
        print("✅ No frequency bins modified - returning original signal")
        return signal[:original_length]

    zeroed_bins = np.sum(np.abs(gain_mask) < 1e-9)
    print(f"  📊 Modified {modified_bins}/{N} bins, zeroed {zeroed_bins} bins")

    # Apply the gain mask
    fft_result_equalized = fft_result * gain_mask

    # Verify the effect
    original_energy = np.sum(np.abs(fft_result) ** 2)
    equalized_energy = np.sum(np.abs(fft_result_equalized) ** 2)
    energy_ratio = equalized_energy / original_energy if original_energy > 0 else 0
    print(f"  ⚡ Energy ratio: {energy_ratio:.4f}")

    # Convert back to time domain
    output_signal = ifft_custom(fft_result_equalized)
    output_signal = np.real(output_signal)

    # Truncate to original length
    if len(output_signal) > original_length:
        output_signal = output_signal[:original_length]
    elif len(output_signal) < original_length:
        output_signal = np.pad(output_signal, (0, original_length - len(output_signal)), mode='constant')

    # Normalize to prevent clipping (but don't if signal is near-zero)
    max_val = np.max(np.abs(output_signal))
    if max_val > 1.0:
        output_signal = output_signal / max_val * 0.95
        print(f"  🔊 Normalized by {max_val:.2f}x")
    elif max_val < 0.001:
        print(f"  ⚠️ Warning: Output signal very quiet (max={max_val:.6f})")

    return output_signal
    
def apply_equalization_chunked(signal, sample_rate, sliders, original_length, chunk_size=16384, overlap=4096):
    """Chunked processing with overlap-add"""
    if chunk_size & (chunk_size - 1) != 0:
        chunk_size = 2 ** int(np.ceil(np.log2(chunk_size)))
    
    hop_size = chunk_size - overlap
    num_chunks = int(np.ceil((len(signal) - overlap) / hop_size))
    padded_length = (num_chunks - 1) * hop_size + chunk_size
    
    signal_padded = np.pad(signal, (0, max(0, padded_length - len(signal))), mode='constant')
    window = np.hanning(chunk_size)
    
    output_signal = np.zeros(padded_length, dtype=float)
    window_sum = np.zeros(padded_length, dtype=float)
    
    for i in range(num_chunks):
        start_idx = i * hop_size
        end_idx = start_idx + chunk_size
        
        chunk = signal_padded[start_idx:end_idx] * window
        processed_chunk = apply_equalization_direct(chunk, sample_rate, sliders, chunk_size)
        processed_chunk = processed_chunk[:chunk_size] * window
        
        output_signal[start_idx:end_idx] += processed_chunk
        window_sum[start_idx:end_idx] += window ** 2
    
    window_sum[window_sum < 1e-8] = 1.0
    output_signal = output_signal / window_sum
    output_signal = output_signal[:original_length]
    
    max_val = np.max(np.abs(output_signal))
    if max_val > 1.0:
        output_signal = output_signal / max_val * 0.95
    
    return output_signal


def apply_equalization_chunked_parallel(signal, sample_rate, sliders, original_length, chunk_size=32768, overlap=8192):
    """Parallel chunked processing for long signals"""
    # Simplified version - falls back to sequential if needed
    return apply_equalization_chunked(signal, sample_rate, sliders, original_length, chunk_size, overlap)