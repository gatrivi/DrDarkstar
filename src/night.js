import { GameLoop } from './engine/GameLoop.js';
import { Input } from './engine/Input.js';
import { AudioField } from './audio/AudioField.js';
import { NightStage } from './game/night/NightStage.js';
import { decodeChallenge, encodeChallenge } from './game/night/Combat.js';

const canvas = document.querySelector('#night-game'), ctx = canvas.getContext('2d');
export const input = new Input();
const sound = new AudioField(document.querySelector('#audio'));
export const stage = new NightStage({ input, sound });
try {
  stage.challenge = decodeChallenge(new URLSearchParams(location.search).get('challenge'));
} catch { stage.challenge = null; }
const $ = selector => document.querySelector(selector);
const overlay = $('#overlay'), start = $('#start'), status = $('#status');
let soundOn = false, soundChosen = false, lastUI = '';
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
  stage.runStart = stage.time;
  stage.waveStart = stage.time;
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
  const p = stage.player, signature = [stage.state,p.kind,Math.round(p.percent),p.stocks,stage.stats.kills,stage.stats.score,stage.wave,stage.worldRainEnabled,soundOn,stage.stats.bounty,stage.layout,stage.lastSummary?.score ?? ''].join(':');
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
  $('#score').textContent = stage.stats.score.toLocaleString('en-US');
  document.querySelectorAll('[data-hunter]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.hunter===p.kind)));
  $('#particles').setAttribute('aria-pressed',String(stage.worldRainEnabled));
  $('#layout').setAttribute('aria-pressed',String(stage.layout==='rooftops'));
  $('#layout').textContent = stage.layout==='rooftops' ? 'STREET' : 'ROOFTOPS';
  $('#sound').setAttribute('aria-pressed',String(soundOn)); $('#sound').textContent=soundOn?'SOUND ON':'SOUND OFF';
  $('#pause').disabled = !['playing','paused'].includes(stage.state);
  $('#pause').textContent = stage.state === 'paused' ? 'RESUME' : 'PAUSE';
  $('#restart').disabled = !stage.atlas;
  overlay.hidden = stage.state === 'playing';
  $('#choose').hidden = !['ready','won','lost'].includes(stage.state);
  $('#bounty-choose').hidden = stage.state !== 'bounty';
  $('#share-row').hidden = !['won','lost'].includes(stage.state);
  start.hidden = stage.state === 'bounty';
  const best = stage.board[0];
  const bestLine = best ? `DISTRICT BEST ${best.score.toLocaleString('en-US')} (${best.hunter})` : 'NO DISTRICT BEST YET — SET ONE';
  const messages = {
    ready: ['SECTOR 09 / OPEN CASE','The city has<br>two kinds of monsters.',`Hunt the vampires. Retire the replicants.<br>Choose a hunter. Clear two waves.<br>${bestLine}.`,'ENTER THE RAIN'],
    paused: ['PATROL / ON HOLD','The city can wait.','Your hunt is paused.<br>Press P or resume when ready.','RESUME HUNT'],
    bounty: ['WAVE 01 CLEAR / NAME YOUR BONUS','Pick your poison.',`Wave 02 reloads with your bounty active.<br>${bestLine}.`,''],
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
    : stage.state === 'won' ? summaryLine(true)
    : stage.state === 'lost' ? summaryLine(false)
    : stage.state === 'bounty' ? 'Wave 01 clear. Pick a bounty to reload the district.'
    : stage.state === 'paused' ? 'Paused. P to resume.' : 'Select Blade or Deckard, then enter the rain.';
}

function summaryLine(won) {
  const s = stage.lastSummary;
  if (!s) return won ? 'District cleared. All six hostiles defeated.' : 'Hunter down. Restart the hunt to try again.';
  let line = `${won ? 'District clear' : 'Hunter down'} · ${s.score.toLocaleString('en-US')} PTS · ${stage.fmtTime(s.time)}`;
  if (s.record) line += ' · ★ NEW DISTRICT BEST';
  if (stage.challenge) {
    const diff = s.score - stage.challenge.target;
    line += diff >= 0 ? ` · BEAT ${stage.challenge.label} BY ${diff.toLocaleString('en-US')}` : ` · ${stage.challenge.label} WINS BY ${(-diff).toLocaleString('en-US')}`;
  }
  return line;
}

function bragText() {
  const s = stage.lastSummary;
  if (!s) return 'NIGHT HUNTERS — no hunt yet.';
  const url = `${location.origin}${location.pathname}`;
  const code = encodeChallenge(s.score, stage.player.name);
  return `NIGHT HUNTERS — ${s.won ? 'CASE CLOSED' : 'SIGNAL LOST'} · ${stage.player.name} scored ${s.score.toLocaleString('en-US')} PTS in ${stage.fmtTime(s.time)} (${s.kills}/6 retired, best combo x${s.bestCombo}). Beat it: ${url}?challenge=${code}`;
}
start.onclick = begin;
document.querySelectorAll('#bounty-choose [data-bounty]').forEach(button=>button.onclick=()=>{
  if(stage.setBounty(button.dataset.bounty)){clearInput();focusGame();updateUI(true);}
});
document.querySelector('#copy-result').onclick = async () => {
  const text = bragText();
  try { await navigator.clipboard.writeText(text); status.textContent = 'Result copied — paste it to talk trash.'; }
  catch { window.prompt('Copy your result:', text); }
  focusGame();
};
document.querySelector('#save-shot').onclick = () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `night-hunters-${stage.lastSummary?.score ?? 0}pts.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  focusGame();
};
$('#restart').onclick = () => { if(stage.atlas){stage.reset();clearInput();focusGame();updateUI(true);} };
$('#pause').onclick = () => { pause(); focusGame(); };
$('#particles').onclick = () => {
  stage.worldRainEnabled=!stage.worldRainEnabled;stage.worldRain?.reset();
  stage.rains.forEach(rain=>{rain.drops=rain.drops.map(()=>rain.makeDrop(true));});
  updateUI(true);focusGame();
};
$('#layout').onclick = () => {
  stage.setLayout(stage.layout==='rooftops' ? 'street' : 'rooftops');
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

// ---------------------------------------------------------------------------
// 16-bit night drive: a minor-key synth arp over a Genesis bass, half-time
// kick. Generations Lost mood, Blade Runner harmony, 1994 hardware manners.
// Steps are 16ths at 116 BPM; the scheduler looks ~0.18s ahead and hands
// absolute start times to AudioField.tone so rhythm survives rAF jitter.
// ---------------------------------------------------------------------------
const CHIP_BPM = 116;
const CHIP_STEP = 60 / CHIP_BPM / 4;
const CHIP_BASS = [0, 0, 3, 7, -2, -2, -4, 3];       // semitones from A1, one per quarter
const CHIP_ARP = [12, 15, 19, 15];                    // minor-triad shape over the bass note
const CHIP_LEAD = [{ step: 0, note: 24 }, { step: 10, note: 27 },
  { step: 16, note: 22 }, { step: 26, note: 19 }, { step: 30, note: 24 }];
const chipHz = (n) => 55 * Math.pow(2, n / 12);       // n=0 -> A1
let chipStep = 0, chipNext = 0;
function chipPump() {
  const ctx = sound.context;
  if (!ctx || !soundOn || stage.state !== 'playing') { chipNext = 0; return; }
  const t = ctx.currentTime;
  if (!chipNext || chipNext < t - 0.4) chipNext = t + 0.06;
  while (chipNext < t + 0.18) {
    chipPlay(chipStep, chipNext);
    chipStep = (chipStep + 1) % 32;
    chipNext += CHIP_STEP;
  }
}
function chipPlay(step, when) {
  const bar = Math.floor(step / 4) % 8;
  const bass = CHIP_BASS[bar];
  // Bass: fat detuned saw on every quarter.
  if (step % 4 === 0) {
    sound.tone(chipHz(bass), .34, .034, sound.music, 'sawtooth', chipHz(bass) * .998, when);
    sound.tone(chipHz(bass) * 2.008, .3, .012, sound.music, 'sawtooth', chipHz(bass) * 2, when);
  }
  // Arp: quiet square 16ths.
  const arp = bass + CHIP_ARP[step % 4];
  sound.tone(chipHz(arp), .1, .013, sound.music, 'square', chipHz(arp), when);
  // Kick on the floor, snare-ish tick on the backbeat.
  if (step % 8 === 0) sound.tone(110, .12, .05, sound.music, 'sine', 42, when);
  if (step % 8 === 4) sound.tone(190, .06, .022, sound.music, 'square', 150, when);
  // Hat ticks every off-8th.
  if (step % 2 === 1) sound.tone(6400, .02, .006, sound.music, 'square', 5200, when);
  // Lead: sparse long notes with a soft detune.
  const lead = CHIP_LEAD.find((l) => l.step === step);
  if (lead) {
    sound.tone(chipHz(lead.note), .5, .018, sound.music, 'triangle', chipHz(lead.note) * .997, when);
    sound.tone(chipHz(lead.note) * 1.004, .5, .01, sound.music, 'triangle', chipHz(lead.note), when + .02);
  }
}

export const loop = new GameLoop({
  update(delta) {
    if(input.consume('Escape')){location.href='./games.html';return;}
    if(input.consume('KeyP'))pause();
    if(input.consume('KeyC'))stage.swap();
    if(input.consume('KeyT')){$('#layout').click();}
    if(stage.state==='bounty'){
      for(const [code,id] of [['Digit1','nightowl'],['Digit2','untouchable'],['Digit3','speedtrap']]){
        if(input.consume(code)&&stage.setBounty(id)){clearInput();focusGame();updateUI(true);break;}
      }
    } else if(stage.state!=='playing' && (input.consume('Enter') || input.consume('Space')))begin();
    const levels = sound.update(delta);
    chipPump();
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
