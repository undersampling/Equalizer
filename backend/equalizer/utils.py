import numpy as np
import cmath

try:
    import librosa
except ImportError:
    librosa = None


def compute_spectrogram(samples, sr, n_fft=2048, hop_length=512, n_mels=128, fmax=8000,
                        use_mel=True, max_time_points=None, max_freq_points=None):
    if not librosa:
        return None

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