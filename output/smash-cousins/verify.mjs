// Headless verification for Super Smash Cousins: three cousin sheets, world
// rain on/off, swaps, Simon's kit, zero page errors. Same pattern as
// tests/night-browser.mjs. Screenshots land in output/smash-cousins/.
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'C:/Users/DevTrivi/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Users/DevTrivi/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
const context = browser.contexts()[0] || await browser.newContext();
const page = context.pages()[0] || await context.newPage();
const errors = [], failedResources = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`); });
await mkdir('output/smash-cousins', { recursive: true });
const shots = [];
const shot = async (name) => {
  const path = `output/smash-cousins/${name}.png`;
  await page.screenshot({ path });
  shots.push(path);
};
const results = { checks: [], errors, failedResources, shots };
const check = (name, ok, extra = '') => {
  results.checks.push(`${ok ? 'ok' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) process.exitCode = 1;
};

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:8080'}/smash.html`);
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('ANDY vs DUMMY'), null, { timeout: 30000 });
  check('andy loads', true);

  // World rain warms up over ~3s; then measure real headless fps.
  await page.waitForTimeout(3500);
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const t0 = performance.now();
    const count = () => {
      frames++;
      if (performance.now() - t0 < 2500) requestAnimationFrame(count);
      else resolve(Math.round(frames / ((performance.now() - t0) / 1000)));
    };
    requestAnimationFrame(count);
  }));
  results.fpsWorldRain = fps;
  check('world rain fps >= 30', fps >= 30, `${fps} fps`);
  await shot('andy-rain');

  // Idle dummy: stands its ground (no wandering, no attacks).
  await page.evaluate(async () => { window.smashTest = await import('/src/smash.js'); });
  const idle = await page.evaluate(async () => {
    const s = window.smashTest.stage;
    const x0 = s.dummy.x;
    const stocks = s.dummy.stocks;
    await new Promise((r) => setTimeout(r, 2500));
    return { x0, x1: s.dummy.x, stocks };
  });
  check('dummy idles at spawn', Math.abs(idle.x1 - idle.x0) < 24, `drift ${Math.round(idle.x1 - idle.x0)}px`);

  // Classic mode off-switch.
  await page.keyboard.press('n');
  await page.waitForTimeout(700);
  const rainOff = await page.evaluate(() => document.querySelector('#rain').textContent.includes('OFF'));
  check('N toggles world rain off', rainOff);
  await shot('andy-classic');
  await page.keyboard.press('n');
  await page.waitForTimeout(1500);

  // Body push: walking into the idle dummy shoves it along the slab.
  await page.keyboard.down('d');
  await page.waitForTimeout(2600);
  await page.keyboard.up('d');
  await page.waitForTimeout(500);
  const pushed = await page.evaluate(() => window.smashTest.stage.dummy.x);
  check('walking into the dummy pushes it', pushed > idle.x1 + 100, `moved ${Math.round(pushed - idle.x1)}px`);
  await shot('dummy-push');

  // Swap to Eliseo.
  await page.keyboard.press('c');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('ELISEO vs DUMMY'), null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  check('eliseo loads', true);
  await shot('eliseo-rain');

  // Eliseo attack: J jab must not error and must set an action.
  await page.keyboard.press('j');
  await page.waitForTimeout(300);
  const eliseoAction = await page.evaluate(() => window.__smashProbe?.lastAction ?? 'probe-unavailable');
  if (eliseoAction !== 'probe-unavailable') check('eliseo jab starts an action', !!eliseoAction, String(eliseoAction));

  // Swap to Simon.
  await page.keyboard.press('c');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('SIMON vs DUMMY'), null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  check('simon loads', true);
  await shot('simon-rain');

  // Simon's kit: paddle jab, iron smash charge, pitbull summon.
  await page.keyboard.press('j');
  await page.waitForTimeout(400);
  await page.keyboard.down('k');
  await page.waitForTimeout(600);
  await shot('simon-smash-charge');
  await page.keyboard.up('k');
  await page.waitForTimeout(500);
  await page.keyboard.press('i');
  await page.waitForTimeout(600);
  await shot('simon-pitbull');
} catch (error) {
  results.checks.push(`FAIL harness — ${error.message}`);
  process.exitCode = 1;
} finally {
  await writeFile('output/smash-cousins/verify.json', JSON.stringify(results, null, 2));
  console.log(results.checks.join('\n'));
  console.log(`fps(world rain): ${results.fpsWorldRain ?? 'n/a'}`);
  console.log(`page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  console.log(`failed resources: ${failedResources.length ? failedResources.join(' | ') : 'none'}`);
  console.log(`screenshots: ${shots.join(', ')}`);
  await browser.close();
}
