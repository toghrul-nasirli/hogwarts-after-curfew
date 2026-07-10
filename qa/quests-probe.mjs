// Probe: Snape's bottle riddle + the Grey Lady's diadem.
// Riddle: wrong bottles punish/tease/eject, right bottle (the dwarf, idx 3)
// solves for +30. Lady: meet her → take diadem in the RoR → return it (+30).
import puppeteer from 'puppeteer-core';

const URL = process.env.GAME_URL || 'http://localhost:8123/?reset';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--window-size=1280,800', '--mute-audio', '--use-gl=angle'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__game !== undefined', { timeout: 15000 });
await page.evaluate('__game.start()');
await page.evaluate('__game.noCatch(true)'); // quests under test, not stealth
const state = () => page.evaluate('__game.state()');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${name}: ${ok ? 'OK' : 'FAIL'}${extra ? '  (' + extra + ')' : ''}`);
};

// ── riddle ──────────────────────────────────────────────────────────────────
await page.evaluate('__game.teleport(-36.5, -17.5, Math.PI, 0)');
await sleep(600);
const place = (i) => page.evaluate(`(() => {
  const b = __game.world.riddle.bottles[${i}], p = __game.world.riddle.pedestal;
  b.position.set(p.x, p.y + b.userData.restH, p.z);
})()`);
const bottleAt = (i) => page.evaluate(`(() => {
  const b = __game.world.riddle.bottles[${i}];
  return [+b.position.x.toFixed(2), +b.position.z.toFixed(2)];
})()`);

const s0 = await state();
await place(0); // poison
await sleep(600);
let s = await state();
check('riddle poison: -10 pts, bottle sent home', s.points === s0.points - 10 && (await bottleAt(0))[1] === -15.95 && !s.riddle);
await sleep(3200); // wrong-answer cooldown
await place(6); // the giant — sends you back to the door
await sleep(600);
s = await state();
check('riddle giant: ejected to the door', Math.abs(s.pos[0] + 32.2) < 0.6 && Math.abs(s.pos[2] + 19.9) < 0.6 && !s.riddle, `pos ${s.pos}`);
await page.evaluate('__game.teleport(-36.5, -17.5, Math.PI, 0)');
await sleep(3200);
const s1 = await state();
await place(3); // the dwarf — the answer
await sleep(600);
s = await state();
check('riddle dwarf: solved, +30 pts', s.riddle === true && s.points === s1.points + 30, `points ${s1.points} -> ${s.points}`);

// ── grey lady ───────────────────────────────────────────────────────────────
const goToLady = () => page.evaluate(`(() => {
  const L = __game.creatures.lady.group.position;
  __game.teleport(L.x, L.z + 1.5, 0, 0);
})()`);
await goToLady();
await sleep(600);
s = await state();
check('lady met: stage 1', s.lady === 1);
await page.evaluate('__game.world.revealRoom(); __game.teleport(21.9, 10.9, Math.PI / 2, 0)');
await sleep(600);
s = await state();
check('diadem taken: stage 2', s.lady === 2);
await sleep(14500); // her patience timer between words
await goToLady();
await sleep(1200);
s = await state();
check('diadem returned: stage 3, +30 pts', s.lady === 3, `lady ${s.lady}, points ${s.points}`);

check('no errors', errors.length === 0 && s.errors.length === 0, JSON.stringify([...errors, ...s.errors]));
const pass = results.every(Boolean);
console.log(pass ? 'ALL PASS' : 'PROBE FAILED');
await browser.close();
process.exit(pass ? 0 : 1);
