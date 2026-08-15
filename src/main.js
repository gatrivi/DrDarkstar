import { AssetLoader } from './engine/AssetLoader.js';
import { GameLoop } from './engine/GameLoop.js';
import { Input } from './engine/Input.js';
import { PixelRain } from './effects/PixelRain.js';
import { DrDarkstarGame } from './game/DrDarkstarGame.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const scene = document.createElement('canvas');
const sceneCtx = scene.getContext('2d');
const input = new Input();
const assets = new AssetLoader();
await assets.image('player', './assets/player.png');

let width = 1;
let height = 1;
let dpr = 1;
let paused = false;
let game;
let rain;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, window.innerWidth);
  height = Math.max(1, window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  scene.width = Math.floor(width * dpr);
  scene.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sceneCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  sceneCtx.imageSmoothingEnabled = false;
  game?.resize(width, height);
  rain?.resize(width, height);
}

resize();
game = new DrDarkstarGame({ width, height, input, assets, onStatus: (text) => { status.textContent = text; } });
rain = new PixelRain(width, height, { cell: 5, fade: 0.16, density: 0.46 });
window.addEventListener('resize', resize, { passive: true });

const loop = new GameLoop({
  update(delta) {
    if (input.consume('KeyP')) paused = !paused;
    if (input.consume('KeyR')) status.textContent = `render · ${rain.cycleMode()}`;
    if (!paused) game.update(delta);
    input.endFrame();
  },
  render(delta) {
    sceneCtx.clearRect(0, 0, width, height);
    game.render(sceneCtx);
    rain.render(ctx, scene, paused ? 0 : delta, performance.now());
    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,.42)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#d7e8ff';
      ctx.textAlign = 'center';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('PAUSED', width / 2, height / 2);
    }
  },
});

loop.start();
