import { GameLoop } from './engine/GameLoop.js';
import { Input } from './engine/Input.js';
import { AudioField } from './audio/AudioField.js';
import { NightStage } from './game/night/NightStage.js';

const canvas = document.querySelector('#night-game'), ctx = canvas.getContext('2d');
export const input = new Input();
const sound = new AudioField(document.querySelector('#audio'));
export const stage = new NightStage({ input, sound });
const $ = selector => document.querySelector(selector);
const overlay = $('#overlay'), start = $('#start'), status = $('#status');
let soundOn = false, soundChosen = false, nextPad = 0, lastUI = '';
function clearInput() { input.down.clear(); input.pressed.clear(); }
function focusGame() { canvas.focus({ preventScroll: true }); }
async function enableSound() {
  try { await sound.enable(); soundOn = true; sound.mix.gain.value = .38; }
  catch { soundOn = false; }
  updateUI(true);
}
function begin() {
  if (!stage.atlas) return;
  if (stage.state === 'paused') stage.state = 'playing';
  else stage.reset();
  clearInput(); focusGame();
  if (!soundChosen) { soundChosen = true; enableSound(); }
  updateUI(true);
}
function pause() {
  if (stage.state === 'playing') stage.state = 'paused';
  else if (stage.state === 'paused') stage.state = 'playing';
  clearInput(); updateUI(true);
}
function updateUI(force = false) {
  if (!stage.player) return;
  const p = stage.player, signature = [stage.state,p.kind,Math.round(p.percent),p.stocks,stage.stats.kills,stage.wave,stage.worldRainEnabled,soundOn].join(':');
  if (!force && signature === lastUI) return;
  lastUI = signature;
  $('#hunter-name').textContent = p.name;
  $('#hunter-name').style.color = p.color;
  $('#damage').textContent = `${Math.round(p.percent)}%`;
  $('#damage').style.color = p.percent > 95 ? '#ff768b' : '#eff9ff';
  $('#lives').textContent = Array.from({length:Math.max(0,p.stocks)},()=>'●').join(' ');
  $('#lives').setAttribute('aria-label', `${Math.max(0,p.stocks)} lives`);
  $('#kills').textContent = stage.stats.kills;
  $('#wave').textContent = `WAVE 0${stage.wave} / 02`;
  document.querySelectorAll('[data-hunter]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.hunter===p.kind)));
  $('#particles').setAttribute('aria-pressed',String(stage.worldRainEnabled));
  $('#sound').setAttribute('aria-pressed',String(soundOn)); $('#sound').textContent=soundOn?'SOUND ON':'SOUND OFF';
  $('#pause').disabled = !['playing','paused'].includes(stage.state);
  $('#pause').textContent = stage.state === 'paused' ? 'RESUME' : 'PAUSE';
  $('#restart').disabled = !stage.atlas;
  overlay.hidden = stage.state === 'playing';
  $('#choose').hidden = !['ready','won','lost'].includes(stage.state);
  const messages = {
    ready: ['SECTOR 09 / OPEN CASE','The city has<br>two kinds of monsters.','Hunt the vampires. Retire the replicants.<br>Choose a hunter. Clear two waves.','ENTER THE RAIN'],
    paused: ['PATROL / ON HOLD','The city can wait.','Your hunt is paused.<br>Press P or resume when ready.','RESUME HUNT'],
    won: ['CASE CLOSED / 06 RETIRED','The district is clear.','Vampires to ash. Replicants retired.<br>Another night in Los Angeles.','HUNT AGAIN'],
    lost: ['SIGNAL LOST / HUNTER DOWN','The night caught up.','Roll through the red attack warnings.<br>Charge K for a stronger hit.','TRY AGAIN'],
  };
  const message = messages[stage.state];
  if (message) {
    $('#overlay-eyebrow').textContent=message[0]; $('#overlay-title').innerHTML=message[1];
    $('#overlay-copy').innerHTML=message[2];start.textContent=message[3];
  }
  status.textContent = stage.state === 'playing'
    ? `${p.name} · ${p.kind === 'blade' ? 'J sword / L shuriken' : 'J or L blaster'} · E block · ${6-stage.stats.kills} hostiles remaining`
    : stage.state === 'won' ? 'District cleared. All six hostiles defeated.'
    : stage.state === 'lost' ? 'Hunter down. Restart the hunt to try again.'
    : stage.state === 'paused' ? 'Paused. P to resume.' : 'Select Blade or Deckard, then enter the rain.';
}
start.onclick = begin;
$('#restart').onclick = () => { if(stage.atlas){stage.reset();clearInput();focusGame();updateUI(true);} };
$('#pause').onclick = () => { pause(); focusGame(); };
$('#particles').onclick = () => {
  stage.worldRainEnabled=!stage.worldRainEnabled;stage.worldRain?.reset();
  stage.rains.forEach(rain=>{rain.drops=rain.drops.map(()=>rain.makeDrop(true));});
  updateUI(true);focusGame();
};
$('#sound').onclick = async () => {
  soundChosen = true;
  if(soundOn){soundOn=false;sound.mix.gain.value=0;updateUI(true);}else await enableSound();
  focusGame();
};
document.querySelectorAll('[data-hunter]').forEach(button=>button.onclick=()=>{
  if(stage.swap(button.dataset.hunter)){updateUI(true);}
  if(stage.state==='playing')focusGame();
});
document.querySelectorAll('[data-key]').forEach(button=>{
  const release=()=>input.down.delete(button.dataset.key);
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();button.setPointerCapture(event.pointerId);
    if(stage.state!=='playing')return;
    const code=button.dataset.key;if(!input.down.has(code))input.pressed.add(code);input.down.add(code);
  });
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
});
addEventListener('blur',()=>{if(stage.state==='playing'){stage.state='paused';clearInput();updateUI(true);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&stage.state==='playing'){stage.state='paused';clearInput();updateUI(true);}});

export const loop = new GameLoop({
  update(delta) {
    if(input.consume('Escape')){location.href='./games.html';return;}
    if(input.consume('KeyP'))pause();
    if(input.consume('KeyC'))stage.swap();
    if(stage.state!=='playing' && (input.consume('Enter') || input.consume('Space')))begin();
    const levels = sound.update(delta);
    if(soundOn && stage.state==='playing' && sound.context?.currentTime >= nextPad){
      nextPad=sound.context.currentTime+3.8;
      [55,82.4,110,130.81].forEach((hz,i)=>sound.tone(hz,4.2,.027/(1+i*.3),sound.music,'triangle',hz*.998));
    }
    stage.update(delta, levels);
    updateUI();input.endFrame();
  },
  render(){stage.render(ctx);},
});
try {
  await stage.load();start.disabled=false;updateUI(true);loop.start();
} catch(error) {
  status.textContent='The district could not load. Reload to retry.';
  $('#overlay-title').textContent='Connection lost.';
  $('#overlay-copy').textContent=error.message;
  start.textContent='RELOAD DISTRICT';start.disabled=false;start.onclick=()=>location.reload();
  console.error(error);
}
