import { chromium } from 'file:///C:/Users/DevTrivi/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://localhost:8080');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('frame'));
  const result = await page.evaluate(async () => {
    const { CapeSprite } = await import('/src/game/CapeSprite.js');
    const actor = new CapeSprite({ input: { isDown: () => false }, width: 800, height: 800, scale: 1 });
    await actor.load();
    const canvas = document.createElement('canvas'); canvas.width = 1152; canvas.height = Object.keys(actor.clips).length * 164;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#18212e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const counts = {};
    Object.entries(actor.clips).forEach(([name, frames], row) => {
      counts[name] = frames.map((frame, i) => {
        ctx.drawImage(frame.canvas, i * 128, row * 164 + 20);
        ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.fillText(`${name} ${i + 1}`, i * 128 + 4, row * 164 + 14);
        let opaque = 0, edge = 0;
        for (let y = 0; y < 144; y++) for (let x = 0; x < 128; x++) {
          if (frame.mask.data[(y * 128 + x) * 4 + 3] > 24) {
            opaque++; if (x === 0 || x === 127 || y === 0 || y === 143) edge++;
          }
        }
        return { opaque, edge };
      });
    });
    const ground = actor.y;
    actor.update(0.49, { width: 800, height: 800 });
    const idleHeld = actor.frame === 0;
    actor.update(0.02, { width: 800, height: 800 });
    const idleAdvanced = actor.frame === 1;
    actor.trigger('jump'); actor.update(0.3, { width: 800, height: 800 });
    const raised = actor.y < ground;
    const airClock = actor.airTime;
    const airRollStarted = actor.trigger('roll') && actor.clip === 'airroll' && actor.airTime === airClock;
    for (let i = 0; i < 30; i++) actor.update(0.03, { width: 800, height: 800 });
    const landed = Math.abs(actor.y - ground) < 0.01 && actor.action === null;
    const startX = actor.x;
    actor.trigger('roll'); actor.update(0.3, { width: 800, height: 800 });
    const rolled = actor.x > startX;
    for (let i = 0; i < 25; i++) actor.update(0.03, { width: 800, height: 800 });
    const shieldStarted = actor.trigger('shield');
    for (let i = 0; i < 45; i++) actor.update(0.03, { width: 800, height: 800 });
    return { counts, idleHeld, idleAdvanced, airRollStarted, shieldEnded: shieldStarted && actor.action === null, raised, landed, rolled, atlas: canvas.toDataURL().split(',')[1] };
  });
  assert.ok(result.raised && result.landed && result.rolled);
  assert.ok(result.idleHeld && result.idleAdvanced && result.airRollStarted && result.shieldEnded);
  for (const frames of Object.values(result.counts)) for (const frame of frames) {
    assert.ok(frame.opaque > 100); assert.equal(frame.edge, 0);
  }
  await mkdir('archive/cape-reference', { recursive: true });
  await writeFile('archive/cape-reference/atlas.png', Buffer.from(result.atlas, 'base64'));
  for (const animation of ['idle', 'run', 'jump', 'roll', 'cast', 'airroll', 'shield']) {
    await page.selectOption('#animation-preview', animation);
    await page.waitForFunction(name => document.querySelector('#status').textContent.startsWith(name.toUpperCase()), animation);
    await page.waitForTimeout(300);
  }
  await page.selectOption('#animation-preview', 'auto');
  await page.click('#autoattack');
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('CAST'));
  await page.click('#autoattack');
  await page.waitForTimeout(650);
  await page.click('#airroll');
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('AIRROLL'));
  await page.waitForTimeout(950);
  await page.click('#shield');
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('SHIELD'));
  await page.screenshot({ path: 'archive/cape-reference/shield.png' });
  await page.selectOption('#animation-preview', 'idle');
  await page.click('#toolbox-toggle');
  await page.click('#toolbox-toggle');
  assert.equal(await page.locator('#density').isVisible(), true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'archive/cape-reference/rain.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#toolbox-toggle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'archive/cape-reference/mobile.png' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ counts: result.counts, jump: result.raised && result.landed, roll: result.rolled, errors }));
} finally { await browser.close(); }
