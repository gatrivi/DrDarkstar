import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PLAYWRIGHT_MODULE || 'C:/Users/DevTrivi/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM_PATH || 'C:/Users/DevTrivi/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await mkdir('output/night-hunters', { recursive: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto('http://127.0.0.1:8080/night.html');
await page.waitForFunction(() => !document.querySelector('#start')?.disabled, null, { timeout: 15000 }).catch(() => {});
await page.evaluate(async () => { window.nightTest = await import('/src/night.js'); });
await page.locator('#start').click();
// Pick the relic hunter.
await page.locator('[data-hunter="relic"]').first().click();
await page.waitForTimeout(400);
const picked = await page.evaluate(() => ({ kind: window.nightTest.stage.kind, name: window.nightTest.stage.player.name }));
console.log('PICK', JSON.stringify(picked));
await page.screenshot({ path: 'output/night-hunters/relic-pick.png' });
// Walk west into the breach.
await page.keyboard.down('a');
await page.waitForFunction(() => window.nightTest.stage.atBreach, null, { timeout: 9000 }).catch(() => {});
await page.keyboard.up('a');
await page.waitForTimeout(900);
const inRuins = await page.evaluate(() => ({ x: Math.round(window.nightTest.stage.player.x), kind: window.nightTest.stage.kind, vista: !!window.nightTest.stage.vista }));
console.log('RUINS', JSON.stringify(inRuins));
await page.screenshot({ path: 'output/night-hunters/relic-ruins.png' });
// Whip the relay: face the relay, then press L.
await page.keyboard.press('l');
await page.waitForTimeout(500);
await page.keyboard.press('l');
await page.waitForTimeout(900);
const afterWhip = await page.evaluate(() => ({ relay: window.nightTest.stage.relic.relay, powered: window.nightTest.stage.vista.powered }));
console.log('RELAY', JSON.stringify(afterWhip));
await page.screenshot({ path: 'output/night-hunters/relic-relay.png' });
// Walk east back out to the city; kind should restore.
await page.keyboard.down('d');
await page.waitForFunction(() => !window.nightTest.stage.atBreach, null, { timeout: 9000 }).catch(() => {});
await page.keyboard.up('d');
await page.waitForTimeout(600);
const back = await page.evaluate(() => ({ x: Math.round(window.nightTest.stage.player.x), kind: window.nightTest.stage.kind }));
console.log('BACK', JSON.stringify(back));
console.log('ERR', JSON.stringify(errors));
await browser.close();