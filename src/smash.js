import { GameLoop } from './engine/GameLoop.js';
import { Input } from './engine/Input.js';
import { AudioField } from './audio/AudioField.js';
import { SmashStage } from './game/smash/SmashStage.js';
import { P1_BINDINGS, P2_BINDINGS } from './game/smash/AndyFighter.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const input = new Input();
const status = document.querySelector('#status');
let width = innerWidth, height = innerHeight;
const sound = new AudioField(document.querySelector('#audio'));
sound.enable().catch(() => {});
// Autoplay policies suspend audio until a gesture: unlock on first input.
const unlock = () => sound.enable().catch(() => {});
addEventListener('keydown', unlock);
addEventListener('pointerdown', unlock);

let p1Pick = 'andy'; // P1's cousin — cycles with C or the picker.
let cpuPick = null;  // explicit foe pick; null = auto (always a different cousin)
let paused = false;
let stage = new SmashStage({ input, width, height, sound, player: p1Pick });
const swapButton = document.querySelector('#swap');
const p1Select = document.querySelector('#p1Pick');
const foeSelect = document.querySelector('#foePick');
const foeRole = document.querySelector('#foeRole');
const modeButton = document.querySelector('#mode');
const musicButton = document.querySelector('#music');
const pauseButton = document.querySelector('#pause');
const rainButton = document.querySelector('#rain');
// World rain: the whole stage — city, slab, fighters — rendered through the
// full-world pixel rain field (the Night Hunters technique).
function rainLabel() {
  return `World rain · N (${stage.worldRainEnabled ? 'ON' : 'OFF'})`;
}
function toggleRain() {
  stage.toggleWorldRain();
  rainButton.textContent = rainLabel();
}
rainButton.onclick = toggleRain;
function pauseLabel() {
  return paused ? 'Resume · P' : 'Pause · P';
}
function togglePause() {
  paused = !paused;
  pauseButton.textContent = pauseLabel();
}
pauseButton.onclick = togglePause;
function modeLabel() {
  return stage.mode === 'versus' ? 'Mode · T (VERSUS P1 vs P2)' : 'Mode · T (P1 vs CPU)';
}
function versusStatus() {
  const foe = stage.mode === 'versus' ? `P2 · ${stage.dummy.name}` : `CPU · ${stage.dummy.name}`;
  return `SUPER SMASH COUSINS — ${stage.andy.name} vs ${foe}`;
}
let swapping = false;
try { await stage.load(); status.textContent = versusStatus(); syncPickers(); }
catch (error) {
  status.textContent = 'Could not load the fighter. Reload to retry.';
  throw error;
}
// P1 cycles all three cousins: Andy → Eliseo → Simon. The foe picker decides
// the other side; an auto re-roll kicks in whenever a lineup would mirror P1.
const SWAP_ORDER = ['andy', 'eliseo', 'simon'];
function syncPickers() {
  p1Select.value = p1Pick;
  cpuPick = stage.foe; // an auto-resolved foe becomes concrete once built
  foeSelect.value = cpuPick;
  foeRole.textContent = stage.mode === 'versus' ? 'P2' : 'CPU';
  swapButton.textContent = `Swap fighter · C (${p1Pick.toUpperCase()})`;
  modeButton.textContent = modeLabel();
  rainButton.textContent = rainLabel();
}
async function buildStage(candidateP1, candidateFoe) {
  if (swapping) return;
  swapping = true;
  swapButton.textContent = 'Loading…';
  const next = new SmashStage({ input, width, height, sound, player: candidateP1, foe: candidateFoe, mode: stage.mode });
  try {
    await next.load();
    stage = next;
    p1Pick = candidateP1;
    resize();
    status.textContent = versusStatus();
  } catch (error) {
    status.textContent = 'Could not load that fighter.';
  }
  swapping = false;
  syncPickers();
}
function cycleP1() {
  const next = SWAP_ORDER[(SWAP_ORDER.indexOf(p1Pick) + 1) % SWAP_ORDER.length];
  buildStage(next, cpuPick === next ? null : cpuPick);
}
swapButton.onclick = cycleP1;
p1Select.onchange = () => {
  p1Select.blur(); // hand arrow keys / WASD back to the game
  buildStage(p1Select.value, cpuPick === p1Select.value ? null : cpuPick);
};
foeSelect.onchange = () => {
  foeSelect.blur();
  if (foeSelect.value === p1Pick) { foeSelect.value = stage.foe; return; } // one cousin per side
  buildStage(p1Pick, foeSelect.value);
};
modeButton.onclick = () => {
  stage.setMode(stage.mode === 'versus' ? 'cpu' : 'versus');
  modeButton.textContent = modeLabel();
  foeRole.textContent = stage.mode === 'versus' ? 'P2' : 'CPU';
  status.textContent = versusStatus();
};
function musicLabel() {
  return sound.demoTimer !== null ? 'Music · M (on)' : 'Music · M (off)';
}
async function toggleMusic() {
  try {
    await sound.enable();
    if (sound.demoTimer !== null) sound.stopDemo();
    else await sound.startDemo();
  } catch { /* audio is decorative */ }
  musicButton.textContent = musicLabel();
}
musicButton.onclick = toggleMusic;

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
    f.celebrating = false;
    f.respawn(stage);
  }
  status.textContent = `Rematch! ${stage.andy.name} vs ${stage.dummy.name}`;
};

// Remappable controls: the fighters read P1_BINDINGS / P2_BINDINGS by
// reference every frame, so mutating them in place rebinds live. Chosen keys
// persist in localStorage and are re-applied on boot.
const ACTIONS = [['left', 'Move left'], ['right', 'Move right'], ['jump', 'Jump'],
  ['shield', 'Shield / crouch'], ['jab', 'Attack'], ['tilt', 'Tilt'],
  ['smash', 'Smash (hold)'], ['roll', 'Dodge']];
const SYSTEM_CODES = ['Escape', 'KeyC', 'KeyT', 'KeyM', 'KeyN', 'KeyB', 'KeyH',
  'KeyI', 'KeyO', 'KeyP', 'KeyR', 'KeyU'];
const PAD_STORE = 'smash-cousins-controls-v1';
const DEFAULT_BINDINGS = {
  p1: JSON.parse(JSON.stringify(P1_BINDINGS)),
  p2: JSON.parse(JSON.stringify(P2_BINDINGS)),
};
const padPanel = document.querySelector('#padPanel');
const padRows = { p1: {}, p2: {} };
let listening = null;  // { player, action } while waiting for a new key
let padWasPaused = false;

function padBindings(player) {
  return player === 'p1' ? P1_BINDINGS : P2_BINDINGS;
}
function syncAlias(player) {
  const b = padBindings(player);
  b.up = [...b.jump];
  b.down = [...b.shield];
}
function keyLabel(code) {
  const named = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    Comma: ',', Period: '.', Slash: '/', Quote: "'", Semicolon: ';', Backslash: '\\',
    BracketLeft: '[', BracketRight: ']', Space: 'Space', Enter: 'Enter', Tab: 'Tab' };
  if (named[code]) return named[code];
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num');
}
function saveBindings() {
  const pickActions = (b) => Object.fromEntries(ACTIONS.map(([action]) => [action, [...b[action]]]));
  try {
    localStorage.setItem(PAD_STORE, JSON.stringify({ p1: pickActions(P1_BINDINGS), p2: pickActions(P2_BINDINGS) }));
  } catch { /* storage unavailable — remaps just won't persist */ }
}
function loadBindings() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(PAD_STORE)); } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return;
  for (const player of ['p1', 'p2']) {
    const b = padBindings(player);
    for (const [action] of ACTIONS) {
      const codes = saved[player]?.[action];
      if (Array.isArray(codes) && codes.length && codes.every((c) => typeof c === 'string')) {
        b[action] = [...codes];
      }
    }
    syncAlias(player);
  }
}
function refreshPadKeys() {
  for (const player of ['p1', 'p2']) {
    for (const [action] of ACTIONS) {
      padRows[player][action].textContent = keyLabel(padBindings(player)[action][0] ?? '—');
    }
  }
}
function cancelListening() {
  if (!listening) return;
  padRows[listening.player][listening.action].classList.remove('listening');
  listening = null;
}
function startListening(player, action, key) {
  cancelListening();
  listening = { player, action };
  key.classList.add('listening');
  key.textContent = 'press a key…';
  key.blur(); // the capture listener below handles the next press wherever it lands
}
function buildPad() {
  for (const player of ['p1', 'p2']) {
    const column = document.querySelector(player === 'p1' ? '#padP1' : '#padP2');
    for (const [action, label] of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'pad-row';
      const name = document.createElement('span');
      name.textContent = label;
      const key = document.createElement('button');
      key.className = 'pad-key';
      key.title = 'Click, then press the new key';
      key.textContent = keyLabel(padBindings(player)[action][0] ?? '—');
      key.onclick = () => startListening(player, action, key);
      row.append(name, key);
      column.append(row);
      padRows[player][action] = key;
    }
  }
}
// Capture phase: runs before the game's Input listener, so the key being
// recorded never leaks into the fight.
window.addEventListener('keydown', (event) => {
  if (!listening || event.repeat) return;
  event.preventDefault();
  event.stopPropagation();
  const code = event.code;
  const { player, action } = listening;
  const rowKey = padRows[player][action];
  cancelListening();
  if (code === 'Escape') {
    refreshPadKeys();
    return;
  }
  const taken = SYSTEM_CODES.includes(code) || ['p1', 'p2'].some((p) =>
    ACTIONS.some(([a]) => (p !== player || a !== action) && padBindings(p)[a]?.includes(code)));
  if (taken) {
    rowKey.classList.add('taken');
    rowKey.textContent = 'in use';
    setTimeout(() => {
      rowKey.classList.remove('taken');
      if (!listening || padRows[listening.player][listening.action] !== rowKey) {
        rowKey.textContent = keyLabel(padBindings(player)[action][0] ?? '—');
      }
    }, 900);
    return;
  }
  padBindings(player)[action] = [code];
  syncAlias(player);
  saveBindings();
  refreshPadKeys();
}, true);
window.addEventListener('pointerdown', (event) => {
  if (listening && !event.target.closest?.('.pad-key')) cancelListening();
}, true);
function togglePad(force) {
  const show = force ?? padPanel.hidden;
  const isOpen = !padPanel.hidden;
  if (show === isOpen) return; // already in the requested state
  padPanel.hidden = !show;
  cancelListening();
  if (show) {
    padWasPaused = paused;
    paused = true;
  } else {
    paused = padWasPaused;
  }
  pauseButton.textContent = pauseLabel();
}
document.querySelector('#padOpen').onclick = (event) => {
  event.currentTarget.blur();
  togglePad(true);
};
document.querySelector('#padClose').onclick = () => togglePad(false);
document.querySelector('#padReset').onclick = () => {
  for (const player of ['p1', 'p2']) {
    const b = padBindings(player);
    for (const [action] of ACTIONS) b[action] = [...DEFAULT_BINDINGS[player][action]];
    syncAlias(player);
  }
  saveBindings();
  refreshPadKeys();
};
loadBindings();
buildPad();

new GameLoop({
  update(delta) {
    if (input.consume('Escape')) { location.href = './games.html'; return; }
    if (input.consume('KeyC')) swapButton.click();
    if (input.consume('KeyT')) modeButton.click();
    if (input.consume('KeyM')) toggleMusic();
    if (input.consume('KeyN')) toggleRain();
    if (input.consume('KeyB')) stage.cycleBackdrop();
    if (input.consume('KeyH')) stage.debug = !stage.debug;
    if (input.consume('KeyR')) {
      for (const f of [stage.andy, stage.dummy]) f.percent = 0;
      stage.popup(stage.width / 2, stage.height * 0.3, 'DAMAGE RESET', '#9adcff');
    }
    if (input.consume('KeyP')) togglePause();
    if (input.consume('KeyO')) togglePad();
    if (!paused) {
      stage.update(delta, sound.update(delta));
      if (modeButton.textContent !== modeLabel()) modeButton.textContent = modeLabel();
    if (stage.dummy.stocks <= 0 || stage.andy.stocks <= 0) {
      const winner = stage.andy.stocks > 0 ? stage.andy : stage.dummy;
      winner.celebrating = true;
      const winnerName = stage.andy.stocks > 0
        ? (stage.mode === 'versus' ? `P1 · ${stage.andy.name}` : stage.andy.name)
        : (stage.mode === 'versus' ? `P2 · ${stage.dummy.name}` : stage.dummy.name);
      status.textContent = `${winnerName} WINS! — press Reset match for a rematch`;
    } else if (status.textContent.startsWith('Rematch')) {
        status.textContent = versusStatus();
      } else if (status.textContent.includes('WINS')) {
        status.textContent = versusStatus();
      }
    }
    input.endFrame();
  },
  render(delta) {
    stage.render(ctx, delta);
    if (paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 4, 10, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#eafcff';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', width / 2, height / 2 - 10);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#8aa7b5';
      ctx.fillText('P to resume · H hitboxes · R reset damage · M music', width / 2, height / 2 + 22);
      ctx.restore();
    }
  },
}).start();

// Live binding for headless probes/tests (same pattern as src/night.js).
export { stage };
