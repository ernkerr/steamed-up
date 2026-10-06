import { Fog, SCALE } from "./fog.js";
import { loadHands, readHands } from "./hands.js";
import { listen } from "./breath.js";
import { sceneImage } from "./scene.js";
import * as sound from "./sound.js";

const $ = (sel) => document.querySelector(sel);
const els = {
  mirror: $("#mirror"),
  glass: $("#glass"),
  cursors: $("#cursors"),
  video: $("#video"),
  intro: $("#intro"),
  useCamera: $("#use-camera"),
  useFinger: $("#use-finger"),
  tools: $("#tools"),
  steam: $("#steam"),
  save: $("#save"),
  camera: $("#camera"),
  soundBtn: $("#sound"),
  status: $("#status"),
  breathe: $("#breathe"),
  breatheLabel: $("#breathe-label"),
  note: $("#note"),
};

const ctx = els.glass.getContext("2d");
const fog = new Fog();
const coarse = window.matchMedia("(pointer: coarse)").matches;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Canvases ----

// The fog layer is a blurred, brightened copy of the reflection, cut to the
// fog's shape. Blurring by shrinking and growing works in every browser.
const tiny = document.createElement("canvas");
const mid = document.createElement("canvas");
const haze = document.createElement("canvas");
const specks = document.createElement("canvas");
const [tinyCtx, midCtx, hazeCtx, specksCtx] = [tiny, mid, haze, specks].map((c) => c.getContext("2d"));

// Fine beads of condensation, tiled over the fog.
const speckPattern = (() => {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 220;
  const t = tile.getContext("2d");
  for (let i = 0; i < 950; i++) {
    const x = Math.random() * 220;
    const y = Math.random() * 220;
    const r = 0.45 + Math.random() ** 3 * 1.6;
    t.fillStyle = "rgba(70, 90, 90, 0.10)";
    t.beginPath();
    t.arc(x + 0.4, y + 0.6, r, 0, Math.PI * 2);
    t.fill();
    t.fillStyle = "rgba(255, 255, 255, 0.55)";
    t.beginPath();
    t.arc(x, y, r, 0, Math.PI * 2);
    t.fill();
  }
  return specksCtx.createPattern(tile, "repeat");
})();

let W = 0;
let H = 0;
let dpr = 1;

function resize() {
  const rect = els.mirror.getBoundingClientRect();
  W = Math.max(1, Math.round(rect.width));
  H = Math.max(1, Math.round(rect.height));
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  els.glass.width = Math.round(W * dpr);
  els.glass.height = Math.round(H * dpr);
  tiny.width = Math.max(4, Math.round(W / 18));
  tiny.height = Math.max(4, Math.round(H / 18));
  mid.width = Math.max(8, Math.round(W / 6));
  mid.height = Math.max(8, Math.round(H / 6));
  haze.width = Math.max(16, Math.round(W / 3));
  haze.height = Math.max(16, Math.round(H / 3));
  specks.width = W;
  specks.height = H;
  fog.resize(W, H);
}
new ResizeObserver(resize).observe(els.mirror);

// ---- What the mirror reflects ----

let scene = null;
let stream = null;
let cameraOn = false;
let handsOn = false;

const cover = (sw, sh, dw, dh) => {
  const s = Math.max(dw / sw, dh / sh);
  return { x: (dw - sw * s) / 2, y: (dh - sh * s) / 2, w: sw * s, h: sh * s };
};

// The camera is flipped like a mirror; the drawn bathroom isn't.
function drawReflection(c, dw, dh) {
  if (cameraOn && els.video.videoWidth) {
    const r = cover(els.video.videoWidth, els.video.videoHeight, dw, dh);
    c.save();
    c.translate(dw, 0);
    c.scale(-1, 1);
    c.drawImage(els.video, r.x, r.y, r.w, r.h);
    c.restore();
  } else if (scene) {
    const r = cover(scene.width, scene.height, dw, dh);
    c.drawImage(scene, r.x, r.y, r.w, r.h);
  }
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawReflection(ctx, W, H);

  // The fog: the reflection blurred and brightened, then cut to the fog.
  tinyCtx.clearRect(0, 0, tiny.width, tiny.height);
  drawReflection(tinyCtx, tiny.width, tiny.height);
  midCtx.imageSmoothingQuality = "high";
  midCtx.drawImage(tiny, 0, 0, mid.width, mid.height);
  hazeCtx.globalCompositeOperation = "source-over";
  hazeCtx.clearRect(0, 0, haze.width, haze.height);
  hazeCtx.imageSmoothingQuality = "high";
  hazeCtx.drawImage(mid, 0, 0, haze.width, haze.height);
  hazeCtx.fillStyle = "rgba(236, 242, 240, 0.5)";
  hazeCtx.fillRect(0, 0, haze.width, haze.height);
  const mask = fog.paint();
  hazeCtx.globalCompositeOperation = "destination-in";
  hazeCtx.drawImage(mask, 0, 0, haze.width, haze.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(haze, 0, 0, W, H);

  // Condensation beads, only where there's fog.
  specksCtx.globalCompositeOperation = "source-over";
  specksCtx.clearRect(0, 0, W, H);
  specksCtx.fillStyle = speckPattern;
  specksCtx.fillRect(0, 0, W, H);
  specksCtx.globalCompositeOperation = "destination-in";
  specksCtx.drawImage(mask, 0, 0, W, H);
  ctx.drawImage(specks, 0, 0, W, H);

  // Drips: a bead of water with a bright spot.
  for (const d of fog.drips) {
    const x = d.x * SCALE;
    const y = d.y * SCALE;
    const r = d.size * SCALE * 0.95;
    ctx.fillStyle = "rgba(40, 60, 60, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 0.6, y + 1, r, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Wiping with a finger or a mouse ----

const strokes = new Map();
const brush = (e) => (e.pointerType === "touch" ? 30 : e.pointerType === "pen" ? 18 : 24);

function point(e) {
  const rect = els.glass.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.timeStamp };
}

els.glass.addEventListener("pointerdown", (e) => {
  if (!started) return;
  sound.audio();
  els.glass.setPointerCapture(e.pointerId);
  const p = point(e);
  strokes.set(e.pointerId, p);
  fog.wipe(p.x, p.y, brush(e));
});
els.glass.addEventListener("pointermove", (e) => {
  const last = strokes.get(e.pointerId);
  if (!last) return;
  const p = point(e);
  fog.stroke(last.x, last.y, p.x, p.y, brush(e));
  const dt = Math.max(1, p.t - last.t) / 1000;
  sound.squeak(Math.hypot(p.x - last.x, p.y - last.y) / dt);
  strokes.set(e.pointerId, p);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  els.glass.addEventListener(type, (e) => strokes.delete(e.pointerId));
}

// ---- Wiping in the air ----

const hands = [null, null]; // each hand's last point while it's wiping
const smooth = [null, null];
const cursorEls = [0, 1].map(() => {
  const el = document.createElement("span");
  el.className = "cursor";
  el.hidden = true;
  els.cursors.append(el);
  return el;
});

function followHands(now) {
  const seen = readHands(els.video, now);
  if (!seen) return;
  const r = cover(els.video.videoWidth, els.video.videoHeight, W, H);
  cursorEls.forEach((el, i) => {
    const hand = seen[i];
    if (!hand) {
      el.hidden = true;
      hands[i] = null;
      smooth[i] = null;
      return;
    }
    // The video is mirrored, so x is flipped.
    const raw = { x: W - (r.x + hand.x * r.w), y: r.y + hand.y * r.h };
    const s = smooth[i];
    const p = s ? { x: s.x + (raw.x - s.x) * 0.55, y: s.y + (raw.y - s.y) * 0.55 } : raw;
    smooth[i] = p;
    el.hidden = false;
    el.classList.toggle("wiping", hand.wiping);
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    if (hand.wiping) {
      if (hands[i]) fog.stroke(hands[i].x, hands[i].y, p.x, p.y, 32);
      else fog.wipe(p.x, p.y, 32);
      hands[i] = p;
    } else {
      hands[i] = null;
    }
  });
}

// ---- Breathing ----

let hearBreath = () => 0;
let holding = false;

function setHolding(value) {
  holding = value;
  els.breathe.classList.toggle("on", value);
}
els.breathe.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  els.breathe.setPointerCapture(e.pointerId);
  setHolding(true);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  els.breathe.addEventListener(type, () => setHolding(false));
}
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && started && !e.repeat && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    setHolding(true);
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") setHolding(false);
});

// ---- "hi", written in the fog while you decide ----

let hi = null;
async function writeHi() {
  try {
    await document.fonts.load("600 64px Caveat");
  } catch {
    // The fallback handwriting font is fine.
  }
  const c = document.createElement("canvas");
  c.width = fog.w;
  c.height = fog.h;
  const t = c.getContext("2d");
  const size = Math.round(Math.min(fog.w * 0.2, fog.h * 0.32));
  t.font = `600 ${size}px Caveat, "Segoe Script", cursive`;
  t.textBaseline = "middle";
  const x = Math.round(fog.w * 0.12);
  const y = Math.round(fog.h * 0.3);
  t.fillText("hi", x, y);
  const width = t.measureText("hi").width;
  const alpha = t.getImageData(0, 0, c.width, c.height).data;
  hi = { alpha, x, width, w: fog.w, h: fog.h, start: performance.now(), done: x };
}

function stepHi(now) {
  if (!hi) return;
  if (hi.w !== fog.w || hi.h !== fog.h) {
    hi = null;
    return;
  }
  const p = reduced ? 1 : Math.min(1, (now - hi.start - 500) / 900);
  if (p <= 0) return;
  const upTo = Math.round(hi.x + hi.width * p) + 2;
  for (let y = 0; y < fog.h; y++) {
    for (let x = hi.done; x < Math.min(upTo, fog.w); x++) {
      const a = hi.alpha[(y * fog.w + x) * 4 + 3] / 255;
      if (a > 0) fog.m[y * fog.w + x] = Math.min(fog.m[y * fog.w + x], 1 - a * 0.92);
    }
  }
  hi.done = upTo;
  if (p >= 1) hi = null;
}

// ---- Starting ----

let started = false;
const statusFor = () =>
  handsOn
    ? "Point a finger or pinch in the air to wipe. Open your hand to stop."
    : coarse
      ? "Wipe the mirror with your finger."
      : "Drag across the mirror to wipe it.";

function begin() {
  started = true;
  els.intro.classList.add("leaving");
  setTimeout(() => (els.intro.hidden = true), 400);
  els.tools.hidden = false;
  els.status.textContent = statusFor();
  showCamera();
}

async function startCamera(withMic) {
  const video = { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };
  const mic = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  let got = null;
  try {
    got = await navigator.mediaDevices.getUserMedia({ video, audio: withMic ? mic : false });
  } catch {
    try {
      got = await navigator.mediaDevices.getUserMedia({ video });
    } catch {
      return false;
    }
  }
  stream = got;
  els.video.srcObject = stream;
  await els.video.play().catch(() => {});
  cameraOn = true;
  const audioCtx = sound.audio();
  if (stream.getAudioTracks().length && audioCtx) {
    hearBreath = listen(stream, audioCtx);
    els.breatheLabel.textContent = "Blow on the mirror";
  }
  els.status.textContent = "Getting hand tracking ready...";
  loadHands()
    .then(() => {
      handsOn = true;
      if (started) els.status.textContent = statusFor();
    })
    .catch(() => {
      if (started) els.status.textContent = statusFor();
    });
  return true;
}

function stopCamera() {
  for (const track of stream?.getVideoTracks() ?? []) track.stop();
  cameraOn = false;
  handsOn = false;
  cursorEls.forEach((el) => (el.hidden = true));
  els.status.textContent = statusFor();
}

els.useCamera.addEventListener("click", async () => {
  sound.audio();
  els.useCamera.disabled = true;
  const ok = await startCamera(true);
  if (!ok) els.note.textContent = "No camera, so here's the bathroom behind you.";
  begin();
});
els.useFinger.addEventListener("click", () => {
  sound.audio();
  begin();
});

// ---- Tools ----

// The camera button says what pressing it will do.
function showCamera() {
  els.camera.textContent = cameraOn ? "Turn camera off" : "Turn camera on";
}

let steamUntil = 0;
els.steam.addEventListener("click", () => {
  steamUntil = performance.now() + 1400;
});

els.camera.addEventListener("click", async () => {
  if (cameraOn) {
    stopCamera();
  } else if (!(await startCamera(false))) {
    els.note.textContent = "The camera isn't available, so here's the bathroom instead.";
  }
  showCamera();
});

let soundOn = true;
els.soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  sound.setOn(soundOn);
  els.soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
  els.soundBtn.setAttribute("aria-pressed", String(soundOn));
});

// A picture of the mirror as it is, with a small signature.
els.save.addEventListener("click", () => {
  const out = document.createElement("canvas");
  out.width = els.glass.width;
  out.height = els.glass.height;
  const o = out.getContext("2d");
  o.drawImage(els.glass, 0, 0);
  const fs = Math.round(16 * dpr);
  o.font = `italic ${fs}px Newsreader, Georgia, serif`;
  o.fillStyle = "rgba(255, 255, 255, 0.85)";
  o.textAlign = "right";
  o.fillText("Steamed Up", out.width - fs, out.height - fs);
  out.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "steamed-up.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

// ---- The loop ----

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (handsOn && cameraOn) {
    try {
      followHands(now);
    } catch {
      // Hand tracking broke on this device; the finger still works.
      handsOn = false;
      cursorEls.forEach((el) => (el.hidden = true));
      els.status.textContent = "Air drawing stopped working here, so use your finger.";
    }
  }

  const breath = Math.max(hearBreath(), holding ? 0.9 : 0);
  els.breathe.classList.toggle("hearing", breath > 0.05 && !holding);
  if (breath > 0) fog.breathe(W / 2, H * 0.6, Math.min(W, H) * 0.6, breath * dt * 2.4);
  if (now < steamUntil) fog.fill(dt * 2.5);

  fog.tick(dt);
  stepHi(now);
  draw();
  requestAnimationFrame(frame);
}

resize();
sceneImage().then((img) => {
  scene = img;
});
writeHi();
requestAnimationFrame(frame);
