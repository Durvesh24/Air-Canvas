# 🎨 Air Draw - Gesture-Based Doodler

Welcome to **Air Draw**, an interactive, webcam-powered web application that lets you draw and create art in mid-air using just your hands! This project leverages modern Machine Learning and computer vision via Google's MediaPipe to seamlessly translate real-world hand gestures into dynamic, digital neon art.

## ✨ Features

- **☝️ Freehand Drawing:** Simply lift your index finger to sketch in thin air securely.
- **👐 Dual-Wielding Support:** Track up to two hands at once! Draw simultaneously with both hands, or draw with your left hand while erasing with your right.
- **🌈 Responsive Neon Aesthetics:** Switch between beautiful dark-mode glassmorphic colors, adjust thickness to 24px, or slide the glow intensity up to 100% for a true Cyberpunk feel.
- **🎶 Interactive Synth Audio Engine:** Procedurally generated synth responses for UI clicks, ambient hums during drawing, synth chords for shape-stamping, and whoosh sounds when erasing.
- **🔣 Vector Shape & Emote Stamping:**
  - `✊ Closed Fist`: Stamps a vibrant circle.
  - `🖐️ Open Palm`: Stamps a large geometric rectangle.
  - `👌 OK/Love Sign`: Emits a beautifully mapped Glowing Heart (❤️).
  - `✌️ Peace Sign`: Stamps a detailed Vector Peace Logo (☮️).
  - `🤘 Rock-On Sign`: Seamlessly erases any shapes or lines you sweep over.
  - `👍 Thumb Up`: Enters Idle/Hover mode instantly.
- **📸 Artistic Save Tool:** Toggle your camera feed on or off to preview exactly what your art looks like on pure black, and save your masterpiece straight to your computer as a `.png`.

## 🚀 Tech Stack
- **Frontend Framework:** Vanilla JavaScript + Vite.
- **Machine Learning:** `MediaPipe` (Hands Model) - running efficiently inside the browser via precise CDN injection.
- **Graphics Rendering:** HTML5 Canvas API (with hardware accelerated `willReadFrequently: true`).
- **Styling:** Custom CSS (incorporating native variables, modern glassmorphism, flexbox, and complex keyframe animations).
- **Audio:** Native Web Audio API (`AudioContext`) generating low-latency interactive oscillator sounds without any bloated mp3 files!

## 💻 Running the App

It is extraordinarily easy to boot this up locally:

1. Clone this repository.
2. Ensure you have `Node.js` installed.
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Start the Dev Server:
   ```bash
   npm run dev
   ```
5. Navigate to `http://localhost:5173/` and grant Camera Permissions when the browser prompts you!

## 🛠 Lessons Learned & Iteration
Building this application required heavily optimizing canvas rendering logic for 30+ FPS environments, bypassing bundler bottlenecks to inject MediaPipe gracefully, designing complex vector mapping equations for specialized UI symbols, and translating noisy ML landmarks into butter-smooth UX operations. 
