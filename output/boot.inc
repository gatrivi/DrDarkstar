import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'C:/Users/DevTrivi/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = process.env.NIGHT_CDP
  ? await chromium.connectOverCDP(process.env.NIGHT_CDP)
  : await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM_PATH || 'C:/Users/DevTrivi/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
const context = browser.contexts()[0] || await browser.newContext();
const page = context.pages()[0] || await context.newPage();
const errors = [], failedResources = [];
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)failedResources.push(`${response.status()} ${response.url()}`);});
await mkdir('output/night-hunters',{recursive:true});
try {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:8080'}/games.html`);
  await page.getByRole('link',{name:/003.*NIGHT SHIFT/}).click();
  await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await page.screenshot({path:'output/night-hunters/briefing.png',fullPage:true});
  await page.evaluate(async()=>{ window.nightTest = await import('/src/night.js'); });
