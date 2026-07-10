// QA harness: drives the game headlessly in Chrome and captures screenshots.
// Usage: node qa/shot.mjs [scenario ...] | all
// Screenshots land in qa/shots/<name>.png; console/page errors are reported.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'qa', 'shots');
const URL = process.env.GAME_URL || 'http://localhost:8123/';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const YAW = { N: 0, W: Math.PI / 2, E: -Math.PI / 2, S: Math.PI };

// Each scenario: list of steps {tp:[x,z,yaw,pitch]}, {cast:'lumos'}, {wait:ms}, {js:'...'}
const SCENARIOS = {
  spawn: [{ tp: [0, 38, YAW.N, 0] }, { wait: 900 }],
  gate: [{ tp: [0, 21, YAW.N, 0.02] }, { wait: 500 }],
  'gate-unlocked': [{ tp: [0, 20, YAW.N, 0] }, { cast: 'alohomora' }, { wait: 2600 }],
  entrance: [{ js: '__game.openAll()' }, { tp: [0, 11.5, YAW.N, 0] }, { wait: 500 }],
  'entrance-back': [{ tp: [0, -3, YAW.S, 0.05] }, { wait: 500 }],
  'great-hall': [{ js: '__game.openAll()' }, { tp: [-13.5, 4, YAW.W, 0.04] }, { wait: 700 }],
  'great-hall-dais': [{ tp: [-17, -2, YAW.W, 0.02] }, { wait: 700 }],
  'great-hall-back': [{ tp: [-39, -2, YAW.E, 0.06] }, { wait: 700 }],
  corridor: [{ tp: [13.5, 4, YAW.E, 0.02] }, { wait: 500 }],
  classroom: [{ js: '__game.openAll()' }, { tp: [43, 15, YAW.W, 0.03] }, { wait: 600 }],
  vista: [{ tp: [-3.5, -5.2, YAW.N, 0.1] }, { wait: 600 }],
  'stairs-down': [{ tp: [7, -7.5, YAW.N, -0.25] }, { wait: 500 }],
  'dungeon-dark': [{ tp: [7, -18, YAW.W, 0] }, { wait: 700 }],
  'dungeon-lumos': [{ tp: [7, -18, YAW.W, 0] }, { cast: 'lumos' }, { wait: 900 }],
  patronus: [{ tp: [7, -18, YAW.W, 0] }, { cast: 'lumos' }, { wait: 400 }, { cast: 'patronum' }, { wait: 1300 }],
  'patronus-late': [{ tp: [7, -18, YAW.W, 0] }, { cast: 'lumos' }, { wait: 400 }, { cast: 'patronum' }, { wait: 2600 }],
  potions: [{ js: '__game.openAll()' }, { tp: [-33, -20, YAW.W, 0.05], }, { cast: 'lumos' }, { wait: 800 }],
  incendio: [{ tp: [-10, -20, YAW.N, 0.12] }, { cast: 'incendio' }, { wait: 900 }],
  'incendio-ground': [{ tp: [-5, -4, YAW.W, 0.43] }, { cast: 'incendio' }, { wait: 900 }],
  candelabra: [{ js: '__game.openAll()' }, { tp: [-36.5, -20, YAW.W, -0.12] }, { cast: 'incendio' }, { wait: 900 }],
  douse: [{ tp: [-5, -3.2, 0.85, -0.08] }, { cast: 'incendio' }, { wait: 500 }, { cast: 'aguamenti' }, { wait: 700 }],
  'hall-candles': [{ js: '__game.openAll()' }, { tp: [-24, -2, -2.28, -0.09] }, { cast: 'incendio' }, { wait: 700 }],
  'stairs-threshold': [{ tp: [7, -4.2, 0, -0.35] }, { wait: 500 }],
  'dungeon-door-view': [{ tp: [6.2, -1.5, YAW.N, 0] }, { wait: 500 }],
  'dungeon-silhouette': [{ tp: [7, -18, YAW.W, 0] }, { wait: 2600 }],
  'courtyard-look-back': [{ tp: [0, 20, YAW.S, 0.05] }, { wait: 500 }],
  'room-wide': [{ js: '__game.world.revealRoom()' }, { tp: [24, 9.6, YAW.S, 0.05] }, { cast: 'lumos' }, { wait: 800 }],
  'room-erised': [{ js: '__game.world.revealRoom()' }, { tp: [22.6, 11.3, YAW.S, 0] }, { wait: 2600 }],
  'room-cabinet': [{ js: '__game.world.revealRoom()' }, { tp: [23.2, 10.9, Math.PI / 2, 0.42] }, { cast: 'lumos' }, { wait: 800 }],
  'room-west': [{ js: '__game.world.revealRoom()' }, { tp: [26.2, 10.2, 1.97, 0.05] }, { cast: 'lumos' }, { wait: 800 }],
  'room-books': [{ js: '__game.world.revealRoom()' }, { tp: [23.2, 10.6, 1.31, -0.15] }, { cast: 'lumos' }, { wait: 800 }],
  riddle: [{ js: '__game.openAll()' }, { tp: [-36.5, -18.95, Math.PI, 0.08] }, { cast: 'lumos' }, { wait: 1000 }],
  'riddle-plinth': [{ js: '__game.openAll()' }, { tp: [-36.5, -16.8, Math.PI, 0.42] }, { cast: 'lumos' }, { wait: 1000 }],
  'grey-lady': [
    { js: '(() => { const L = __game.creatures.lady.group.position; __game.teleport(L.x, L.z + 2.6, 0, 0.02); })()' },
    { wait: 700 },
  ],
};

const names = process.argv.slice(2);
const list = names.length === 0 || names[0] === 'all' ? Object.keys(SCENARIOS) : names;

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--window-size=1280,800', '--hide-scrollbars', '--mute-audio', '--use-gl=angle'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction('window.__ready === true', { timeout: 20000 });
await page.evaluate('__game.start()');
await page.evaluate('__game.noCatch(true)'); // deterministic screenshots
await new Promise((r) => setTimeout(r, 600));

for (const name of list) {
  const steps = SCENARIOS[name];
  if (!steps) { console.log(`unknown scenario: ${name}`); continue; }
  // fresh page state per scenario is overkill; reset spells instead
  await page.evaluate('__game.cast("nox")');
  for (const s of steps) {
    if (s.tp) await page.evaluate(`__game.teleport(${s.tp.join(',')})`);
    if (s.cast) await page.evaluate(`__game.cast("${s.cast}")`);
    if (s.js) await page.evaluate(s.js);
    if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`shot: ${name}.png`);
}

const state = await page.evaluate('JSON.stringify(__game.state())');
console.log('STATE:', state);
if (problems.length) {
  console.log('PROBLEMS:');
  for (const p of [...new Set(problems)]) console.log(' ', p);
} else {
  console.log('PROBLEMS: none');
}
await browser.close();
