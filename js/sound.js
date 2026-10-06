// The squeak of a finger on wet glass, made with the Web Audio API so
// there's no recording to license. Faster wipes squeak higher.

let ctx = null;
let out = null;
let on = true;
let last = 0;

export function setOn(value) {
  on = value;
  if (out) out.gain.value = value ? 1 : 0;
}

export function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    out = ctx.createGain();
    out.gain.value = on ? 1 : 0;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// speed: mirror pixels per second.
export function squeak(speed) {
  if (!ctx || !on || speed < 900) return;
  const now = ctx.currentTime;
  if (now - last < 0.11) return;
  last = now;
  const pitch = Math.min(2600, 1300 + speed * 0.35) * (0.94 + Math.random() * 0.12);
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(pitch, now);
  osc.frequency.linearRampToValueAtTime(pitch * 1.08, now + 0.07);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = pitch * 1.4;
  filter.Q.value = 6;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.035, now + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  osc.connect(filter).connect(env).connect(out);
  osc.start(now);
  osc.stop(now + 0.1);
}
