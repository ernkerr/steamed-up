// Drawing in the air, with Google's MediaPipe hand tracking. It runs in the
// browser on the camera feed; nothing is sent anywhere. Pinch your thumb and
// index finger together to wipe, and let go to stop.

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Pinch distance relative to the hand's size: closer than START begins a
// stroke, further than STOP ends it, so a wobbly pinch doesn't flicker.
const START = 0.32;
const STOP = 0.46;

let landmarker = null;
let loading = null;
let lastTime = -1;
const pinching = [false, false];

export function loadHands() {
  if (loading) return loading;
  loading = (async () => {
    const { FilesetResolver, HandLandmarker } = await import(`${CDN}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: "VIDEO",
      numHands: 2,
    });
    try {
      landmarker = await HandLandmarker.createFromOptions(files, options("GPU"));
    } catch {
      landmarker = await HandLandmarker.createFromOptions(files, options("CPU"));
    }
  })();
  return loading;
}

// The hands in the current video frame: where each fingertip is (0 to 1 in
// the video, before mirroring) and whether it's pinching. Null when there's
// no new frame to look at.
export function readHands(video, now) {
  if (!landmarker || video.readyState < 2 || video.currentTime === lastTime) return null;
  lastTime = video.currentTime;
  const { landmarks } = landmarker.detectForVideo(video, now);
  return landmarks.slice(0, 2).map((hand, i) => {
    const [wrist, thumb, index, knuckle] = [hand[0], hand[4], hand[8], hand[9]];
    const size = Math.hypot(knuckle.x - wrist.x, knuckle.y - wrist.y) || 0.001;
    const gap = Math.hypot(index.x - thumb.x, index.y - thumb.y) / size;
    pinching[i] = pinching[i] ? gap < STOP : gap < START;
    // While pinching, the point is between thumb and finger; otherwise the
    // fingertip.
    const x = pinching[i] ? (index.x + thumb.x) / 2 : index.x;
    const y = pinching[i] ? (index.y + thumb.y) / 2 : index.y;
    return { x, y, pinching: pinching[i] };
  });
}
