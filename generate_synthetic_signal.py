import numpy as np
from scipy.io.wavfile import write

# --- Configuration ---
SAMPLE_RATE = 44100  # Standard sample rate
DURATION = 10        # 10 seconds long
FILENAME = "synthetic_test_signal22.wav"
NUM_CHANNELS = 1     
HEADROOM = 0.9       # Normalize to 90% peak to prevent any clipping

# --- Frequencies and Amplitudes to test ---
waves_to_generate = [
    {'freq': 100,   'amp': 1.0, 'type': 'sine'},
    {'freq': 250,   'amp': 0.8, 'type': 'cosine'},
    {'freq': 500,   'amp': 0.9, 'type': 'sine'},
    {'freq': 1000,  'amp': 1.0, 'type': 'cosine'},
    {'freq': 2000,  'amp': 0.7, 'type': 'sine'},
    {'freq': 4000,  'amp': 0.6, 'type': 'cosine'},
    {'freq': 8000,  'amp': 0.5, 'type': 'sine'},
    {'freq': 12000, 'amp': 0.4, 'type': 'cosine'}
]

# --- Generate Time Array ---
num_samples = int(SAMPLE_RATE * DURATION)
t = np.linspace(0., DURATION, num_samples, endpoint=False)

# --- Create Empty Signal ---
final_signal = np.zeros(num_samples, dtype=np.float64)

# --- Generate and Add all waves ---
for wave in waves_to_generate:
    freq = wave['freq']
    amp = wave['amp']
    wave_type = wave['type']
    omega = 2 * np.pi * freq
    
    if wave_type == 'sine':
        final_signal += amp * np.sin(omega * t)
    elif wave_type == 'cosine':
        final_signal += amp * np.cos(omega * t)

# --- Normalize (Robust Method) ---
# This is now essential because amplitudes are different.
# 1. Find the actual peak amplitude in the combined signal
actual_max_amplitude = np.max(np.abs(final_signal))
normalized_signal = (final_signal / actual_max_amplitude) * HEADROOM

# --- Convert to 16-bit Integer ---
# WAV files typically store audio as 16-bit integers (range -32768 to 32767).
signal_int16 = np.int16(normalized_signal * 32767)

# --- Write to WAV File ---
try:
    write(FILENAME, SAMPLE_RATE, signal_int16)
    print(f"\nSUCCESS: File '{FILENAME}' created successfully.")
except Exception as e:
    print(f"\nERROR: Could not write file. {e}")