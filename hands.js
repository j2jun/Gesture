// Browser glue shared by index.html and slides.html: model, camera, drawing, saved custom gestures.
import { FilesetResolver, GestureRecognizer, DrawingUtils } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs';
import { features, classify } from './logic.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const MIN_SCORE = 0.5; // below this, say "unclear" instead of guessing
const STORE = 'gesture.custom.v1';

// Category names come from MediaPipe's built-in gesture model.
export const LABELS = {
  Closed_Fist: ['✊', 'Fist'], Open_Palm: ['✋', 'Open palm'], Pointing_Up: ['☝️', 'Pointing up'],
  Thumb_Up: ['👍', 'Thumbs up'], Thumb_Down: ['👎', 'Thumbs down'], Victory: ['✌️', 'Peace'], ILoveYou: ['🤟', 'I love you'],
};

export async function loadRecognizer(runningMode = 'VIDEO') {
  const vision = await FilesetResolver.forVisionTasks(WASM);
  const make = (delegate) => GestureRecognizer.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode, numHands: 2 });
  try { return await make('GPU'); } catch { return make('CPU'); } // some browsers lack WebGL2
}

// One entry per hand. Your own trained gestures win over the built-in ones when they match.
export function readHands(result, custom = []) {
  return result.landmarks.map((hand, i) => {
    const f = features(hand, result.handedness[i]?.[0]?.categoryName === 'Left');
    const mine = custom.length ? classify(custom, f) : null;
    if (mine) return { key: `custom:${mine.label}`, emoji: '⭐', name: mine.label, score: mine.score, f };
    const top = result.gestures[i]?.[0];
    if (top && LABELS[top.categoryName] && top.score >= MIN_SCORE) {
      const [emoji, name] = LABELS[top.categoryName];
      return { key: top.categoryName, emoji, name, score: top.score, f };
    }
    return { key: null, emoji: '🖐️', name: 'Hand, gesture unclear', score: 0, f };
  });
}

export function drawFrame(canvas, source, result) {
  const ctx = canvas.getContext('2d');
  canvas.width = source.videoWidth || source.naturalWidth;
  canvas.height = source.videoHeight || source.naturalHeight;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const draw = new DrawingUtils(ctx), lw = Math.max(2, canvas.width / 200);
  for (const hand of result.landmarks) {
    draw.drawConnectors(hand, GestureRecognizer.HAND_CONNECTIONS, { color: '#19b37d', lineWidth: lw });
    draw.drawLandmarks(hand, { color: '#fff', fillColor: '#19b37d', lineWidth: 1, radius: lw * 1.2 });
  }
}

// Calls onFrame(now) once per new video frame. Returns a stop() function.
export async function startCamera(video, onFrame) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } });
  video.srcObject = stream;
  await video.play();
  let on = true, last = -1;
  (function loop() {
    if (!on) return;
    if (video.readyState >= 2 && video.currentTime !== last) { last = video.currentTime; onFrame(performance.now()); }
    requestAnimationFrame(loop);
  })();
  return () => { on = false; stream.getTracks().forEach((t) => t.stop()); };
}

export function cameraError(err) {
  if (!navigator.mediaDevices?.getUserMedia) return 'The camera needs https or localhost.';
  return err.name === 'NotAllowedError' ? 'Camera permission was denied. Allow it in your browser settings.' : `Couldn't open the camera (${err.name}).`;
}

// Custom gesture samples [{ label, f }], kept in this browser. Shared by both pages on the same site.
export const customStore = {
  load() { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } },
  save(samples) { try { localStorage.setItem(STORE, JSON.stringify(samples)); return true; } catch { return false; } },
};
