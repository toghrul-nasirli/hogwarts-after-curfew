// Procedural canvas textures — the whole castle is drawn from code, no asset files.
import * as THREE from 'three';
import { ERISED_PHOTO } from './erisedPhoto.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Deterministic PRNG so the castle looks the same every load.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Runtime-tunable texture quality (URL params drive this for driver bisecting)
const texConfig = { mips: true, aniso: 4 }; // high aniso keeps fine detail sharp at angles — which shimmers in motion
export function configureTextures(opts = {}) {
  Object.assign(texConfig, opts);
}

function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = texConfig.aniso;
  if (!texConfig.mips) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  return t;
}

export function stoneTexture({ base = [104, 106, 116], seed = 7, repeatX = 3, repeatY = 1.5 } = {}) {
  const w = 512, h = 512, c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = `rgb(${base[0] - 30},${base[1] - 30},${base[2] - 28})`; // mortar
  g.fillRect(0, 0, w, h);
  const rows = 8, bh = h / rows;
  for (let y = 0; y < rows; y++) {
    const cols = 4, bw = w / cols, off = (y % 2) * bw * 0.5;
    for (let x = -1; x <= cols; x++) {
      const px = x * bw + off, py = y * bh;
      const v = 0.78 + r() * 0.4;
      g.fillStyle = `rgb(${(base[0] * v) | 0},${(base[1] * v) | 0},${(base[2] * v) | 0})`;
      g.fillRect(px + 3, py + 3, bw - 6, bh - 6);
      // speckles kept sparse, large and faint — tiny high-contrast dots
      // sparkle/shimmer under minification when the camera moves
      for (let i = 0; i < 22; i++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
        g.fillRect(px + r() * bw, py + r() * bh, 2 + r() * 3, 2 + r() * 3);
      }
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
        g.fillRect(px + r() * bw, py + r() * bh, 2 + r() * 3, 2 + r() * 3);
      }
    }
  }
  return tex(c, repeatX, repeatY);
}

export function flagstoneTexture({ base = [96, 96, 104], seed = 21, repeat = 6 } = {}) {
  const w = 512, h = 512, c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = `rgb(${base[0] - 34},${base[1] - 34},${base[2] - 30})`;
  g.fillRect(0, 0, w, h);
  const n = 4, s = w / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 0.72 + r() * 0.45;
      g.fillStyle = `rgb(${(base[0] * v) | 0},${(base[1] * v) | 0},${(base[2] * v) | 0})`;
      const inset = 4 + r() * 5;
      g.fillRect(x * s + inset, y * s + inset, s - inset * 2, s - inset * 2);
      for (let i = 0; i < 32; i++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
        g.fillRect(x * s + r() * s, y * s + r() * s, 2 + r() * 3, 2 + r() * 3);
      }
    }
  }
  return tex(c, repeat, repeat);
}

export function woodTexture({ base = [82, 56, 34], seed = 5, repeat = 1 } = {}) {
  const w = 256, h = 512, c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  const planks = 5, pw = w / planks;
  for (let p = 0; p < planks; p++) {
    const v = 0.8 + r() * 0.35;
    g.fillStyle = `rgb(${(base[0] * v) | 0},${(base[1] * v) | 0},${(base[2] * v) | 0})`;
    g.fillRect(p * pw, 0, pw, h);
    for (let i = 0; i < 26; i++) { // grain
      const gx = p * pw + r() * pw;
      g.strokeStyle = `rgba(30,16,6,${0.12 + r() * 0.2})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(gx, 0);
      g.bezierCurveTo(gx + r() * 8 - 4, h * 0.33, gx + r() * 8 - 4, h * 0.66, gx, h);
      g.stroke();
    }
    g.fillStyle = 'rgba(15,8,3,0.85)';
    g.fillRect(p * pw, 0, 2, h);
  }
  return tex(c, repeat, repeat);
}

// Night sky with stars — used for the sky dome and the Great Hall's enchanted ceiling.
export function starsTexture({ density = 900, seed = 99, milkyWay = true } = {}) {
  const w = 2048, h = 1024, c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#02030a');
  grad.addColorStop(0.55, '#070b1e');
  grad.addColorStop(1, '#0c1330');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (milkyWay) {
    for (let i = 0; i < 240; i++) {
      const x = r() * w, y = h * 0.35 + Math.sin(x / w * Math.PI * 2) * h * 0.12 + (r() - 0.5) * h * 0.16;
      const rad = 20 + r() * 60;
      const gg = g.createRadialGradient(x, y, 0, x, y, rad);
      gg.addColorStop(0, `rgba(120,140,190,${0.012 + r() * 0.02})`);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gg;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  for (let i = 0; i < density; i++) {
    const x = r() * w, y = r() * h, s = r();
    const rad = s < 0.94 ? 0.7 + r() : 1.6 + r() * 1.4;
    const a = 0.35 + r() * 0.65;
    const hue = r();
    g.fillStyle = hue < 0.12 ? `rgba(255,220,180,${a})` : hue < 0.24 ? `rgba(180,200,255,${a})` : `rgba(235,240,255,${a})`;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  const t = tex(c, 1, 1);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Soft radial dot — reused for flames, sparkles, glows and the moon halo.
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const s = 128, c = canvas(s, s), g = c.getContext('2d');
  const gg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gg.addColorStop(0, inner);
  gg.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  gg.addColorStop(1, outer);
  g.fillStyle = gg;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function moonTexture() {
  const s = 256, c = canvas(s, s), g = c.getContext('2d'), r = rng(31);
  const gg = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
  gg.addColorStop(0, 'rgba(235,240,250,1)');
  gg.addColorStop(0.42, 'rgba(210,220,240,0.95)');
  gg.addColorStop(0.55, 'rgba(160,180,220,0.32)');
  gg.addColorStop(1, 'rgba(120,150,210,0)');
  g.fillStyle = gg;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 14; i++) { // craters
    const a = r() * Math.PI * 2, d = r() * s * 0.2;
    const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
    g.fillStyle = `rgba(150,160,190,${0.1 + r() * 0.16})`;
    g.beginPath();
    g.arc(x, y, 3 + r() * 9, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const HOUSES = {
  gryffindor: { bg: '#5c1010', trim: '#d3a625', letter: 'G' },
  slytherin: { bg: '#0f3823', trim: '#aaaaaa', letter: 'S' },
  ravenclaw: { bg: '#12294d', trim: '#946b2d', letter: 'R' },
  hufflepuff: { bg: '#8a6d0b', trim: '#2b2b2b', letter: 'H' },
};

export function bannerTexture(house) {
  const { bg, trim, letter } = HOUSES[house];
  const w = 128, h = 256, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, w, 0); // fabric shading
  grad.addColorStop(0, 'rgba(0,0,0,0.35)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.06)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = trim;
  g.lineWidth = 5;
  g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = trim;
  g.font = 'bold 84px Georgia';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, w / 2, h / 2 - 14);
  g.beginPath(); // divider + point at the bottom
  g.moveTo(14, h - 60);
  g.lineTo(w - 14, h - 60);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function portraitTexture(seed) {
  const w = 128, h = 160, c = canvas(w, h), g = c.getContext('2d'), r = rng(seed * 137 + 11);
  const hues = [[64, 52, 40], [48, 56, 66], [70, 46, 52], [42, 60, 48]];
  const [br, bg_, bb] = hues[(seed | 0) % hues.length];
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgb(${br + 20},${bg_ + 20},${bb + 24})`);
  grad.addColorStop(1, `rgb(${br - 18},${bg_ - 18},${bb - 14})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // vague robed figure
  const cx = w / 2 + (r() - 0.5) * 16, cy = h * 0.62;
  g.fillStyle = `rgba(${20 + r() * 30},${16 + r() * 20},${14 + r() * 20},0.9)`;
  g.beginPath();
  g.ellipse(cx, cy + 26, 26 + r() * 10, 46, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `rgb(${180 + r() * 40},${150 + r() * 40},${120 + r() * 30})`; // face
  g.beginPath();
  g.arc(cx, cy - 26, 11 + r() * 4, 0, Math.PI * 2);
  g.fill();
  if (r() > 0.4) { // hat
    g.fillStyle = 'rgba(18,14,12,0.95)';
    g.beginPath();
    g.moveTo(cx - 16, cy - 33);
    g.lineTo(cx + 16, cy - 33);
    g.lineTo(cx + r() * 10 - 5, cy - 62 - r() * 10);
    g.closePath();
    g.fill();
  }
  for (let i = 0; i < 250; i++) { // aged varnish noise
    g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
    g.fillRect(r() * w, r() * h, 2, 2);
  }
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function signTexture(text) {
  const w = 256, h = 96, c = canvas(w, h), g = c.getContext('2d'), r = rng(41);
  g.fillStyle = '#4a331f'; // plank base
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { // grain
    g.strokeStyle = `rgba(25,14,5,${0.15 + r() * 0.25})`;
    g.beginPath();
    const gy = r() * h;
    g.moveTo(0, gy);
    g.bezierCurveTo(w * 0.3, gy + r() * 8 - 4, w * 0.7, gy + r() * 8 - 4, w, gy);
    g.stroke();
  }
  g.strokeStyle = '#241507';
  g.lineWidth = 6;
  g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = '#1c0f04';
  g.font = 'bold 30px Georgia';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2 + 10, h / 2);
  // carved down-arrow
  g.beginPath();
  g.moveTo(26, h / 2 - 12);
  g.lineTo(46, h / 2 - 12);
  g.lineTo(36, h / 2 + 14);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function blackboardTexture() {
  const w = 512, h = 256, c = canvas(w, h), g = c.getContext('2d'), r = rng(3);
  g.fillStyle = '#1c2b24';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.03})`;
    g.fillRect(r() * w, r() * h, 2, 2);
  }
  g.fillStyle = 'rgba(228,228,215,0.92)';
  g.textAlign = 'center';
  g.font = 'italic 40px Georgia';
  g.fillText('Alohomora', w / 2, 62);
  g.font = '22px Georgia';
  g.fillStyle = 'rgba(228,228,215,0.75)';
  g.fillText('— the Unlocking Charm —', w / 2, 104);
  g.font = 'italic 20px Georgia';
  g.fillText('Wand movement: swish, then flick.', w / 2, 152);
  g.fillText('Do NOT practise on Professor Snape’s office.', w / 2, 190);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The Mirror of Erised's vision — a photograph that surfaces in the glass.
// 2:3, matching the photo, so nothing is stretched.
export function erisedVisionTexture() {
  const w = 512, h = 768, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#1a130c'; // dark glass until the photograph surfaces
  g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    g.drawImage(img, 0, 0, w, h);
    // settle it into the glass: a warm shade, edges melting into the frame
    g.fillStyle = 'rgba(24,16,8,0.16)';
    g.fillRect(0, 0, w, h);
    const vig = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.62);
    vig.addColorStop(0, 'rgba(10,6,3,0)');
    vig.addColorStop(1, 'rgba(10,6,3,0.5)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
    t.needsUpdate = true;
  };
  img.src = ERISED_PHOTO;
  return t;
}

// The inscription carved around the Mirror of Erised's frame.
export function erisedInscriptionTexture() {
  const w = 512, h = 64, c = canvas(w, h), g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'italic 24px Georgia';
  g.fillStyle = 'rgba(58,42,12,0.55)'; // engraved shadow
  g.fillText('Erised stra ehru oyt ube cafru oyt on wohsi', w / 2 + 1, h / 2 + 2);
  g.fillStyle = 'rgba(46,32,8,0.95)';
  g.fillText('Erised stra ehru oyt ube cafru oyt on wohsi', w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
