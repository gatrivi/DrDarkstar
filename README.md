# Dr Darkstar

A small canvas playground: move an invisible animated character through rain. Drops pass through the current frame, sample its RGBA pixels, and slow down in bright areas. The whole interior emerges through colored particles; the sprite itself stays hidden unless you reveal its mask. `examplerain.png` is the visual reference.

**Aim 1:** use particle texture, restrained glow, and short-lived light persistence to make simple sprite art feel richer, inspired by CRT-era games. Keep character details and animation readable. [Old-project video contact sheets and design notes](archive/video-reference/README.md).

## Run

Requires Node.js. No dependencies; local development serves the source directly.

```sh
node server.mjs
```

Open http://localhost:8080.

`npm run build` copies the three games and their required assets into `dist/`. `vercel.json` selects this static output and skips dependency installation. Push to `main` to use the existing Vercel Git autodeploy. To preview the build locally, run `node server.mjs dist` after stopping the source server (or set `PORT` to another port).

### Night Hunters — third demo

Open [Night Hunters](http://localhost:8080/night.html), or choose **003 / Night Shift** in [Game select](http://localhost:8080/games.html).

Play Blade or Deckard against six vampires and replicants in two waves. The clip's generated city and character art use Dr Darkstar's actual `CollisionRain` renderer, with movement, double-jumps, dashes, rolls, and damage-scaled knockback reused from Super Smash Cousins. Each hunter has three lives; enemies fight back with telegraphed claw attacks and projectiles.

- **A/D or arrows:** move; double-tap to dash. **Space/W:** double-jump. **S:** fast-fall.
- **J:** Blade's sword / Deckard's blaster. **Hold K, release:** charged sword / charged shot.
- **L:** spinning shuriken / blaster. **Hold E:** sword block / forearm shield. Face the incoming attack; release E to recover guard. Exhausted guard briefly breaks.
- **Shift:** dodge roll. **C:** switch hunter, preserving position, damage, lives, and guard.
- **P:** pause/resume. **Esc:** game select. On-screen controls support touch.
- **World Rain:** toggle the entire scene's particle rendering. Buildings, hunters, shields, weapons, reflections, and impacts feed the shared pixel rain sampler. Enabled by default; turning it off restores the original city with particle bodies. **Sound:** synthesized atmosphere and combat effects.

`node --test tests/night.test.mjs tests/smash.test.mjs tests/rain.test.mjs` checks combat and the shared rain/Smash behavior. `node tests/night-browser.mjs` checks the playable encounter and responsive controls; its local browser paths can be overridden with `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. Browser screenshots and results are saved under `output/night-hunters/`.

The original atlas has four main poses per character; a second generated atlas adds three shuriken-throw cels and three guard cels for each hunter. Walking uses derived step frames. This is a single-player fan-art demo. `node tests/night-effects-browser.mjs` captures the new poses and checks pause/rendering behavior and frame rates.

## Controls

- A/D or left/right: move and run; drag the canvas to reposition
- W / up or Jump: jump and return to the starting height
- Shift or Roll: roll forward
- Shift during a jump, or Jump-roll: tumble through the existing jump arc and land normally
- E / Shield: show the shield artwork for 1.2 seconds
- Autoattack: optional repeated casting every 1.5 seconds while idle; movement and other actions take priority. Off by default.
- Preview selector: loop standing, running, jump poses, rolling, or casting without moving
- M / Reveal mask: inspect collision geometry
- Stop animation / Animate sprite: toggle the four-pose preview; movement still animates
- R: fresh rain and reset contact count
- P / Pause: freeze the simulation (music has its own control)
- Load music: play a local audio file. Files stay in your browser.
- Demo music: start/stop a small synthesized loop, without needing a file.
- Space / Pulse SFX: cast, display a red spell from the second sheet, and play an effect that pushes nearby particles outward.
- Rain Lab: tune density, pixel size, trail fade, turn-on smoothing, sprite reveal strength, and drift live. Hide/show the panel without interrupting the simulation; Reset defaults restores the current baseline.

## Audio visualization

`src/audio/AudioField.js` routes music and sound effects through a shared analyser. Bass (40–250 Hz) changes fall speed and streak length; mids (250–2000 Hz) change lateral drift; treble (2–12 kHz) changes particle size and shimmer. Source colors remain recognizable. A separate effects analyser measures the actual SFX waveform to drive local impulses. Silence smoothly returns the field to normal.

Future game audio nodes can connect to `sound.music` or `sound.effects` after `sound.enable()`, using the same AudioContext. No external music-engine code is imported or modified.

## Verification

```sh
node --test tests/rain.test.mjs
```

Tests cover RGBA/mirrored sampling, traversal through the sprite interior, frequency bands at different sample rates, and sound-effect attack/release.

## Sprites

The two original WhatsApp JPEGs now load through `src/game/CapeSprite.js`. Black is keyed out in memory; source files remain intact. Explicit crop rectangles separate irregularly spaced drawings and align them to a shared baseline. Cached 128×144 frames drive the particle sampling.

Provisional mapping: three standing poses, nine running poses, nine rolling poses, three airborne poses borrowed from the run row, and four casting poses. Jumping follows a short arc; rolling moves forward. Three red ring drawings from the second sheet accompany casting. Other effects and the large central drawing are not yet mapped. The user can correct animation ordering after trying the previews. [Extracted animation contact sheet](archive/cape-reference/atlas.png).

Standing now plays 1–2–3–2 at two poses per second; running plays at nine poses per second. White torso mass anchors horizontal alignment while feet share a baseline. Particle source masks crossfade over 100 ms, including transitions between actions. The jump-roll reuses tumble frames without restarting the airborne clock. Shield uses the red ring/blue emblem on the right of the second sheet. Attack and shield are animation/effect previews only: no enemy targeting, damage, or blocking rules yet.

The field uses 10,000 particles in a rectangular sampling window around the actor, plus 1,600 ambient drops. Particles cross transparent space too; only those sampling opaque pixels contribute to the detailed layer. Short particle marks preserve detail. The buffer follows the actor and now decays across pose changes instead of flashing empty. Lower Rain Lab fade values retain marks longer; higher values clear them faster. No source sprite is drawn during normal rendering.

## Recovered material

- `archive/image-rain.js`: previous static-image brightness rain experiment, preserved before rewiring the page.
- `archive/AnimatedSprite.damaged.txt`: exact copy of the damaged working sprite file before repair.

The current page is an interaction study for future small games, with no win/loss rules yet. Inspired by the pixel-rain and canvas experiments from Frankslaboratory.

## Reference pens

- [Frankslaboratory](https://codepen.io/franksLaboratory)
- [Particle field reference](https://codepen.io/franksLaboratory/pen/ZEprPKx): titled "Vanilla JavaScript Particle Smoke". Samples image colors and brightness; brightness affects motion, oscillation, and opacity, while a slowly fading canvas accumulates trails. This variant rises and swirls. Our current study falls, samples animated frames, and uses shorter trails for moving characters.
- [Music reference — for later](https://codepen.io/franksLaboratory/pen/MWEaVNd): supplied by the user; source inspection pending.

Density, brightness-driven opacity, and trail persistence have been tuned against the field reference for animated pixel art. Music-reference adaptation is deferred.
