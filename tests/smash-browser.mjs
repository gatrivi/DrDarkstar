// Super Smash Cousins end-to-end harness: real keyboard input against the live
// page, plus the regressions listed in HANDOFF.md (keys after a click, KO →
// stock loss, eliminated fighter stays out, reset to opposite sides, versus
// join, remapped controls). Run via `npm run test:browser -- smash`.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchBrowser, BASE_URL } from './browser-env.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], failedResources = [], checks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400) failedResources.push(`${r.status()} ${r.url()}`); });
const check = (condition, name) => { assert.ok(condition, name); checks.push(name); };
const state = () => page.evaluate(() => {
  const { stage } = window.smash;
  const pick = (f) => ({ x: f.x, y: f.y, percent: f.percent, stocks: f.stocks, onGround: f.onGround,
    respawnTimer: f.respawnTimer, facing: f.facing, name: f.name });
  return { p1: pick(stage.andy), foe: pick(stage.dummy), mode: stage.mode, width: stage.width,
    status: document.querySelector('#status').textContent };
});
const waitFor = (fn, arg, timeout = 4000) => page.waitForFunction(fn, arg, { timeout });
// Put both fighters standing on the slab, facing each other, `gap` px apart.
const stageFighters = (gap) => page.evaluate((gap) => {
  const { stage } = window.smash;
  const mid = stage.width / 2;
  for (const [f, side] of [[stage.andy, -1], [stage.dummy, 1]]) {
    Object.assign(f, { x: mid + side * gap / 2, vx: 0, vy: 0, percent: 0, hitstun: 0, action: null,
      onGround: true, respawnTimer: 0, invuln: 0, shielding: false, facing: -side });
    f.y = stage.platform.y - f.renderHeight / 2;
  }
  stage.cpu.reset();
}, gap);
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };

await mkdir('output/smash-cousins', { recursive: true });
try {
  // Clean controls: remaps persist in localStorage between runs.
  await page.goto(`${BASE_URL}/games.html`);
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('link', { name: /SUPER SMASH COUSINS/ }).click();
  await waitFor(() => !/Loading/.test(document.querySelector('#status').textContent), null, 15000);
  await page.evaluate(async () => { window.smash = await import('/src/smash.js'); });
  let s = await state();
  check(s.mode === 'cpu' && s.p1.stocks === 3 && s.foe.stocks === 3, 'match boots P1 vs CPU with 3 stocks each');
  check(s.p1.name !== s.foe.name, 'foe never mirrors P1');
  check(await page.evaluate(() => window.smash.stage.photoBackdrops.length > 0), 'photo backdrop loaded');
  await page.screenshot({ path: 'output/smash-cousins/boot.png' });

  // Training dummy so the foe holds still for deterministic checks.
  await page.evaluate(() => window.smash.stage.setCpuLevel('dummy'));
  await stageFighters(400);

  const x0 = (await state()).p1.x;
  await hold('d', 450);
  check((await state()).p1.x > x0 + 40, 'D walks P1 right');
  const x1 = (await state()).p1.x;
  await hold('a', 450);
  check((await state()).p1.x < x1 - 40, 'A walks P1 left');

  const y0 = (await state()).p1.y;
  await page.keyboard.press('w');
  await waitFor((y0) => window.smash.stage.andy.y < y0 - 30, y0);
  check(true, 'W jumps');
  await waitFor(() => window.smash.stage.andy.onGround, null);
  check(true, 'P1 lands back on the slab');

  // Jab connects on an adjacent foe.
  await stageFighters(70);
  await page.keyboard.press('j');
  await waitFor(() => window.smash.stage.dummy.percent > 0, null);
  check(true, 'J jab damages an adjacent foe');

  // Charged smash does more than a jab.
  await stageFighters(70);
  await hold('k', 700);
  await waitFor(() => window.smash.stage.dummy.percent > 5, null);
  check(true, 'hold-K smash charges and lands');

  // Clicking a toolbar button must not steal game keys (HANDOFF regression).
  await stageFighters(400);
  await page.locator('#rain').click();
  await page.locator('#rain').click();
  const x2 = (await state()).p1.x;
  await hold('d', 450);
  check((await state()).p1.x > x2 + 40, 'keys still drive P1 after clicking a toolbar button');
  check(await page.evaluate(() => window.smash.stage.worldRainEnabled), 'world rain toggles off and back on');

  // Blast zone KO costs a stock; losing the last stock keeps the fighter out.
  await page.evaluate(() => { const d = window.smash.stage.dummy; d.x = -400; d.y = 0; });
  await waitFor(() => window.smash.stage.dummy.stocks === 2, null);
  check(true, 'leaving the blast zone costs a stock');
  await page.evaluate(() => { const d = window.smash.stage.dummy; d.stocks = 1; d.respawnTimer = 0; d.x = -400; d.y = 0; });
  await waitFor(() => window.smash.stage.dummy.stocks === 0, null);
  await waitFor(() => /WINS/.test(document.querySelector('#status').textContent), null);
  check(true, 'last stock lost announces the winner');
  await page.waitForTimeout(1500);
  check((await state()).foe.respawnTimer === Infinity, 'eliminated fighter stays out until Reset');
  await page.screenshot({ path: 'output/smash-cousins/win.png' });

  // Reset match: stocks restored, fighters on opposite sides facing in.
  await page.locator('#reset').click();
  s = await state();
  check(s.p1.stocks === 3 && s.foe.stocks === 3, 'Reset match restores 3 stocks each');
  check(s.p1.x < s.width / 2 && s.foe.x > s.width / 2, 'Reset match puts fighters on opposite sides');
  check(s.p1.facing === 1 && s.foe.facing === -1, 'Reset match faces fighters toward each other');

  // Versus: T toggles, arrow keys drive P2.
  await page.keyboard.press('t');
  await waitFor(() => window.smash.stage.mode === 'versus', null);
  check((await page.locator('#foeRole').textContent()) === 'P2', 'T switches to versus (P2 label)');
  await page.waitForTimeout(2000); // respawn invulnerability/drop from Reset settles
  await stageFighters(400);
  const fx = (await state()).foe.x;
  await hold('ArrowLeft', 450);
  check((await state()).foe.x < fx - 40, 'ArrowLeft drives P2 in versus');
  await page.keyboard.press('t');
  await waitFor(() => window.smash.stage.mode === 'cpu', null);
  check(true, 'T switches back to P1 vs CPU');

  // Remap P1 "Move right" to KeyF through the Controls panel.
  await page.locator('#padOpen').click();
  check(await page.locator('#padPanel').isVisible(), 'Controls panel opens');
  const rightKey = page.locator('#padP1 .pad-row', { hasText: 'Move right' }).locator('.pad-key');
  await rightKey.click();
  await page.keyboard.press('f');
  check(/F/.test(await rightKey.textContent()), 'remap shows the new key');
  check(await page.evaluate(() => JSON.stringify(localStorage).includes('KeyF')), 'remap persists in localStorage');
  await page.locator('#padClose').click();
  await page.evaluate(() => window.smash.stage.setCpuLevel('dummy'));
  await stageFighters(400);
  const x3 = (await state()).p1.x;
  await hold('f', 450);
  check((await state()).p1.x > x3 + 40, 'remapped key drives P1');
  await page.locator('#padOpen').click();
  await page.locator('#padReset').click();
  await page.locator('#padClose').click();
  check(await page.evaluate(() => !JSON.stringify(localStorage).includes('KeyF')), 'Reset defaults clears the remap');

  // Pause freezes the fight.
  await page.keyboard.press('p');
  await stageFighters(400);
  const x4 = (await state()).p1.x;
  await hold('d', 400);
  check(Math.abs((await state()).p1.x - x4) < 1, 'P pauses the match');
  await page.keyboard.press('p');

  // Phone landscape: page fits without horizontal scroll.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'phone landscape has no horizontal overflow');
  await page.screenshot({ path: 'output/smash-cousins/mobile.png' });

  check(errors.length === 0, 'no browser errors');
  check(failedResources.length === 0, 'no failed resources');
} catch (error) {
  await page.screenshot({ path: 'output/smash-cousins/failure.png' }).catch(() => {});
  errors.push(`harness: ${error.message}`);
} finally {
  const report = { checks: checks.length, passed: checks, errors, failedResources };
  await writeFile('output/smash-cousins/verification.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failedResources.length) process.exitCode = 1;
}
