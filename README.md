# 🎚️ Signal Equalizer Web App

---

## 🚀 Overview

**Signal Equalizer** is a dynamic web-based audio processing tool designed for the music industry and biomedical applications (such as hearing aid calibration).

It allows users to manipulate signal frequency components through an intuitive interface, offering both **Generic** control for granular frequency scaling and **Customized Modes** for semantic audio adjustments (instruments, animals, and voices). The application features **real-time reconstruction**, **custom FFT implementations**, and an **AI-based comparison** module.

---

## 🧠 Features

### 🎛️ Generic Mode 

A flexible playground for signal analysis where users have full control over the frequency domain.

#### 🔍 Key Capabilities:
- **Arbitrary Subdivisions:** Users can divide the frequency range into unlimited custom subdivisions.
- **Dynamic UI Controls:** Add subdivisions one by one, controlling location, width, and scale (from 0 to 2) via sliders.
- **Save/Load Settings:** Export your specific frequency subdivision setup and reload it later.
- **Synthetic Signal Validation:** Includes a built-in synthetic signal generator (summation of pure frequencies) to validate equalizer behavior and frequency tracking.

| Generic Mode Interface |
|:---:|
| <img src="assets/generic_mode_screenshot.png" width="600"/> |
| *User defining frequency ranges and adjusting gains manually* |

---

### 🎨 Customized Modes

Pre-configured modes where sliders map to complex, non-continuous frequency ranges to isolate specific sound sources.

#### 1. 🎻 Musical Instruments Mode
- Control magnitude of specific instruments in a mixed track.
- **Targets:** Drums, Flute, Piano, Guitar (min. 4 instruments).

#### 2. 🐕 Animal Sounds Mode
- Isolate or suppress specific animal calls in a bio-acoustic mixture.
- **Targets:** Dog, Cat, Bird, Lion (min. 4 animals).

#### 3. 🗣️ Human Voices Mode
- Manipulate specific voice characteristics in a crowded recording.
- **Targets:** Male/Female, Young/Old, or specific languages.

| Custom Mode Interface |
|:---:|
| <img src="assets/custom_mode_screenshot.png" width="600"/> |
| *Sliders mapped to specific instruments rather than raw frequencies* |

---

### 👁️ Visualization & Playback

The UI is designed for synchronous analysis of Input vs. Output signals.

- **Linked Cine Viewers:**
  - Input and Output signals run in perfect sync.
  - Global Zoom, Pan, Play, Pause, and Speed Control.
- **Dual Spectrograms:**
  - Real-time visual feedback of frequency intensity for both input and output.
  - *Note: Built using a custom-coded Spectrogram implementation (No libraries used).*
- **Flexible Scales:**
  - Switch frequency graphs between **Linear Scale** and **Audiogram Scale** instantly.

#### 🎥 Application Demo
![Application Usage Demo](assets/app_demo_video.gif)
*Demonstration of loading a signal, adjusting sliders, and seeing real-time Spectrogram updates.*

---

### 🤖 AI vs. Classical Equalization

We have integrated Deep Learning models to compare classical DSP equalization against AI-based source separation.

- **Model Integration:** Pre-trained AI models integrated for 2 selected modes (e.g., Music & Voice).
- **Performance Comparison:** Assess the clarity and isolation quality of the manual Equalizer vs. the AI Model.

#### 🎥 AI Comparison Demo
![AI Comparison Demo](assets/ai_comparison_video.gif)
*Comparison of signal output: Classical Filters vs. AI Model.*

---

## 🧰 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React / canvas |
| **Backend** | Django / Python |
| **Core DSP** | **Custom Implementation** (FFT & Spectrogram written from scratch in NumPy) |
| **AI / ML** | PyTorch / TensorFlow |
| **Audio Processing** | SciPy (Signal generation), PyDub |


---

## ⚙️ Installation

```bash
# Clone the repository
git clone [[https://github.com/signal-equalizer.git](https://github.com/undersampling/Equalizer.git)](https://github.com/undersampling/Equalizer.git)

# Backend setup
cd backend
pip install -r requirements.txt
python manage.py runserver

# Frontend setup
cd ../frontend
npm install
npm run dev
