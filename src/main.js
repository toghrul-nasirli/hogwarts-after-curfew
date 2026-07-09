// Bootstrap: renderer, world, player, creatures, spells, quest line, game loop.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { SpellSystem } from './spells.js';
import { Creatures } from './creatures.js';
import { UI } from './ui.js';
import { AudioFX } from './audio.js';
import { MaraudersMap } from './map.js';
import { t, setLang, storedLang, localizeDom } from './i18n.js';

window.__errors = [];
window.__THREE = THREE;
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

// Debug/bisect switches (add to the URL, combinable):
//   ?noaa      — disable MSAA antialiasing
//   ?nomips    — disable texture mipmaps
//   ?aniso=N   — set anisotropic filtering level (e.g. 1, 4, 8)
//   ?ratio=N   — force a fixed pixel ratio (e.g. 1 or 2), disables adaptive scaling
import { configureTextures } from './textures.js';
const Q = new URLSearchParams(location.search);
configureTextures({
  mips: !Q.has('nomips'),
  aniso: Q.has('aniso') ? Math.max(1, parseInt(Q.get('aniso'), 10) || 1) : 4,
});

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !Q.has('noaa') });
const FORCED_RATIO = Q.has('ratio') ? Math.max(0.5, parseFloat(Q.get('ratio')) || 1) : null;
// Render at native display resolution; if we must drop for performance, snap
// only to even divisors of it — fractional ratios upscale unevenly and paint
// striped rectangles over fine textures while moving.
const NATIVE_RATIO = Math.min(window.devicePixelRatio || 1, 2);
const RATIO_LADDER = FORCED_RATIO ? [FORCED_RATIO] : [NATIVE_RATIO, NATIVE_RATIO / 2];
let ladderIdx = 0;
let pixelRatio = RATIO_LADDER[0];
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // filtered edges — Basic's blocky teeth crawl when moving
// the moonlight scene is static except doors — render the shadow map on demand only
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070a18, 0.011);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 500);

const ui = new UI();

// ── language (chosen once, before anything else) ─────────────────────────────
const langpickEl = document.getElementById('langpick');
if (storedLang()) setLang(storedLang());
else langpickEl.classList.add('show');
localizeDom();
for (const btn of langpickEl.querySelectorAll('button')) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setLang(btn.dataset.lang);
    localizeDom();
    langpickEl.classList.remove('show');
    ui.objective(t(quests[questIdx].key));
  });
}
const audio = new AudioFX();
const world = buildWorld(scene);
const player = new Player(camera, world, canvas);
player.teleport(world.spawn.x, world.spawn.z, world.spawn.yaw);
const creatures = new Creatures(scene, world);
const spells = new SpellSystem(scene, camera, player, world, creatures, ui, audio);

let started = false;

// ── start / pause via pointer lock ──────────────────────────────────────────
// The overlay hides once the lock is granted. If the browser refuses mouse
// capture (Safari quirks, post-Escape cooldown, odd permissions), we still
// enter the game in a no-capture look mode so a click ALWAYS starts the game.
let everLocked = false;
let lockAttempt = 0;

// ── the Sorting Hat ──────────────────────────────────────────────────────────
const HOUSES = [
  { key: 'gryffindor', name: 'Gryffindor', color: '#d3352b' },
  { key: 'slytherin', name: 'Slytherin', color: '#2fae66' },
  { key: 'ravenclaw', name: 'Ravenclaw', color: '#3a6bd8' },
  { key: 'hufflepuff', name: 'Hufflepuff', color: '#e8c832' },
];
let houseIdx = null; // null = not yet sorted (fresh game shows the Hat)
let pendingHouseCry = null;

function applyHouse(i) {
  houseIdx = Math.max(0, Math.min(3, i));
  ui.setHouse(HOUSES[houseIdx].name, HOUSES[houseIdx].color);
  world.setHouse(houseIdx);
}

function enterGame() {
  ui.hideOverlay();
  if (!started) {
    started = true;
    if (pendingHouseCry) {
      ui.caption(t('hatcry', { house: pendingHouseCry.toUpperCase() }), 5200);
      pendingHouseCry = null;
    } else {
      ui.caption(t('sleeps'), 4200);
    }
  }
}

function startWithoutLock() {
  if (document.pointerLockElement === canvas || player.debug) return;
  player.debug = true; // mouse-look from raw mouse movement, cursor stays visible
  player.enabled = true;
  enterGame();
  ui.caption(t('mouseFallback'), 5000);
}

function attemptEnter() {
  lockAttempt += 1;
  const attempt = lockAttempt;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* handled by the fallback timer below */ }
  // if the lock never engages on a fresh session, enter without it
  setTimeout(() => {
    if (attempt === lockAttempt && !everLocked && document.pointerLockElement !== canvas) {
      startWithoutLock();
    }
  }, 800);
}

ui.onStart = () => {
  audio.start();
  if (houseIdx === null) {
    ui.showSorting(); // first night at the castle — the Hat speaks first
    return;
  }
  attemptEnter();
};

ui.onHouse = (val) => {
  const i = val === 'hat' ? Math.floor(Math.random() * 4) : parseInt(val, 10) || 0;
  applyHouse(i);
  world.setHousePoints(points);
  pendingHouseCry = HOUSES[houseIdx].name;
  persist();
  ui.hideSorting();
  audio.chime();
  attemptEnter();
};

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  player.enabled = locked || player.debug;
  player.keys = {}; // never carry held keys across a pause boundary
  if (locked) {
    everLocked = true;
    enterGame();
  } else if (started && !player.debug) {
    ui.setPaused(true);
  }
});
document.addEventListener('pointerlockerror', () => {
  if (!everLocked) startWithoutLock();
});
window.addEventListener('blur', () => { player.keys = {}; });

// ── gentle hints, once each (persisted in the save) ──────────────────────────
const hintsShown = new Set();
function hintOnce(key) {
  if (hintsShown.has(key)) return;
  hintsShown.add(key);
  ui.caption(t(key), 5600);
}
let playT = 0;

// ── house points ─────────────────────────────────────────────────────────────
let points = 50;
function addPoints(delta) {
  points = Math.max(0, points + delta);
  ui.setPoints(points, delta);
  world.setHousePoints(points);
  if (delta > 0) hintOnce('hintPoints');
  persist();
}

// ── creature events ──────────────────────────────────────────────────────────
creatures.onSpotted = () => {
  audio.yowl();
  ui.caption(t('norrisSpotted'), 5200);
};
creatures.onFilchCaught = () => {
  audio.faint();
  addPoints(-20);
  const house = HOUSES[houseIdx === null ? 0 : houseIdx].name;
  ui.faint(t('filchCaught', { house }), () => {
    player.teleport(0, 8, Math.PI, 0);
    creatures.filchReset();
  });
};
creatures.onFilchLost = () => {
  ui.caption(t('filchLost'), 3500);
};
spells.onIgnite = (ig) => {
  if (!ig._scored) { ig._scored = true; addPoints(1); }
};
creatures.onBanish = () => {
  audio.banish();
  ui.caption(t('banish'), 3600);
};
creatures.onCaught = () => {
  audio.faint();
  audio.dementor(0);
  ui.faint(t('dementorFaint'), () => {
    player.teleport(0, 5, Math.PI, 0);
    creatures.afterCaught();
  });
};
spells.onUnlock = (door) => {
  if (door.id === 'classroom') ui.caption(t('unlockClassroom'), 3600);
  if (door.id === 'potions') ui.caption(t('unlockPotions'), 3600);
};

// ── quest line ───────────────────────────────────────────────────────────────
const quests = [
  { key: 'q0', done: () => !world.doorByName.gate.locked },
  { key: 'q1', done: () => world.inZone(world.zones.greatHall, player.pos.x, player.pos.z) },
  { key: 'q2', done: () => player.pos.y < -2.5 },
  { key: 'q3', done: () => spells.lumosOn && player.pos.y < -2.5 },
  { key: 'q4', done: () => creatures.banishedCount >= 1 },
  { key: 'q5', done: () => !world.doorByName.classroom.locked && !world.doorByName.potions.locked },
  { key: 'q6', done: () => false },
];
let questIdx = 0;
ui.objective(t(quests[0].key));

function updateQuests() {
  const q = quests[questIdx];
  if (q && q.done()) {
    ui.caption(t(q.key + '_done'), 4200);
    audio.chime();
    questIdx += 1;
    addPoints(10);
    if (quests[questIdx]) ui.objective(t(quests[questIdx].key));
  }
}

// ── save / load (localStorage; add ?reset to the URL to start over) ─────────
const SAVE_KEY = 'hogwarts-after-curfew';
if (Q.has('reset')) localStorage.removeItem(SAVE_KEY);
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      q: questIdx,
      p: points,
      h: houseIdx,
      doors: Object.fromEntries(world.doors.map((d) => [d.id, [d.locked ? 1 : 0, d.target]])),
      ign: world.ignitables.map((ig) => (ig.lit ? 1 : 0)),
      pos: [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1), +player.yaw.toFixed(2)],
      hs: [...hintsShown],
    }));
  } catch (e) { /* storage unavailable — play unsaved */ }
}
(function restore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  if (!s) return;
  // an existing save skips the Sorting (legacy saves default to Gryffindor)
  applyHouse(typeof s.h === 'number' ? s.h : 0);
  if (s.doors) {
    for (const [id, st] of Object.entries(s.doors)) {
      const d = world.doorByName[id];
      if (!d || !Array.isArray(st)) continue;
      d.locked = !!st[0];
      d.target = st[1] || 0;
      d.openT = d.target;
    }
  }
  if (Array.isArray(s.ign)) {
    s.ign.forEach((lit, i) => {
      const ig = world.ignitables[i];
      if (!ig) return;
      if (lit && !ig.lit) { world.ignite(ig); ig._scored = true; }
      else if (!lit && ig.lit) world.extinguish(ig);
    });
  }
  if (typeof s.q === 'number') {
    questIdx = Math.min(Math.max(0, s.q), quests.length - 1);
    ui.objective(t(quests[questIdx].key));
  }
  if (typeof s.p === 'number') points = Math.max(0, s.p);
  if (Array.isArray(s.pos)) player.teleport(s.pos[0], s.pos[1], s.pos[2] || 0);
  if (Array.isArray(s.hs)) for (const k of s.hs) hintsShown.add(k);
})();
ui.setPoints(points);
world.setHousePoints(points);
let saveT = 0;
let owlT = 12;
let dripT = 8;
let stepAlt = false;

// ── debug / QA hooks ─────────────────────────────────────────────────────────
window.__game = {
  start() {
    if (!storedLang()) { setLang('en'); localizeDom(); }
    langpickEl.classList.remove('show');
    if (houseIdx === null) applyHouse(0); // QA runs skip the ceremony
    player.debug = true;
    player.enabled = true;
    started = true;
    audio.muted = true;
    ui.hideOverlay();
  },
  teleport(x, z, yaw = 0, pitch = 0, y = null) {
    player.teleport(x, z, yaw, pitch, y);
  },
  cast(name) {
    const i = ['lumos', 'nox', 'alohomora', 'incendio', 'aguamenti', 'leviosa', 'patronum'].indexOf(name);
    if (i >= 0) { spells.select(i); spells.cast(i); }
  },
  openAll() {
    for (const d of world.doors) { d.locked = false; d.target = 1; }
  },
  noCatch(v) { creatures.catchEnabled = !v; },
  scene, camera, renderer, creatures, player,
  state() {
    return {
      pos: [player.pos.x, player.pos.y, player.pos.z].map((v) => +v.toFixed(2)),
      yaw: +player.yaw.toFixed(2),
      quest: questIdx,
      spell: spells.selected,
      lumos: spells.lumosOn,
      banished: creatures.banishedCount,
      sconcesLit: world.ignitables.filter((i) => i.lit).length,
      points,
      house: houseIdx === null ? null : HOUSES[houseIdx].key,
      norris: { state: creatures.norris.state, pos: [+creatures.norris.x.toFixed(1), +creatures.norris.z.toFixed(1)] },
      filch: {
        active: creatures.filch.active,
        pos: [+creatures.filch.group.position.x.toFixed(1), +creatures.filch.group.position.z.toFixed(1)],
      },
      holding: spells.held ? spells.held.userData.name : null,
      chill: +creatures.chill.toFixed(2),
      doors: Object.fromEntries(world.doors.map((d) => [d.id, { locked: d.locked, open: +d.openT.toFixed(2) }])),
      dementors: creatures.dementors.map((d) => ({ state: d.state, pos: [+d.x.toFixed(1), +d.z.toFixed(1)] })),
      errors: window.__errors,
    };
  },
};

// ── main loop ────────────────────────────────────────────────────────────────
// P key: save the exact frame the GPU produced (bypasses the browser's display
// compositor) — for telling game-rendering artifacts apart from display ones.
let wantFrameCapture = false;
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') wantFrameCapture = true;
});

// ── the Marauder's Map (M) ───────────────────────────────────────────────────
const map = new MaraudersMap();
document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyM' || !started) return;
  map.toggle();
  audio.rustle();
  ui.caption(map.open ? t('mapOpen') : t('mapClose'), 2600);
});

function mapActors() {
  const list = [{
    x: player.pos.x, z: player.pos.z, yaw: player.yaw,
    label: 'You', color: HOUSES[houseIdx === null ? 0 : houseIdx].color, player: true,
  }];
  list.push({ x: creatures.norris.x, z: creatures.norris.z, label: 'Mrs. Norris', color: '#6a5b4a' });
  if (creatures.filch.active) {
    const f = creatures.filch.group.position;
    list.push({ x: f.x, z: f.z, label: 'Argus Filch', color: '#4a3319' });
  }
  const g = creatures.ghost.group.position;
  list.push({ x: g.x, z: g.z, label: 'Sir Nicholas', color: '#7a92b8' });
  for (const d of creatures.dementors) {
    if (d.active) list.push({ x: d.x, z: d.z, label: 'Dementor', color: '#26262e' });
  }
  return list;
}

const timer = new THREE.Timer();
let acc = 0;
let shadowWarmup = 3;
// adaptive resolution: if frames run slow, render fewer pixels (and recover later)
let ftAcc = 0, ftN = 0, ftSkip = 150;

function frame() {
  requestAnimationFrame(frame);
  try {
    frameBody();
  } catch (e) {
    // one bad frame must never freeze the picture — log it and keep rendering
    window.__errors.push(String(e && e.message || e));
    try { renderer.render(scene, camera); } catch (e2) { /* next frame */ }
  }
}

function frameBody() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  if (FORCED_RATIO) {
    // fixed-ratio debug mode: no adaptive scaling
  } else if (ftSkip > 0) {
    ftSkip -= 1; // ignore startup/shader-compile stutter
  } else {
    ftAcc += dt; ftN += 1;
    if (ftN >= 90) {
      const avg = ftAcc / ftN;
      ftAcc = 0; ftN = 0;
      let next = ladderIdx;
      if (avg > 0.03 && ladderIdx < RATIO_LADDER.length - 1) next = ladderIdx + 1;
      else if (avg < 0.013 && ladderIdx > 0) next = ladderIdx - 1;
      if (next !== ladderIdx) {
        ladderIdx = next;
        pixelRatio = RATIO_LADDER[ladderIdx];
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    }
  }

  // re-render the moonlight shadow map only while doors move (or on startup)
  if (shadowWarmup > 0 || world.doorsAnimating()) {
    renderer.shadowMap.needsUpdate = true;
    shadowWarmup -= 1;
  }

  player.update(dt);
  world.update(dt, t, player.pos);
  creatures.update(dt, t, player, spells.lumosOn);
  spells.update(dt, t);

  // footsteps + night ambience
  if (player.stepPulse) {
    player.stepPulse = false;
    stepAlt = !stepAlt;
    audio.step(stepAlt);
  }
  owlT -= dt;
  if (owlT <= 0) {
    owlT = 10 + Math.random() * 18;
    if (player.pos.z > 14 && player.pos.y > -1) audio.owl();
  }
  dripT -= dt;
  if (dripT <= 0) {
    dripT = 5 + Math.random() * 9;
    if (player.pos.y < -2.5) audio.drip();
  }
  saveT += dt;
  if (saveT > 5) { saveT = 0; persist(); }

  if (map.open) map.draw(mapActors());

  ui.chill(creatures.chill);
  audio.dementor(creatures.chill);

  // quests don't need per-frame precision
  acc += dt;
  if (acc > 0.2) {
    acc = 0;
    updateQuests();
    if (started) {
      playT += 0.2;
      if (playT > 45) hintOnce('hintMap');
      if (Math.abs(player.pos.y) < 1.5 &&
          Math.hypot(creatures.norris.x - player.pos.x, creatures.norris.z - player.pos.z) < 14) {
        hintOnce('hintCat');
      }
      if (!hintsShown.has('hintLeviosa')) {
        for (const m of world.liftables) {
          if (Math.abs(m.position.y - player.pos.y) < 2.5 &&
              Math.hypot(m.position.x - player.pos.x, m.position.z - player.pos.z) < 3.2) {
            hintOnce('hintLeviosa');
            break;
          }
        }
      }
    }
  }

  renderer.render(scene, camera);

  if (wantFrameCapture) {
    wantFrameCapture = false;
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'hogwarts-frame.png';
      a.click();
    });
  }
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__ready = true;
