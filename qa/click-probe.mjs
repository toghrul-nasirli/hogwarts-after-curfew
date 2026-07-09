// Probe the REAL entry flow: an actual mouse click on the overlay.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--window-size=1280,800', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('http://localhost:8123/', { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__ready === true');

if (process.env.DENY === '1') {
  // simulate a browser that refuses mouse capture
  await page.evaluate(() => {
    const canvas = document.getElementById('scene');
    canvas.requestPointerLock = () => Promise.reject(new Error('denied by test'));
  });
}

await page.evaluate(() => {
  window.__probe = [];
  document.addEventListener('pointerlockchange', () =>
    window.__probe.push(`change: ${document.pointerLockElement ? document.pointerLockElement.id : 'null'}`));
  document.addEventListener('pointerlockerror', () => window.__probe.push('ERROR event'));
  // watch the promise rejection reason directly
  const canvas = document.getElementById('scene');
  const orig = canvas.requestPointerLock.bind(canvas);
  canvas.requestPointerLock = (...a) => {
    window.__probe.push('requestPointerLock called');
    try {
      const p = orig(...a);
      if (p && p.then) {
        p.then(() => window.__probe.push('promise resolved'),
               (err) => window.__probe.push(`promise rejected: ${err && err.message}`));
      } else {
        window.__probe.push(`returned: ${p}`);
      }
      return p;
    } catch (e) {
      window.__probe.push(`threw: ${e.message}`);
      throw e;
    }
  };
});

await page.mouse.click(640, 400); // real click on the overlay
await new Promise((r) => setTimeout(r, 1600));

const report = await page.evaluate(() => ({
  probe: window.__probe,
  overlayHidden: document.getElementById('overlay').classList.contains('hidden'),
  lockElement: document.pointerLockElement ? document.pointerLockElement.id : null,
  state: window.__game.state(),
  errors: window.__errors,
}));
console.log(JSON.stringify(report, null, 2));
await browser.close();
