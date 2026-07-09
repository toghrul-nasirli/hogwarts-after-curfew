// Bootstrap: renderer, world, player, creatures, spells, quest line, game loop.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { SpellSystem } from './spells.js';
import { Creatures } from './creatures.js';
import { UI } from './ui.js';
import { AudioFX } from './audio.js';

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

function enterGame() {
  ui.hideOverlay();
  if (!started) {
    started = true;
    ui.caption('The courtyard is deserted. The castle sleeps…', 4200);
  }
}

function startWithoutLock() {
  if (document.pointerLockElement === canvas || player.debug) return;
  player.debug = true; // mouse-look from raw mouse movement, cursor stays visible
  player.enabled = true;
  enterGame();
  ui.caption('Mouse capture unavailable — the view follows your mouse instead.', 5000);
}

ui.onStart = () => {
  audio.start();
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

// ── creature events ──────────────────────────────────────────────────────────
creatures.onBanish = () => {
  audio.banish();
  ui.caption('The Dementor shreds apart with a distant shriek!', 3600);
};
creatures.onCaught = () => {
  audio.faint();
  audio.dementor(0);
  ui.faint('You fainted… Madam Pomfrey levitated you to safety and fed you chocolate.', () => {
    player.teleport(0, 5, Math.PI, 0);
    creatures.afterCaught();
  });
};
spells.onUnlock = (door) => {
  if (door.id === 'classroom') ui.caption('The Charms classroom — empty desks, waiting chalk.', 3600);
  if (door.id === 'potions') ui.caption('Snape’s potion store! Best not touch anything… much.', 3600);
};

// ── quest line ───────────────────────────────────────────────────────────────
const quests = [
  {
    text: 'Cross the courtyard to the <b>Castle Gate</b>. It’s locked — select <b>Alohomora</b> [3] and click while looking at it.',
    done: () => !world.doorByName.gate.locked,
    onDone: 'The great oak doors groan inward. You’re in.',
  },
  {
    text: 'Slip inside and find the <b>Great Hall</b> — the tall double doors on the <b>left</b> of the Entrance Hall. Press <span style="color:#ffe9a8">[E]</span> to open doors.',
    done: () => world.inZone(world.zones.greatHall, player.pos.x, player.pos.z),
    onDone: 'A thousand candles float beneath a sky that isn’t there.',
  },
  {
    text: 'When you’ve had your fill of the candles, head back and take the <b>dungeon stairs</b> — the low opening to the <b>right</b> of the Grand Staircase — and go down.',
    done: () => player.pos.y < -2.5,
    onDone: 'The air turns cold and damp. Something is down here.',
  },
  {
    text: 'You can barely see your own hands. Cast <b>Lumos</b> [1] to light your wand. (<b>Nox</b> [2] snuffs it out.)',
    done: () => spells.lumosOn && player.pos.y < -2.5,
    onDone: 'Wandlight washes over dripping stone… and long, barred cells.',
  },
  {
    text: 'That creeping, hollow cold — a <b>Dementor</b> is hunting you! Face it and cast <b>Expecto Patronum</b> [0]. Don’t let it touch you!',
    done: () => creatures.banishedCount >= 1,
    onDone: 'Your silver stag drives the darkness away. You did it!',
  },
  {
    text: 'You’ve mastered the great charms! ⚡ For extra credit: unlock the <b>Charms Classroom</b> (east corridor) and the <b>Potions Store</b> (dungeon’s end), light candles and sconces with <b>Incendio</b> [4] — and douse them with <b>Aguamenti</b> [5].',
    done: () => !world.doorByName.classroom.locked && !world.doorByName.potions.locked,
    onDone: 'Every door in the castle stands open to you. Sleep well, wizard.',
  },
  {
    text: '⚡ Every door stands open. Explore as long as you like — the candles never burn down.',
    done: () => false,
  },
];
let questIdx = 0;
ui.objective(quests[0].text);

function updateQuests() {
  const q = quests[questIdx];
  if (q && q.done()) {
    if (q.onDone) ui.caption(q.onDone, 4200);
    audio.chime();
    questIdx += 1;
    if (quests[questIdx]) ui.objective(quests[questIdx].text);
  }
}

// ── debug / QA hooks ─────────────────────────────────────────────────────────
window.__game = {
  start() {
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
    const i = ['lumos', 'nox', 'alohomora', 'incendio', 'aguamenti', 'patronum'].indexOf(name);
    if (i >= 0) { spells.select(i); spells.cast(i); }
  },
  openAll() {
    for (const d of world.doors) { d.locked = false; d.target = 1; }
  },
  noCatch(v) { creatures.catchEnabled = !v; },
  scene, camera, renderer,
  state() {
    return {
      pos: [player.pos.x, player.pos.y, player.pos.z].map((v) => +v.toFixed(2)),
      yaw: +player.yaw.toFixed(2),
      quest: questIdx,
      spell: spells.selected,
      lumos: spells.lumosOn,
      banished: creatures.banishedCount,
      sconcesLit: world.ignitables.filter((i) => i.lit).length,
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

const timer = new THREE.Timer();
let acc = 0;
let shadowWarmup = 3;
// adaptive resolution: if frames run slow, render fewer pixels (and recover later)
let ftAcc = 0, ftN = 0, ftSkip = 150;

function frame() {
  requestAnimationFrame(frame);
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
  creatures.update(dt, t, player);
  spells.update(dt, t);

  ui.chill(creatures.chill);
  audio.dementor(creatures.chill);

  // quests don't need per-frame precision
  acc += dt;
  if (acc > 0.2) { acc = 0; updateQuests(); }

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
