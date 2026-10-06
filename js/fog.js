// The fog on the glass, kept as a grid of densities from 0 (wiped clean) to
// 1 (fully steamed). It's a quarter of the mirror's size and drawn scaled
// up, which keeps the edges of every wipe soft.
//
// Steam slowly fills it back in, a breath fogs a patch near the middle,
// wiping clears it with a soft round brush, and water collects at the
// bottom of a wipe and runs down in drips that leave clear trails.

export const SCALE = 4; // mirror pixels per fog cell

const REFOG = 1 / 50; // per second: a clean patch is mostly fogged again in about a minute
const DRIP_CHANCE = 0.035; // per brush stamp

export class Fog {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.m = new Float32Array(0);
    this.drips = [];
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
  }

  // Keeps what's been wiped when the mirror changes size.
  resize(width, height) {
    const w = Math.max(1, Math.ceil(width / SCALE));
    const h = Math.max(1, Math.ceil(height / SCALE));
    if (w === this.w && h === this.h) return;
    const old = this.m;
    const [ow, oh] = [this.w, this.h];
    const m = new Float32Array(w * h).fill(1);
    if (old.length) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ox = Math.min(ow - 1, Math.floor((x / w) * ow));
          const oy = Math.min(oh - 1, Math.floor((y / h) * oh));
          m[y * w + x] = old[oy * ow + ox];
        }
      }
    }
    this.w = w;
    this.h = h;
    this.m = m;
    this.canvas.width = w;
    this.canvas.height = h;
    this.image = this.ctx.createImageData(w, h);
  }

  // A soft round brush, in mirror pixels.
  wipe(px, py, radius, strength = 1, drips = true) {
    const cx = px / SCALE;
    const cy = py / SCALE;
    const r = Math.max(1, radius / SCALE);
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        // Full strength in the middle, feathering out over the outer half.
        const f = d < 0.5 ? 1 : 1 - (d - 0.5) / 0.5;
        const i = y * this.w + x;
        this.m[i] *= 1 - strength * f * f * (3 - 2 * f);
      }
    }
    if (drips && Math.random() < DRIP_CHANCE) {
      this.drips.push({
        x: cx + (Math.random() - 0.5) * r,
        y: cy + r * 0.7,
        v: 0,
        size: 0.7 + Math.random() * 0.9,
        rest: 0.2 + Math.random() * 0.6,
        life: 4 + Math.random() * 6,
      });
    }
  }

  // A stroke from one point to the next, stamped every third of a radius.
  stroke(x0, y0, x1, y1, radius, strength = 1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (radius * 0.33)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this.wipe(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, strength);
    }
  }

  // A breath: fog gathers in a soft patch, densest in the middle.
  breathe(px, py, radius, amount) {
    const cx = px / SCALE;
    const cy = py / SCALE;
    const r = radius / SCALE;
    const s2 = 2 * (r / 2) ** 2;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const g = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s2);
        const i = y * this.w + x;
        this.m[i] += (1 - this.m[i]) * Math.min(1, amount * g);
      }
    }
  }

  // Fog everything a little (or, with amount 1, all the way).
  fill(amount) {
    const k = Math.min(1, amount);
    for (let i = 0; i < this.m.length; i++) this.m[i] += (1 - this.m[i]) * k;
  }

  // How much of the glass is clear, 0 to 1.
  clearness() {
    let sum = 0;
    for (let i = 0; i < this.m.length; i += 7) sum += this.m[i];
    return 1 - sum / Math.ceil(this.m.length / 7);
  }

  tick(dt) {
    this.fill(1 - Math.exp(-dt * REFOG));

    // Drips: they gather, slide, stick for a moment, slide again, and
    // leave a thin clear trail behind them.
    for (const d of this.drips) {
      d.life -= dt;
      if (d.rest > 0) {
        d.rest -= dt;
        continue;
      }
      d.v = Math.min(9, d.v + dt * 6);
      d.y += d.v * dt;
      d.x += (Math.random() - 0.5) * dt * 0.8;
      if (Math.random() < dt * 0.5) {
        d.rest = 0.3 + Math.random() * 1.2;
        d.v = 0;
      }
      this.wipe(d.x * SCALE, d.y * SCALE, d.size * SCALE * 1.3, 0.75, false);
    }
    this.drips = this.drips.filter((d) => d.life > 0 && d.y < this.h);
  }

  // Writes the densities into the mask canvas as alpha.
  paint() {
    const data = this.image.data;
    for (let i = 0; i < this.m.length; i++) {
      const a = this.m[i];
      const j = i * 4;
      data[j] = data[j + 1] = data[j + 2] = 255;
      data[j + 3] = Math.round(255 * a * a * (3 - 2 * a));
    }
    this.ctx.putImageData(this.image, 0, 0);
    return this.canvas;
  }
}
