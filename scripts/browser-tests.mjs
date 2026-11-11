// npm run test:browser [name...] — runs tests/*-browser.mjs one after another.
// Starts server.mjs if nothing answers on BASE_URL, and stops it afterwards.
// Optional args filter by name: `npm run test:browser -- smash night`.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';
const filters = process.argv.slice(2);
const files = readdirSync('tests')
  .filter((f) => f.endsWith('-browser.mjs'))
  .filter((f) => !filters.length || filters.some((name) => f.includes(name)))
  .sort();

async function serverUp() {
  try { return (await fetch(`${BASE_URL}/games.html`)).ok; } catch { return false; }
}

let server = null;
if (!(await serverUp())) {
  server = spawn(process.execPath, ['server.mjs'], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 100));
  if (!(await serverUp())) { server.kill(); throw new Error(`server.mjs did not come up on ${BASE_URL}`); }
}

const results = [];
for (const file of files) {
  const started = Date.now();
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [`tests/${file}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (exit) => { if (exit) process.stderr.write(`\n--- ${file}\n${output.slice(-4000)}`); resolve(exit); });
  });
  results.push({ file, ok: code === 0, seconds: ((Date.now() - started) / 1000).toFixed(1) });
  console.log(`${code === 0 ? 'PASS' : 'FAIL'}  ${file}  (${results.at(-1).seconds}s)`);
}
server?.kill();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} browser harnesses passed`);
process.exit(failed ? 1 : 0);
