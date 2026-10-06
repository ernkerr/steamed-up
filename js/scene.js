// What the mirror reflects when there's no camera: the bathroom behind you,
// drawn flat and straight on. The snake plant and its blush pot are the ones
// from the About page's room on erinkerr.me.

const C = {
  wall: "#f3e8d8",
  tile: "#d9e7df",
  grout: "#f2f6f3",
  trim: "#c6dacd",
  frame: "#fbf8f2",
  frameShade: "#e7ddcd",
  sky: "#bfe0f0",
  skyLow: "#e4f2f5",
  sun: "#ffe7a3",
  hills: "#a9cfa2",
  tree: "#7fb27c",
  treeDark: "#629a64",
  trunk: "#8a6a4a",
  brass: "#c9a25e",
  brassLight: "#e8c98a",
  towel: "#f2c1b4",
  towelShade: "#e3ab9d",
  towelBand: "#e59b8a",
  curtain: "#ffffff",
  curtainStripe: "#dceee6",
  glow: "#fff4cf",
  print: "#f6d9c4",
  leaf: "#3e5a34",
  leafLight: "#a9b86e",
  leafDark: "#2c4128",
  pot: "#f2e4d8",
  potBand: "#e7b6a2",
  potFoot: "#c9d4d4",
};

// A snake plant leaf: a tall, slightly curved blade with a pale band.
const leaf = (x, base, height, lean, width, fill) => {
  const tipX = x + lean;
  const top = base - height;
  return `
    <path d="M${x - width / 2} ${base} C ${x - width / 2} ${base - height * 0.55}, ${tipX - width * 0.35} ${top + height * 0.2}, ${tipX} ${top}
             C ${tipX + width * 0.35} ${top + height * 0.2}, ${x + width / 2} ${base - height * 0.55}, ${x + width / 2} ${base} Z" fill="${fill}" />
    <path d="M${x - width * 0.12} ${base - height * 0.15} C ${x - width * 0.1} ${base - height * 0.5}, ${tipX - width * 0.1} ${top + height * 0.35}, ${tipX} ${top + height * 0.12}"
          stroke="${C.leafLight}" stroke-width="${width * 0.18}" stroke-linecap="round" fill="none" opacity="0.55" />`;
};

const pleats = () => {
  let out = "";
  for (let i = 0; i < 6; i++) {
    const x = i * 40;
    out += `<rect x="${x}" y="40" width="40" height="960" fill="${i % 2 ? C.curtainStripe : C.curtain}" />`;
  }
  return out;
};

export const SCENE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <defs>
    <pattern id="tiles" width="80" height="80" patternUnits="userSpaceOnUse">
      <rect width="80" height="80" fill="${C.tile}" />
      <path d="M0 0H80M0 0V80" stroke="${C.grout}" stroke-width="4" />
    </pattern>
    <radialGradient id="glow">
      <stop offset="0" stop-color="${C.glow}" stop-opacity="0.9" />
      <stop offset="1" stop-color="${C.glow}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="1600" height="1000" fill="${C.wall}" />
  <rect y="640" width="1600" height="360" fill="url(#tiles)" />
  <rect y="624" width="1600" height="18" fill="${C.trim}" />

  <!-- The lamp's glow and globe -->
  <circle cx="420" cy="230" r="170" fill="url(#glow)" />
  <rect x="408" y="270" width="24" height="40" rx="6" fill="${C.brass}" />
  <circle cx="420" cy="230" r="46" fill="${C.glow}" />
  <circle cx="404" cy="214" r="12" fill="#ffffff" opacity="0.8" />

  <!-- The window, with a sunny morning outside -->
  <rect x="560" y="110" width="480" height="460" rx="12" fill="${C.frame}" />
  <rect x="584" y="134" width="432" height="412" fill="${C.sky}" />
  <rect x="584" y="380" width="432" height="166" fill="${C.skyLow}" />
  <circle cx="930" cy="210" r="46" fill="${C.sun}" />
  <path d="M584 470 C 660 420, 740 430, 800 460 C 860 488, 950 440, 1016 452 V546 H584 Z" fill="${C.hills}" />
  <rect x="676" y="420" width="12" height="70" fill="${C.trunk}" />
  <circle cx="682" cy="404" r="44" fill="${C.tree}" />
  <circle cx="712" cy="430" r="30" fill="${C.treeDark}" />
  <rect x="884" y="450" width="10" height="56" fill="${C.trunk}" />
  <circle cx="889" cy="438" r="32" fill="${C.tree}" />
  <rect x="794" y="134" width="12" height="412" fill="${C.frame}" />
  <rect x="584" y="334" width="432" height="12" fill="${C.frame}" />
  <rect x="530" y="566" width="540" height="26" rx="4" fill="${C.frame}" />
  <rect x="530" y="590" width="540" height="8" fill="${C.frameShade}" />

  <!-- The snake plant in its blush pot, on the sill -->
  ${leaf(640, 520, 220, -14, 34, C.leafDark)}
  ${leaf(668, 520, 290, 6, 40, C.leaf)}
  ${leaf(700, 520, 240, 24, 34, C.leaf)}
  ${leaf(722, 520, 170, 34, 28, C.leafDark)}
  <path d="M612 506 H760 L748 566 H624 Z" fill="${C.pot}" />
  <rect x="618" y="544" width="136" height="12" fill="${C.potBand}" />
  <rect x="606" y="498" width="160" height="14" rx="5" fill="${C.pot}" />
  <rect x="632" y="560" width="108" height="8" rx="3" fill="${C.potFoot}" />

  <!-- A little framed print -->
  <rect x="1110" y="170" width="110" height="140" rx="4" fill="${C.brass}" />
  <rect x="1122" y="182" width="86" height="116" fill="${C.print}" />
  <circle cx="1165" cy="236" r="22" fill="${C.towelBand}" />

  <!-- A striped towel on a brass hook -->
  <circle cx="1310" cy="300" r="12" fill="${C.brass}" />
  <circle cx="1306" cy="296" r="4" fill="${C.brassLight}" />
  <rect x="1236" y="304" width="150" height="350" rx="16" fill="${C.towel}" />
  <rect x="1236" y="304" width="26" height="350" rx="12" fill="${C.towelShade}" />
  <rect x="1236" y="566" width="150" height="16" fill="${C.towelBand}" />
  <rect x="1236" y="596" width="150" height="8" fill="${C.towelBand}" />

  <!-- The shower curtain's edge -->
  <rect x="0" y="22" width="250" height="14" rx="7" fill="${C.brass}" />
  ${pleats()}
  <rect x="236" y="40" width="10" height="960" fill="#000" opacity="0.05" />
</svg>`;

// The scene as an image the canvas can draw.
export function sceneImage() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SCENE)}`;
  });
}
