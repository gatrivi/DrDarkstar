import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
// Only this fixed, generated directory may be cleared, regardless of the cwd.
if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== 'dist') {
  throw new Error('Build output must be the project dist directory');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

// Explicit runtime inputs: no local recordings, reference work, or test output.
const entries = [
  'index.html', 'games.html', 'rain.html', 'smash.html', 'night.html', 'lost.html',
  'src', 'andy.jpeg',
  'assets/smash-cousins-thumbnail.png',
  'assets/night-hunters-thumbnail.jpg',
  'assets/rain-studies-thumbnail.png',
  'WhatsApp Image 2026-09-06 at 3.19.01 PM.jpeg',
  'WhatsApp Image 2026-09-06 at 3.19.01 PM (1).jpeg',
  'assets/night-hunters/city.png',
  'assets/night-hunters/sprites.png',
  'assets/night-hunters/throw-guard-v2.png',
  'assets/night-hunters/relic-hunter/relic-hunter-spritesheet-v1.png',
  'assets/lost-area/tileset-v1.png',
  'assets/lost-area/foliage-props-v1.png',
];
for (const entry of entries) {
  const destination = path.join(output, entry);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, entry), destination, { recursive: true });
}
console.log('Built four games and their runtime assets in dist/');
