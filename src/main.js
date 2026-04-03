import './style.css';

console.log("AirDraw System Initializing - Draw & Erase Version");

// --- Audio Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const t = audioCtx.currentTime;
  
  if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
    gainNode.gain.setValueAtTime(0.3, t);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.start(t);
    osc.stop(t + 0.1);
  } else if (type === 'erase') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1000, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
    gainNode.gain.setValueAtTime(0.1, t);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
  } else if (type === 'draw') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    gainNode.gain.setValueAtTime(0.02, t);
    gainNode.gain.linearRampToValueAtTime(0.01, t + 0.1);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}

// Elements
const videoElement = document.getElementById('webcam');
const cameraCanvas = document.getElementById('camera-canvas');
const drawingCanvas = document.getElementById('drawing-canvas');
const uiCanvas = document.getElementById('ui-canvas');

const camCtx = cameraCanvas.getContext('2d');
const drawCtx = drawingCanvas.getContext('2d', { willReadFrequently: true });
const uiCtx = uiCanvas.getContext('2d');

const loadingScreen = document.getElementById('loading-screen');
const appContainer = document.getElementById('app');
const onboardingModal = document.getElementById('onboarding-modal');
const btnStart = document.getElementById('btn-start');

// Toolbar Elements
const colorSwatches = document.querySelectorAll('.color-swatch');
const thicknessSlider = document.getElementById('thickness-slider');
const thicknessValue = document.getElementById('thickness-value');
const glowSlider = document.getElementById('glow-slider');
const glowValue = document.getElementById('glow-value');
const btnUndo = document.getElementById('btn-undo');
const btnClear = document.getElementById('btn-clear');
const btnCamToggle = document.getElementById('btn-camera-toggle');
const btnSave = document.getElementById('btn-save');

const gestureIcon = document.getElementById('gesture-icon');
const gestureLabel = document.getElementById('gesture-label');
const cameraIndicator = document.getElementById('camera-mode-indicator');
const cameraModeText = document.getElementById('camera-mode-text');

// State Variables
let currentColor = 'rainbow';
let currentThickness = 6;
let currentGlow = 60;
let isCameraVisible = true;
let rainbowHue = 0;

let paths = []; // Stores {type: 'path', points, color, thickness, glow}
let currentPaths = [null, null];
let lastPos = [{x:null, y:null}, {x:null, y:null}];
let smoothPos = [{x:null, y:null}, {x:null, y:null}]; // Smoothed positions for stable drawing
let currentGestures = ['READY', 'READY'];
let previousGestures = ['READY', 'READY'];
const SMOOTH_FACTOR = 0.35; // Lower = smoother but more lag, higher = more responsive

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  cameraCanvas.width = drawingCanvas.width = uiCanvas.width = w;
  cameraCanvas.height = drawingCanvas.height = uiCanvas.height = h;
  drawCtx.lineCap = drawCtx.lineJoin = 'round';
  redrawAll();
}
window.addEventListener('resize', resize);
resize();

// --- Gesture Logic ---
function isFingerUp(landmarks, tipIndex, pipIndex) {
  return landmarks[tipIndex].y < landmarks[pipIndex].y;
}

function detectGesture(landmarks) {
  const indexUp = isFingerUp(landmarks, 8, 6);
  const middleUp = isFingerUp(landmarks, 12, 10);
  const ringUp = isFingerUp(landmarks, 16, 14);
  const pinkyUp = isFingerUp(landmarks, 20, 18);
  const thumbUp = landmarks[4].y < landmarks[3].y;

  const fingersUpCount = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

  // ☝️ Pointed finger only → DRAW
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'DRAW';

  // ✊ Closed fist (no fingers up, thumb tucked) → IDLE
  if (!indexUp && !middleUp && !ringUp && !pinkyUp && !thumbUp) return 'IDLE';

  // 🖐 Open palm (4+ fingers up) → IDLE  
  if (fingersUpCount >= 4) return 'IDLE';

  // 🤘 Rock-on (index + pinky up, middle + ring down) → ERASE
  if (indexUp && pinkyUp && !middleUp && !ringUp) return 'ERASE';

  // 👍 Thumb up → IDLE
  if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) return 'IDLE';

  return 'READY';
}

function updateHUD() {
  const primaryGesture = (currentGestures[0] !== 'READY') ? currentGestures[0] : currentGestures[1];

  switch(primaryGesture) {
    case 'DRAW':  gestureIcon.innerText = '☝️'; gestureLabel.innerText = 'Drawing'; break;
    case 'ERASE': gestureIcon.innerText = '🤘'; gestureLabel.innerText = 'Erasing'; break;
    case 'IDLE':  gestureIcon.innerText = '✊'; gestureLabel.innerText = 'Idle'; break;
    default:      gestureIcon.innerText = '👋'; gestureLabel.innerText = window.Hands ? 'Ready' : 'Pending'; break;
  }
}

// --- Drawing logic ---
function redrawAll() {
  drawCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';

  paths.forEach(obj => {
    if (obj.type !== 'path' || obj.points.length === 0) return;

    let activeColor = obj.color;
    if (obj.color === 'rainbow') activeColor = `hsl(${rainbowHue}, 100%, 50%)`;

    drawCtx.strokeStyle = activeColor;
    drawCtx.lineWidth = obj.thickness;
    drawCtx.shadowBlur = obj.glow > 0 ? obj.glow : 0;
    drawCtx.shadowColor = activeColor;

    drawCtx.beginPath();
    drawCtx.moveTo(obj.points[0].x, obj.points[0].y);
    for (let i = 1; i < obj.points.length; i++) {
      drawCtx.lineTo(obj.points[i].x, obj.points[i].y);
    }
    drawCtx.stroke();
  });
  drawCtx.shadowBlur = 0;
}

function processHand(results) {
  uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
  rainbowHue = (rainbowHue + 3) % 360;
  
  if (paths.some(p => p.color === 'rainbow')) redrawAll();

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    redrawAll();
    
    for (let i = 0; i < Math.min(results.multiHandLandmarks.length, 2); i++) {
        const landmarks = results.multiHandLandmarks[i];
        const gesture = detectGesture(landmarks);
        previousGestures[i] = currentGestures[i];
        currentGestures[i] = gesture;

        // Raw fingertip position (index tip = 8, palm center = 9)
        const rawCx = landmarks[8].x * uiCanvas.width;
        const rawCy = landmarks[8].y * uiCanvas.height;
        const px = landmarks[9].x * uiCanvas.width;
        const py = landmarks[9].y * uiCanvas.height;

        // Exponential moving average smoothing — reduces jitter without big lag
        if (smoothPos[i].x === null) {
          smoothPos[i] = { x: rawCx, y: rawCy };
        } else {
          smoothPos[i].x = smoothPos[i].x + SMOOTH_FACTOR * (rawCx - smoothPos[i].x);
          smoothPos[i].y = smoothPos[i].y + SMOOTH_FACTOR * (rawCy - smoothPos[i].y);
        }
        const cx = smoothPos[i].x;
        const cy = smoothPos[i].y;

        let activeColor = currentColor === 'rainbow' ? `hsl(${rainbowHue}, 100%, 50%)` : currentColor;

        if (gesture === 'DRAW') {
          if (!currentPaths[i]) {
            currentPaths[i] = { type: 'path', points: [], color: currentColor, thickness: currentThickness, glow: currentGlow };
            paths.push(currentPaths[i]);
            lastPos[i] = { x: cx, y: cy };
          }
          currentPaths[i].points.push({ x: cx, y: cy });
          playSound('draw');

          uiCtx.beginPath();
          uiCtx.arc(cx, cy, currentThickness / 2 + 2, 0, Math.PI * 2);
          uiCtx.fillStyle = 'white';
          uiCtx.shadowBlur = 10;
          uiCtx.shadowColor = activeColor;
          uiCtx.fill();
          uiCtx.shadowBlur = 0;

        } else if (gesture === 'ERASE') {
          currentPaths[i] = null;
          smoothPos[i] = { x: null, y: null }; // Reset smooth on erase so no drift
          const eraseRadius = 80;
          let modified = false;

          for (let p = paths.length - 1; p >= 0; p--) {
            const obj = paths[p];
            if (obj.type === 'path') {
              for (let pt of obj.points) {
                if (Math.hypot(pt.x - px, pt.y - py) < eraseRadius) {
                  paths.splice(p, 1);
                  modified = true;
                  break;
                }
              }
            }
          }
          if (modified) playSound('erase');

          uiCtx.beginPath();
          uiCtx.arc(px, py, eraseRadius, 0, Math.PI * 2);
          uiCtx.fillStyle = 'rgba(255, 0, 0, 0.2)';
          uiCtx.fill();
          uiCtx.strokeStyle = '#ff0044';
          uiCtx.lineWidth = 2;
          uiCtx.stroke();

        } else {
          // IDLE / READY — stop drawing, show soft cursor
          currentPaths[i] = null;
          uiCtx.beginPath();
          uiCtx.arc(cx, cy, 8, 0, Math.PI * 2);
          uiCtx.fillStyle = 'rgba(255,255,255,0.4)';
          uiCtx.fill();
        }
    }
  } else {
    currentGestures = ['READY', 'READY'];
    previousGestures = ['READY', 'READY'];
    currentPaths = [null, null];
    smoothPos = [{x: null, y: null}, {x: null, y: null}];
  }
  updateHUD();
}

// Setup MediaPipe
loadingScreen.classList.add('hidden');
appContainer.classList.remove('hidden');
onboardingModal.classList.remove('hidden');

let hands;

async function startSystem() {
  document.getElementById('loader-subtitle').innerHTML = "Initializing camera & ML models...";
  loadingScreen.classList.remove('hidden');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' }
    });
    videoElement.srcObject = stream;
    await new Promise(resolve => { videoElement.onloadeddata = () => resolve(); });
    videoElement.play();

    if (typeof window.Hands === 'undefined') throw new Error("MediaPipe not loaded");
    
    hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    hands.onResults(processHand);

    await hands.initialize();
    loadingScreen.classList.add('hidden');

    function gameLoop() {
      if (videoElement.readyState >= 2) hands.send({ image: videoElement });
      requestAnimationFrame(gameLoop);
    }
    gameLoop();
  } catch (err) {
    document.getElementById('loader-subtitle').innerHTML = "Camera Error.";
    document.getElementById('loader-fill').style.background = "#ff0044";
    document.getElementById('loader-fill').style.width = "100%";
  }
}

// Events
btnStart.addEventListener('click', () => {
  onboardingModal.classList.add('hidden');
  audioCtx.resume(); // Ensure audio unlocks!
  startSystem();
  playSound('click');
});

colorSwatches.forEach(swatch => {
  swatch.addEventListener('click', (e) => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    e.target.classList.add('active');
    currentColor = e.target.getAttribute('data-color');
    playSound('click');
  });
});

thicknessSlider.addEventListener('change', (e) => {
  currentThickness = parseInt(e.target.value);
  thicknessValue.innerText = currentThickness + 'px';
  playSound('click');
});

glowSlider.addEventListener('change', (e) => {
  currentGlow = parseInt(e.target.value);
  glowValue.innerText = currentGlow + '%';
  playSound('click');
});

btnUndo.addEventListener('click', () => { paths.pop(); redrawAll(); playSound('click'); });
btnClear.addEventListener('click', () => { paths = []; redrawAll(); playSound('erase'); });
btnSave.addEventListener('click', () => { 
  playSound('click');
  const comp = document.createElement('canvas');
  comp.width = drawingCanvas.width;
  comp.height = drawingCanvas.height;
  const cCtx = comp.getContext('2d');
  
  cCtx.fillStyle = '#111';
  cCtx.fillRect(0, 0, comp.width, comp.height);

  drawCtx.shadowBlur = 0; 
  cCtx.drawImage(drawingCanvas, 0, 0);

  const link = document.createElement('a');
  link.download = 'air-draw-art.png';
  link.href = comp.toDataURL();
  link.click();
});
