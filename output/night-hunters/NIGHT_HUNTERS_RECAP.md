# Night Hunters — Uptown Sanctuary, Esper Photo Mode, Noodle Bar, Canteen

Recap for developers. Branch: `smash-cousins-demo` (merged to `main`).

## Feature summary

Night Hunters now opens into a **chill "uptown" sanctuary** instead of instant combat.
The hunt is opt-in: walk right past the **SECTOR 10 gate** to start it.

### 1. Uptown / Downtown zones
- `src/game/night/ZenZone.js` (new): zone geometry (uptown = left side, gate at x=640),
  gate visuals (pulsing red neon + scanline barrier), zen-hour ambience control.
- `src/night.js`: new `strolling` state. No enemies spawn while left of the gate;
  crossing it transitions to `playing` and starts wave 1 (downtown only).
- Hostile AI never pursues past the gate — retreating to uptown is safe.
- HUD swaps: uptown shows "UPTOWN / photo tips"; hunting shows score/wave counters.
- Mobile thumb pads work in strolling state.

### 2. Rain is the star (zen-hour ambience)
- Uptown damps `AudioField` levels by ~50%, so both the world rain and the
  ambient pixel rain visibly soften. Crossing the gate restores the full storm.
- `src/game/night/NightStage.js` ties rain intensity to audio levels each frame
  via `stage.update(..., sound.update())` — rain breathes with the track.

### 3. Generations Lost soundtrack split (`src/night.js`)
- `chipPlay('uptown')`: minor arp/bass/lead at half gain, no kick/hats, half-time arpeggio.
- `chipPlay('downtown')`: full 116 BPM beat returns. Zone crossings swap states.

### 4. Esper photo mode (canon: Deckard's Esper)
- **F** snaps a photo (grabs the live scene canvas) into a 6-shot film strip
  (bottom-right HUD), shutter flash + randomized Blade Runner log lines.
- **G** opens the viewer: phosphor-green scanlines, reticle, arrows/WASD to pan,
  Q/E or mouse wheel to zoom (1.2x–6x), G closes.
- Photos are session-only (not persisted).

### 5. Noodle bar
- Pixel-art stall in uptown: flickering NOODLES neon, warm window light, steam
  curls, light pool on the wet street.
- Standing in it: "TWO, PLEASE" toast, guard regen + slow damage recovery
  (works even mid-hunt — reason to run back across the gate to heal).

### 6. Canteen interior (glass rain)
- `src/game/night/Canteen.js` (new): interior extension of the noodle stall.
  Press **F** at the stall to enter. Full-screen world rain is replaced by
  **raindrops sliding down the window glass** (droplet trails with gravity jitter
  and merge-on-contact on a glass layer), warm interior grade, muffled audio.
  Press **F** again to step back into the rain.

## Files touched
- New: `src/game/night/ZenZone.js`, `src/game/night/Canteen.js`
- Modified: `src/game/night/NightStage.js` (zones, gate, capture, film strip,
  viewer, canteen wiring, zen rain damping), `src/night.js` (states, input F/G,
  soundtrack split, HUD/briefing copy)
- Tests: `tests/night.test.mjs` (zone geometry, gate state machine, photo cap,
  canteen glass), `tests/night-browser.mjs`, `tests/night-effects-browser.mjs`

## Verification (all green)
- `npm test`: 52/52 pass
- `node tests/night-browser.mjs`: 70+ checks pass (stroll, photo, viewer,
  gate-crossing, canteen glass) — needs `node server.mjs` running
- `node tests/night-effects-browser.mjs`: 60 FPS in both rain modes
- `npm run build`: builds four games + assets into `dist/`
- Screenshots: `output/night-hunters/{stroll-noodle,stroll-gate,esper-viewer,
  hunt-start,canteen-glass}.png`

## Key controls
| Key | Action |
| --- | --- |
| F | Snap photo / enter-exit canteen at stall |
| G | Open/close Esper viewer |
| Arrows/WASD + Q/E (in viewer) | Pan / zoom |
| Walk right past red gate | Start hunting |

## Notes / gotchas
- Film strip caps at 6 shots (oldest dropped) — enforced by test.
- Enemies must never spawn/pursue left of gate x — enforced by test.
- Rain damping is driven off `AudioField` levels; keep that coupling if you
  touch `ZenZone` or the soundtrack.
