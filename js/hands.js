// Drawing in the air, with Google's MediaPipe hand tracking. It runs in the
// browser on the camera feed; nothing is sent anywhere.
//
// Point with one finger, or pinch your thumb and finger together, to wipe.
// Open your hand (or make a fist) to stop.

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Fingers are judged from MediaPipe's 3D model of the hand (in meters), not
// the flat picture, so a finger pointed at the screen still counts.
//
// A finger is out when its first and last bones are within OUT degrees of
// each other. On real hands, fingers held out measure about 20 to 40 and
// folded ones 120 to 170.
const OUT = 80;
// Thumb and index tips closer than START (meters) begin a pinch; further
// than STOP ends it, so a wobbly pinch doesn't flicker.
const START = 0.035;
const STOP = 0.05;
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

const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const length = (v) => Math.hypot(v[0], v[1], v[2]);
const angle = (u, v) => {
  const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (length(u) * length(v) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};
// How far a finger curls: the angle between its first bone (from the
// knuckle, mcp) and its last (ending at the tip, mcp + 3).
const bend = (world, mcp) => angle(sub(world[mcp + 1], world[mcp]), sub(world[mcp + 3], world[mcp + 2]));

// What one hand is doing: pinching (thumb and index tips together), pointing
// (index out, and not the whole hand open), or neither. `hand` is where it
// is in the picture, `world` its shape in 3D.
export function classify(hand, world, wasDrawing = false) {
  const indexBend = bend(world, 5);
  const others = [9, 13, 17].filter((mcp) => bend(world, mcp) < OUT).length;
  // A loose point stays a point while it's wiping.
  const pointing = indexBend < (wasDrawing ? OUT + 20 : OUT) && others <= 1;
  // In a fist the thumb rests near the index tip too, but the index finger
  // is curled all the way in.
  const gap = length(sub(world[4], world[8]));
  const pinch = indexBend < 150 && gap < (wasDrawing ? STOP : START);
  const tip = hand[8];
  const point = pinch
    ? { x: (tip.x + hand[4].x) / 2, y: (tip.y + hand[4].y) / 2 }
    : { x: tip.x, y: tip.y };
  return { ...point, drawing: pinch || pointing };
}

// Each hand's stroke state, with a little hold so one odd frame doesn't
// start or stop it.
const state = [0, 1].map(() => ({ drawing: false, count: 0 }));

// The hands in the current video frame, one slot per hand (left, right):
// where each is pointing (0 to 1 in the video, before mirroring) and whether
// it's wiping. Null when there's no new frame to look at.
export function readHands(video, now) {
  if (!landmarker || video.readyState < 2 || video.currentTime === lastTime) return null;
  lastTime = video.currentTime;
  let result;
  try {
    result = landmarker.detectForVideo(video, now);
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
  // Keep each hand in the same slot from frame to frame, so a stroke never
  // jumps from one hand to the other.
  const slots = [null, null];
  result.landmarks.slice(0, 2).forEach((hand, i) => {
    let slot = result.handedness?.[i]?.[0]?.categoryName === "Right" ? 1 : 0;
    if (slots[slot]) slot = 1 - slot;
    slots[slot] = { hand, world: result.worldLandmarks[i] };
  });
  return slots.map((found, i) => {
    const s = state[i];
    if (!found) {
      s.drawing = false;
      s.count = 0;
      return null;
    }
    const seen = classify(found.hand, found.world, s.drawing);
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
