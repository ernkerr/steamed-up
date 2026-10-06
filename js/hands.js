// Drawing in the air, with Google's MediaPipe hand tracking. It runs in the
// browser on the camera feed; nothing is sent anywhere.
//
// Point with one finger, or pinch your thumb and finger together, to wipe.
// Open your hand (or make a fist) to stop.

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Pinch gap, as a share of the palm's length: closer than START begins a
// stroke, further than STOP ends it, so a wobbly pinch doesn't flicker.
const START = 0.42;
const STOP = 0.6;
// Frames a pose has to hold before it counts, so a stray frame can't start
// or end a stroke.
const HOLD_ON = 2;
const HOLD_OFF = 3;

let landmarker = null;
let loading = null;
let lastTime = -1;
let files = null;
let failures = 0;

async function create(delegate) {
  const { HandLandmarker } = await import(`${CDN}/vision_bundle.mjs`);
  landmarker = await HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

export function loadHands() {
  if (loading) return loading;
  loading = (async () => {
    const { FilesetResolver } = await import(`${CDN}/vision_bundle.mjs`);
    files = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    try {
      await create("GPU");
    } catch {
      await create("CPU");
    }
  })();
  return loading;
}

// MediaPipe gives x as a share of the frame's width and y of its height. On
// a 16:9 camera those aren't the same length, so x is stretched back to
// square before measuring anything.
const gap = (a, b, aspect) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);

// What one hand is doing, from its 21 landmarks: pinching (thumb and index
// tips together), pointing (index out, middle and ring folded), or neither.
export function classify(hand, aspect = 1, wasDrawing = false) {
  const wrist = hand[0];
  const palm = gap(wrist, hand[9], aspect) || 0.001;
  // A finger is out when its tip is well past its middle joint.
  const out = (tip, joint) => gap(wrist, hand[tip], aspect) > gap(wrist, hand[joint], aspect) * 1.15;
  // In a fist the thumb rests near the folded index fingertip too, so a
  // pinch also needs the index finger reaching out past the palm.
  const reach = gap(wrist, hand[8], aspect) / palm;
  const pinch = reach > 0.95 && gap(hand[4], hand[8], aspect) / palm < (wasDrawing ? STOP : START);
  const pointing = out(8, 6) && !out(12, 10) && !out(16, 14);
  const tip = hand[8];
  const point = pinch
    ? { x: (tip.x + hand[4].x) / 2, y: (tip.y + hand[4].y) / 2 }
    : { x: tip.x, y: tip.y };
  return { ...point, drawing: pinch || pointing };
}

// Each hand's stroke state, with a little hold so one odd frame doesn't
// start or stop it.
const state = [0, 1].map(() => ({ drawing: false, count: 0 }));

// The hands in the current video frame: where each is pointing (0 to 1 in
// the video, before mirroring) and whether it's wiping. Null when there's no
// new frame to look at.
export function readHands(video, now) {
  if (!landmarker || video.readyState < 2 || video.currentTime === lastTime) return null;
  lastTime = video.currentTime;
  let landmarks;
  try {
    ({ landmarks } = landmarker.detectForVideo(video, now));
    failures = 0;
  } catch (err) {
    // Some graphics drivers fail mid-session. Fall back to the CPU once,
    // then give up quietly rather than stopping the mirror.
    failures += 1;
    if (failures === 3) {
      landmarker = null;
      create("CPU").catch(() => {});
    }
    if (failures > 30) throw err;
    return null;
  }
  const aspect = video.videoWidth / video.videoHeight || 1;
  return landmarks.slice(0, 2).map((hand, i) => {
    const s = state[i];
    const seen = classify(hand, aspect, s.drawing);
    if (seen.drawing !== s.drawing) {
      s.count += 1;
      if (s.count >= (seen.drawing ? HOLD_ON : HOLD_OFF)) {
        s.drawing = seen.drawing;
        s.count = 0;
      }
    } else {
      s.count = 0;
    }
    return { x: seen.x, y: seen.y, wiping: s.drawing };
  });
}
