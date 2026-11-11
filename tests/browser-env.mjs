// Shared launcher for the tests/*-browser.mjs harnesses.
// Playwright comes from the local playwright-core devDependency; the browser is
// whatever Chromium-family install exists on this machine (Edge ships with
// Windows). Overrides: PLAYWRIGHT_MODULE (path to a playwright index.mjs),
// CHROMIUM_PATH (browser executable), BASE_URL (default http://127.0.0.1:8080).
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BROWSER_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';

export async function loadChromium() {
  const mod = process.env.PLAYWRIGHT_MODULE
    ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
    : await import('playwright-core');
  return mod.chromium ?? mod.default.chromium;
}

export function browserPath() {
  const found = BROWSER_CANDIDATES.find((path) => existsSync(path));
  if (!found) throw new Error('No Chromium-family browser found; set CHROMIUM_PATH.');
  return found;
}

export async function launchBrowser(options = {}) {
  const chromium = await loadChromium();
  return chromium.launch({ headless: true, executablePath: browserPath(), ...options });
}
