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
const modeButton = document.querySelector('#mode');
function modeLabel() {
  return stage.mode === 'versus' ? 'Mode · T (VERSUS P1 vs P2)' : 'Mode · T (P1 vs CPU)';
}
function versusStatus() {
  const foe = stage.mode === 'versus' ? 'P2' : 'DUMMY';
  return `SUPER SMASH COUSINS — ${stage.andy.name} vs ${foe}`;
}
let swapping = false;
try { await stage.load(); status.textContent = versusStatus(); }
catch (error) {
  status.textContent = 'Could not load the fighter. Reload to retry.';
  throw error;
}
swapButton.onclick = async () => {
  if (swapping) return;
  swapping = true;
  player = player === 'andy' ? 'eliseo' : 'andy';
  swapButton.textContent = 'Loading…';
  const next = new SmashStage({ input, width, height, sound, player, mode: stage.mode });
  try {
    await next.load();
    stage = next;
    resize();
    swapButton.textContent = `Swap fighter · C (${player === 'andy' ? 'ANDY' : 'ELISEO'})`;
    modeButton.textContent = modeLabel();
    status.textContent = versusStatus();
  } catch (error) {
    player = player === 'andy' ? 'eliseo' : 'andy';
    swapButton.textContent = `Swap fighter · C (${player === 'andy' ? 'ANDY' : 'ELISEO'})`;
    status.textContent = 'Could not load that fighter.';
  }
  swapping = false;
};
modeButton.onclick = () => {
  stage.setMode(stage.mode === 'versus' ? 'cpu' : 'versus');
  modeButton.textContent = modeLabel();
  status.textContent = versusStatus();
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
  status.textContent = `Rematch! ${stage.andy.name} vs ${stage.mode === 'versus' ? 'P2' : 'DUMMY'}`;
};

new GameLoop({
  update(delta) {
    if (input.consume('Escape')) { location.href = './games.html'; return; }
    if (input.consume('KeyC')) swapButton.click();
    if (input.consume('KeyT')) modeButton.click();
    stage.update(delta, sound.update(delta));
    if (modeButton.textContent !== modeLabel()) modeButton.textContent = modeLabel();
    if (stage.dummy.stocks <= 0 || stage.andy.stocks <= 0) {
      const winner = stage.andy.stocks > 0
        ? (stage.mode === 'versus' ? `P1 · ${stage.andy.name}` : stage.andy.name)
        : (stage.mode === 'versus' ? `P2 · ${stage.dummy.name}` : stage.dummy.name);
      status.textContent = `${winner} WINS! — press Reset match for a rematch`;
    } else if (status.textContent.startsWith('Rematch')) {
      status.textContent = versusStatus();
    } else if (status.textContent.includes('WINS')) {
      status.textContent = versusStatus();
    }
    input.endFrame();
  },
  render(delta) {
    stage.render(ctx, delta);
  },
}).start();
