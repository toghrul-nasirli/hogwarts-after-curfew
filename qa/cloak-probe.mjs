// Probe: Filch must stop pursuing a cloaked player.
// Scenario: Filch chases → cloak on + player steps aside → Filch walks to the
// LAST SEEN spot (not the player), searches briefly, gives up. Uncloak → he
// reacquires on a fresh spawn.
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
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__game !== undefined', { timeout: 15000 });
await page.evaluate('__game.start()');
await new Promise((r) => setTimeout(r, 500));

const CLOAK_SPOT = [20, 4]; // corridor, where the player will vanish
const HIDE_SPOT = [14, 4];  // 6 units west, still in the corridor

// Phase 1: visible chase — distance to player must shrink
await page.evaluate(`
  __game.teleport(${CLOAK_SPOT[0]}, ${CLOAK_SPOT[1]}, -Math.PI/2, 0);
  __game.creatures.filch.spawn(__game.player.pos);
  __game.creatures.filch.group.position.set(28, 0, 4);
`);
const dist = () => page.evaluate(`(() => {
  const f = __game.creatures.filch, p = __game.player.pos;
  return {
    active: f.active,
    fpos: [+f.group.position.x.toFixed(2), +f.group.position.z.toFixed(2)],
    toPlayer: +Math.hypot(p.x - f.group.position.x, p.z - f.group.position.z).toFixed(2),
    toSpot: +Math.hypot(${CLOAK_SPOT[0]} - f.group.position.x, ${CLOAK_SPOT[1]} - f.group.position.z).toFixed(2),
    ppos: [+p.x.toFixed(2), +p.z.toFixed(2)],
  };
})()`);

const d0 = await dist();
await new Promise((r) => setTimeout(r, 1500));
const d1 = await dist();
const chaseOK = d1.toPlayer < d0.toPlayer - 1;
console.log(`phase1 visible chase: ${d0.toPlayer} -> ${d1.toPlayer}  ${chaseOK ? 'OK (closing in)' : 'FAIL'}`);

// Phase 2: cloak on, step aside — he must head to CLOAK_SPOT, never the player,
// then give up (active=false) without a catch (player pos unchanged).
await page.evaluate(`__game.cloak(true); __game.teleport(${HIDE_SPOT[0]}, ${HIDE_SPOT[1]}, Math.PI/2, 0)`);
let minToPlayer = Infinity, gaveUp = false, trail = [];
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 300));
  const s = await dist();
  if (s.active) { minToPlayer = Math.min(minToPlayer, s.toPlayer); trail.push(`${s.toSpot}/${s.toPlayer}`); }
  else { gaveUp = true; break; }
}
const st = await page.evaluate('__game.state()');
const noApproach = minToPlayer > 3;
const noCatch = Math.abs(st.pos[0] - HIDE_SPOT[0]) < 0.5 && Math.abs(st.pos[2] - HIDE_SPOT[1]) < 0.5;
console.log(`phase2 cloaked: toSpot/toPlayer trail: ${trail.join(' ')}`);
console.log(`phase2 gave up: ${gaveUp ? 'OK' : 'FAIL (still active after 12s)'}`);
console.log(`phase2 min dist to player: ${minToPlayer}  ${noApproach ? 'OK (never approached)' : 'FAIL'}`);
console.log(`phase2 player untouched at ${st.pos}: ${noCatch ? 'OK' : 'FAIL'}`);

// Phase 3: uncloak → fresh spawn reacquires the live player
await page.evaluate(`
  __game.cloak(false);
  __game.creatures.filch.spawn(__game.player.pos);
  __game.creatures.filch.group.position.set(24, 0, 4);
`);
const e0 = await dist();
await new Promise((r) => setTimeout(r, 1500));
const e1 = await dist();
const reacq = e1.toPlayer < e0.toPlayer - 1;
console.log(`phase3 uncloaked reacquire: ${e0.toPlayer} -> ${e1.toPlayer}  ${reacq ? 'OK' : 'FAIL'}`);

console.log(`errors: ${errors.length === 0 && st.errors.length === 0 ? 'none' : JSON.stringify([...errors, ...st.errors])}`);
const pass = chaseOK && gaveUp && noApproach && noCatch && reacq && errors.length === 0;
console.log(pass ? 'ALL PASS' : 'PROBE FAILED');
await browser.close();
process.exit(pass ? 0 : 1);
