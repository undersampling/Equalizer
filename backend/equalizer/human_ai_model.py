"""
huggingface-hub    0.19.4
speechbrain        1.0.0
torch              2.7.1
torchaudio         2.7.1

"""
import torch
import torchaudio
import os
import numpy as np

os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

if not hasattr(torchaudio, 'list_audio_backends'):
    torchaudio.list_audio_backends = lambda: []
    torchaudio.get_audio_backend = lambda: "sox_io"
    torchaudio.set_audio_backend = lambda x: None

from speechbrain.inference.separation import SepformerSeparation

print("=" * 60)
print("Voice Separation - 3 Speakers")
print("=" * 60)

# ============================================
# CONFIGURATION
# ============================================
AUDIO_FILE_PATH = ""  # <<< CHANGE THIS
# ============================================

# Load model
print("\n[1/4] Loading model...")
try:
    model = SepformerSeparation.from_hparams(
        source="speechbrain/sepformer-wsj03mix",
        savedir='pretrained_models/sepformer-wsj03mix',
        run_opts={"device": "cuda" if torch.cuda.is_available() else "cpu"},
        use_auth_token=False
    )
    print("✓ Model loaded")
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

# Load audio
print(f"\n[2/4] Loading audio: {AUDIO_FILE_PATH}")
try:
    mixed_tensor, original_sample_rate = torchaudio.load(AUDIO_FILE_PATH)

    if mixed_tensor.shape[0] > 1:
        mixed_tensor = torch.mean(mixed_tensor, dim=0, keepdim=True)

    model_sample_rate = 8000
    if original_sample_rate != model_sample_rate:
        resampler = torchaudio.transforms.Resample(original_sample_rate, model_sample_rate)
        mixed_tensor = resampler(mixed_tensor)
        sample_rate = model_sample_rate
    else:
        sample_rate = original_sample_rate

    duration = mixed_tensor.shape[1] / sample_rate
    print(f"✓ Audio loaded: {duration:.2f}s at {sample_rate}Hz")
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

# Separate voices
print("\n[3/4] Separating voices...")
try:
    est_sources = model.separate_batch(mixed_tensor)
    separated_sources = est_sources[0].cpu().numpy()
    print(f"✓ Separated into {separated_sources.shape[-1]} voices")
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

# Save separated audio files
print("\n[4/4] Saving separated voices...")
try:
    for i in range(separated_sources.shape[-1]):
        source_tensor = torch.from_numpy(separated_sources[:, i]).unsqueeze(0)
        filename = f'voice_{i + 1}.wav'
        torchaudio.save(filename, source_tensor, sample_rate)
        print(f"✓ Saved: {filename}")

    if original_sample_rate != sample_rate:
        resampler_up = torchaudio.transforms.Resample(sample_rate, original_sample_rate)
        for i in range(separated_sources.shape[-1]):
            source_tensor = torch.from_numpy(separated_sources[:, i]).unsqueeze(0)
            upsampled = resampler_up(source_tensor)
            filename = f'voice_{i + 1}_hq.wav'
            torchaudio.save(filename, upsampled, original_sample_rate)
            print(f"✓ Saved: {filename} (high quality)")

    print(f"\n✓ Complete! Generated {separated_sources.shape[-1]} separated voice files")
except Exception as e:
    print(f"✗ Error: {e}")

print("=" * 60)