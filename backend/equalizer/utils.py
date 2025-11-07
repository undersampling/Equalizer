import numpy as np
import cmath


def stft_custom(y, n_fft=2048, hop_length=512, win_length=None, window='hann'):
    """
    Custom Short-Time Fourier Transform using custom FFT implementation.
    
    Args:
        y: Input signal (1D numpy array)
        n_fft: FFT window size
        hop_length: Number of samples between successive frames
        win_length: Window length (defaults to n_fft)
        window: Window function type ('hann' or 'hamming')
    
    Returns:
        Complex STFT matrix (frequency x time)
    """
    if win_length is None:
        win_length = n_fft
    
    # Convert signal to numpy array
    y = np.array(y, dtype=float)
    signal_length = len(y)
    
    # Create window function
    if window == 'hann':
        # Hann window: w(n) = 0.5 * (1 - cos(2πn/(N-1)))
        window_func = np.array([0.5 * (1 - np.cos(2 * np.pi * n / (win_length - 1))) 
                                if win_length > 1 else 1.0 
                                for n in range(win_length)])
    elif window == 'hamming':
        # Hamming window: w(n) = 0.54 - 0.46 * cos(2πn/(N-1))
        window_func = np.array([0.54 - 0.46 * np.cos(2 * np.pi * n / (win_length - 1)) 
                                if win_length > 1 else 1.0 
                                for n in range(win_length)])
    else:
        # Default to rectangular window
        window_func = np.ones(win_length)
    
    # Pad the signal
    # Center the window: pad on both sides
    pad_length = n_fft // 2
    y_padded = np.pad(y, (pad_length, pad_length), mode='constant')
    
    # Calculate number of frames
    n_frames = 1 + (len(y_padded) - n_fft) // hop_length
    
    # Initialize STFT matrix
    # STFT returns n_fft//2 + 1 frequency bins for real signals
    stft_matrix = np.zeros((n_fft // 2 + 1, n_frames), dtype=complex)
    
    # Process each frame
    for i in range(n_frames):
        # Extract frame of length n_fft
        start_idx = i * hop_length
        end_idx = start_idx + n_fft
        
        if end_idx > len(y_padded):
            # Handle last frame if signal is shorter
            frame = np.zeros(n_fft)
            available_length = len(y_padded) - start_idx
            frame[:available_length] = y_padded[start_idx:]
        else:
            frame = y_padded[start_idx:end_idx]
        
        # Apply window function
        # Window is applied to the first win_length samples, rest are zero
        if win_length <= n_fft:
            frame_windowed = np.zeros(n_fft)
            frame_windowed[:win_length] = frame[:win_length] * window_func
        else:
            # If win_length > n_fft, truncate window
            frame_windowed = frame * window_func[:n_fft]
        
        # Compute FFT using custom FFT
        fft_result = fft_custom(frame_windowed)
        
        # Take only positive frequencies (first n_fft//2 + 1 bins)
        stft_matrix[:, i] = fft_result[:n_fft // 2 + 1]
    
    return stft_matrix


def hz_to_mel(hz):
    """
    Convert frequency in Hz to Mel scale.
    Using the formula: mel = 2595 * log10(1 + hz / 700)
    """
    return 2595.0 * np.log10(1.0 + hz / 700.0)


def mel_to_hz(mel):
    """
    Convert frequency in Mel scale to Hz.
    Using the formula: hz = 700 * (10^(mel/2595) - 1)
    """
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def mel_frequencies_custom(n_mels=128, fmin=0.0, fmax=8000.0):
    """
    Custom implementation of mel frequency bins.
    Returns the center frequencies of each mel bin.
    
    Args:
        n_mels: Number of mel bins
        fmin: Minimum frequency (Hz)
        fmax: Maximum frequency (Hz)
    
    Returns:
        Array of center mel frequencies in Hz (length n_mels)
    """
    # Convert to mel scale
    mel_min = hz_to_mel(fmin)
    mel_max = hz_to_mel(fmax)
    
    # Create evenly spaced points in mel scale (n_mels + 2 for edges)
    mels = np.linspace(mel_min, mel_max, n_mels + 2)
    
    # Convert back to Hz
    freqs = np.array([mel_to_hz(m) for m in mels])
    
    # Return center frequencies (exclude first and last edge frequencies)
    return freqs[1:-1]


def mel_filter_bank_custom(sr, n_fft, n_mels=128, fmin=0.0, fmax=8000.0):
    """
    Create a mel filter bank matrix.
    
    Args:
        sr: Sample rate
        n_fft: FFT window size
        n_mels: Number of mel bins
        fmin: Minimum frequency (Hz)
        fmax: Maximum frequency (Hz)
    
    Returns:
        Filter bank matrix (n_mels x n_fft//2 + 1)
    """
    # Convert to mel scale
    mel_min = hz_to_mel(fmin)
    mel_max = hz_to_mel(fmax)
    
    # Create evenly spaced points in mel scale (n_mels + 2 for filter edges)
    mels = np.linspace(mel_min, mel_max, n_mels + 2)
    
    # Convert back to Hz to get filter edge frequencies
    mel_freqs = np.array([mel_to_hz(m) for m in mels])
    
    # Get FFT bin frequencies
    d = 1.0 / sr
    fft_freqs = fftfreq_custom(n_fft, d)
    # Only use positive frequencies
    fft_freqs = fft_freqs[:n_fft // 2 + 1]
    
    # Initialize filter bank
    filter_bank = np.zeros((n_mels, len(fft_freqs)))
    
    # Create triangular filters
    for i in range(n_mels):
        # Lower, center, and upper frequencies for this mel bin
        lower = mel_freqs[i]
        center = mel_freqs[i + 1]
        upper = mel_freqs[i + 2]
        
        # Find FFT bins that fall within this mel filter
        for j, freq in enumerate(fft_freqs):
            if lower <= freq <= center:
                # Rising slope
                filter_bank[i, j] = (freq - lower) / (center - lower) if center != lower else 0
            elif center < freq <= upper:
                # Falling slope
                filter_bank[i, j] = (upper - freq) / (upper - center) if upper != center else 0
    
    return filter_bank


def power_to_db_custom(S, ref=1.0, amin=1e-10, top_db=80.0):
    """
    Convert power spectrogram to decibel scale.
    
    Args:
        S: Power spectrogram
        ref: Reference value for dB calculation
        amin: Minimum value to avoid log(0)
        top_db: Maximum dB value to clip at
    
    Returns:
        Spectrogram in dB scale
    """
    S = np.array(S)
    S = np.maximum(S, amin)
    S_db = 10.0 * np.log10(S / ref)
    S_db = np.maximum(S_db, S_db.max() - top_db)
    return S_db


def amplitude_to_db_custom(S, ref=1.0, amin=1e-10, top_db=80.0):
    """
    Convert amplitude spectrogram to decibel scale.
    
    Args:
        S: Amplitude spectrogram
        ref: Reference value for dB calculation
        amin: Minimum value to avoid log(0)
        top_db: Maximum dB value to clip at
    
    Returns:
        Spectrogram in dB scale
    """
    S = np.array(S)
    S = np.maximum(np.abs(S), amin)
    S_db = 20.0 * np.log10(S / ref)
    S_db = np.maximum(S_db, S_db.max() - top_db)
    return S_db


def compute_spectrogram(samples, sr, n_fft=2048, hop_length=512, n_mels=128, fmax=8000,
                        use_mel=True, max_time_points=None, max_freq_points=None):
    """
    Compute spectrogram using custom FFT implementation.
    
    Args:
        samples: Input signal
        sr: Sample rate
        n_fft: FFT window size
        hop_length: Hop length between frames
        n_mels: Number of mel bins (if use_mel=True)
        fmax: Maximum frequency
        use_mel: Whether to use mel scale
        max_time_points: Maximum number of time points (downsample if needed)
        max_freq_points: Maximum number of frequency points (downsample if needed)
    
    Returns:
        Dictionary with 'z' (spectrogram), 'x' (times), 'y' (frequencies)
    """
    # Compute STFT using custom implementation
    stft = stft_custom(samples, n_fft=n_fft, hop_length=hop_length, window='hann')
    
    if use_mel:
        # Compute mel spectrogram
        # Get magnitude spectrogram
        magnitude = np.abs(stft)
        power = magnitude ** 2
        
        # Create mel filter bank
        mel_bank = mel_filter_bank_custom(sr, n_fft, n_mels=n_mels, fmin=0.0, fmax=fmax)
        
        # Apply mel filter bank
        mel_spectrogram = np.dot(mel_bank, power)
        
        # Convert to dB
        S_dB = power_to_db_custom(mel_spectrogram, ref=np.max(mel_spectrogram))
        
        # Get mel frequencies
        freqs = mel_frequencies_custom(n_mels=n_mels, fmin=0.0, fmax=fmax)
    else:
        # Use linear scale
        magnitude = np.abs(stft)
        S_dB = amplitude_to_db_custom(magnitude, ref=np.max(magnitude))
        
        # Get FFT frequencies
        d = 1.0 / sr
        freqs = fftfreq_custom(n_fft, d)
        # Only positive frequencies
        freqs = freqs[:n_fft // 2 + 1]
        
        # Filter by fmax
        freq_mask = freqs <= fmax
        freqs = freqs[freq_mask]
        S_dB = S_dB[freq_mask, :]
    
    # Clip values
    S_dB = np.clip(S_dB, -80, 0)
    
    # Calculate time axis
    # Each frame is separated by hop_length samples
    # Time per frame = hop_length / sample_rate
    n_frames = S_dB.shape[1]
    times = np.array([i * hop_length / sr for i in range(n_frames)])
    
    # Downsample if needed
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


def fftfreq_custom(n, d=1.0):
    """
    Custom implementation of FFT frequency bins calculation.
    
    Returns the Discrete Fourier Transform sample frequencies.
    Matches the behavior of np.fft.fftfreq exactly.
    
    For a signal of length n with sample spacing d:
    - Even n: frequencies are [0, 1, ..., n/2-1, -n/2, ..., -1] / (d * n)
    - Odd n: frequencies are [0, 1, ..., (n-1)/2, -(n-1)/2, ..., -1] / (d * n)
    
    Args:
        n: Number of samples (int)
        d: Sample spacing (inverse of sample rate), default 1.0
    
    Returns:
        Array of sample frequencies (numpy array of floats)
    """
    if n <= 0:
        return np.array([])
    
    # Calculate frequencies using vectorized operations
    # Match numpy's exact behavior:
    # For even n: k in [0, n/2-1] are positive, k in [n/2, n-1] are negative
    # For odd n: k in [0, (n-1)/2] are positive, k in [(n+1)/2, n-1] are negative
    k = np.arange(n, dtype=float)
    
    # Calculate the split point
    # For even n: split at n/2 (so k < n/2 are positive)
    # For odd n: split at (n+1)/2 (so k < (n+1)/2 are positive)
    # This is exactly (n+1)//2 for both cases
    mid_point = (n + 1) // 2
    
    # Calculate frequencies
    # For k < mid_point: frequency = k / (d * n) [positive]
    # For k >= mid_point: frequency = (k - n) / (d * n) [negative]
    frequencies = np.where(k < mid_point,
                          k / (d * n),
                          (k - n) / (d * n))
    
    return frequencies


def fft_custom(x):
    """
    Custom implementation of Fast Fourier Transform using Cooley-Tukey algorithm

    This is a recursive implementation of the FFT algorithm:
    1. Divide: Split the input into even and odd indexed elements
    2. Conquer: Recursively compute FFT of each half
    3. Combine: Combine the results using the FFT butterfly operation

    Time Complexity: O(N log N)
    Space Complexity: O(N log N) due to recursion

    Args:
        x: Input signal (numpy array or list of complex numbers)

    Returns:
        Complex array representing frequency domain
    """
    x = np.array(x, dtype=complex)
    N = len(x)

    # Base case: if input is single element, return as is
    if N <= 1:
        return x

    # Ensure N is power of 2 for simplicity (pad if necessary)
    if N & (N - 1) != 0:
        # Find next power of 2
        next_pow2 = 2 ** int(np.ceil(np.log2(N)))
        x = np.pad(x, (0, next_pow2 - N), mode='constant')
        N = next_pow2

    # Divide: split into even and odd indices
    even = fft_custom(x[0::2])  # Even indexed elements
    odd = fft_custom(x[1::2])  # Odd indexed elements

    # Conquer & Combine: Apply FFT butterfly operation
    # The twiddle factor: W_N^k = e^(-2πik/N)
    T = np.array([cmath.exp(-2j * cmath.pi * k / N) * odd[k] for k in range(N // 2)])

    # Combine results
    # X[k] = E[k] + W_N^k * O[k]
    # X[k + N/2] = E[k] - W_N^k * O[k]
    result = np.concatenate([even + T, even - T])

    return result


def ifft_custom(x):
    """
    Custom implementation of Inverse Fast Fourier Transform using Cooley-Tukey algorithm
    
    IFFT can be computed using: IFFT(X) = (1/N) * conjugate(FFT(conjugate(X)))
    
    Args:
        x: Input frequency-domain signal (numpy array of complex numbers)
    
    Returns:
        Complex array representing time domain (will be real for real input signals)
    """
    x = np.array(x, dtype=complex)
    N = len(x)
    
    if N <= 1:
        return x
    
    # Use the relationship: IFFT(X) = (1/N) * conjugate(FFT(conjugate(X)))
    # Take conjugate, apply FFT, take conjugate again, and normalize
    result = np.conj(fft_custom(np.conj(x))) / N
    
    return result


def fft_magnitude_phase(signal_data):
    """
    Compute FFT and return magnitude and phase

    Args:
        signal_data: Input time-domain signal

    Returns:
        tuple: (magnitude, phase, fft_result)
    """
    # Convert to numpy array
    signal_data = np.array(signal_data, dtype=float)

    # Apply FFT
    fft_result = fft_custom(signal_data)

    # Calculate magnitude and phase
    magnitude = np.abs(fft_result)
    phase = np.angle(fft_result)

    return magnitude, phase, fft_result


def apply_equalization(signal, sample_rate, sliders):
    """
    Apply equalization to signal based on slider frequency ranges and gain factors.
    
    This function applies gain to specific frequency ranges using FFT-based equalization:
    1. Converts signal to frequency domain using custom FFT
    2. For each slider, applies gain to frequencies within the specified range
    3. Converts back to time domain using custom IFFT
    
    Args:
        signal: Input time-domain signal (numpy array)
        sample_rate: Sample rate of the signal (Hz)
        sliders: List of slider dictionaries, each containing:
            - freqRanges: List of [min_freq, max_freq] pairs (frequency intervals)
            - value: Gain factor (1.0 = unity gain, <1.0 = attenuation, >1.0 = amplification)
    
    Returns:
        Equalized signal (numpy array)
    """
    if not sliders or len(sliders) == 0:
        return signal
    
    # Convert to numpy array if not already
    signal = np.array(signal, dtype=float)
    
    # Handle empty signal
    if len(signal) == 0:
        return signal
    
    # Handle NaN or Inf values
    if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
        signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)
    
    # Store original length for later truncation (FFT may pad to power of 2)
    original_length = len(signal)
    
    # Use custom FFT implementation
    # Compute FFT using the custom function
    fft_result = fft_custom(signal)
    
    # Get the actual length after FFT (may be padded to power of 2)
    N = len(fft_result)
    
    # Calculate frequency bins using custom fftfreq function
    # d = 1 / sample_rate is the sample spacing
    d = 1.0 / sample_rate
    frequencies = fftfreq_custom(N, d)
    
    # Create a gain mask (initially all ones - no change)
    gain_mask = np.ones(N, dtype=float)
    
    # Apply each slider's equalization
    for slider in sliders:
        # Get frequency ranges for this slider
        freq_ranges = slider.get('freqRanges', [])
        if not freq_ranges:
            continue
        
        # Get gain factor (value)
        gain_factor = float(slider.get('value', 1.0))
        
        # Skip if gain is 1.0 (no change)
        if gain_factor == 1.0:
            continue
        
        # Apply gain to each frequency range
        for freq_range in freq_ranges:
            if len(freq_range) != 2:
                continue
            
            min_freq = float(freq_range[0])
            max_freq = float(freq_range[1])
            
            # Ensure valid frequency range
            if min_freq >= max_freq:
                continue
            if min_freq < 0:
                min_freq = 0
            if max_freq > sample_rate / 2:
                max_freq = sample_rate / 2
            
            # Find frequency bins within the range using vectorized operations
            # Handle both positive and negative frequencies (FFT symmetry)
            abs_frequencies = np.abs(frequencies)
            freq_mask = (abs_frequencies >= min_freq) & (abs_frequencies <= max_freq)
            
            # Apply gain to the selected frequency bins
            gain_mask[freq_mask] *= gain_factor
    
    # Apply the gain mask to the FFT result
    # We multiply both magnitude and preserve phase
    fft_result_equalized = fft_result * gain_mask
    
    # Convert back to time domain using custom IFFT
    output_signal = ifft_custom(fft_result_equalized)
    
    # Extract real part (input was real, so output should be real)
    output_signal = np.real(output_signal)
    
    # Truncate to original length (in case FFT padded to power of 2)
    if len(output_signal) > original_length:
        output_signal = output_signal[:original_length]
    elif len(output_signal) < original_length:
        # This shouldn't happen, but pad with zeros if it does
        output_signal = np.pad(output_signal, (0, original_length - len(output_signal)), mode='constant')
    
    # Normalize to prevent clipping (optional, can be adjusted)
    max_val = np.max(np.abs(output_signal))
    if max_val > 1.0:
        output_signal = output_signal / max_val * 0.95
    
    return output_signal