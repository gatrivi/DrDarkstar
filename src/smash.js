import { GameLoop } from './engine/GameLoop.js';
import { Input } from './engine/Input.js';
import { AudioField } from './audio/AudioField.js';
import { SmashStage } from './game/smash/SmashStage.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const input = new Input();
const status = document.querySelector('#status');
let width = innerWidth, height = innerHeight;
const sound = new AudioField(document.querySelector('#audio'));
sound.enable().catch(() => {});

let player = 'andy';
let stage = new SmashStage({ input, width, height, sound, player });
const swapButton = document.querySelector('#swap');
let swapping = false;
try { await stage.load(); status.textContent = 'SUPER SMASH COUSINS — ANDY vs DUMMY'; }
catch (error) {
  status.textContent = 'Could not load the fighter. Reload to retry.';
  throw error;
}
swapButton.onclick = async () => {
  if (swapping) return;
  swapping = true;
  player = player === 'andy' ? 'eliseo' : 'andy';
  swapButton.textContent = 'Loading…';
  const next = new SmashStage({ input, width, height, sound, player });
  try {
    await next.load();
    stage = next;
    resize();
    swapButton.textContent = `Swap fighter · C (${player === 'andy' ? 'ANDY' : 'ELISEO'})`;
    status.textContent = `SUPER SMASH COUSINS — ${player === 'andy' ? 'ANDY' : 'ELISEO'} vs DUMMY`;
  } catch (error) {
    player = player === 'andy' ? 'eliseo' : 'andy';
    swapButton.textContent = `Swap fighter · C (${player === 'andy' ? 'ANDY' : 'ELISEO'})`;
    status.textContent = 'Could not load that fighter.';
  }
  swapping = false;
};

function resize() {
  width = innerWidth; height = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * dpr; canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  stage.resize(width, height);
}
addEventListener('resize', resize);
resize();

document.querySelector('#reset').onclick = () => {
  for (const f of [stage.andy, stage.dummy]) {
    f.stocks = 3;
    f.respawn(stage);
  }
  status.textContent = 'Rematch! ANDY vs DUMMY';
};

new GameLoop({
  update(delta) {
    if (input.consume('Escape')) { location.href = './games.html'; return; }
    if (input.consume('KeyC')) swapButton.click();
    stage.update(delta, sound.update(delta));
    if (stage.dummy.stocks <= 0 || stage.andy.stocks <= 0) {
      const winner = stage.andy.stocks > 0 ? stage.andy.name : stage.dummy.name;
      status.textContent = `${winner} WINS! — press Reset match for a rematch`;
    } else if (status.textContent.startsWith('Rematch')) {
      status.textContent = `SUPER SMASH COUSINS — ${stage.andy.name} vs DUMMY`;
    }
    input.endFrame();
  },
  render(delta) {
    stage.render(ctx, delta);
  },
}).start();
