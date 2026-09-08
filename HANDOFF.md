# Dr Darkstar handoff — 2026-09-06

## Intent and scope

User wants a series of small games inspired by Frankslaboratory pixel rain and music visualization. A hidden animated sprite is sampled by particles passing through its entire interior; its source image is not normally rendered. Brightness changes particle motion and color reveals the art.

Aim 1: make limited sprite art feel richer through texture, glow, and temporal persistence, inspired by CRT-era console games. Target readable, modest Game Boy-level animation with the current drawings. User approved the improvements and wanted a small stopping point, not a major combat/game expansion. Be laconic; continue authorized work without repeated confirmation.

## Run and state

- Plain browser JavaScript and Canvas 2D; no React, dependencies, or build step.
- `node server.mjs` serves http://localhost:8080 on loopback. Check whether it is already running before starting it.
- Worktree is dirty, with source modifications and untracked assets/tests/archive. No commit or deployment was made. Preserve all of it.
- Original JPEGs and videos are intact. Damaged earlier sprite source and old image-rain implementation are preserved under `archive/`.

## Current implementation

- `src/game/CapeSprite.js`: active character, extends the sampling helpers in `AnimatedSprite.js`. Loads both WhatsApp JPEG sheets from the root, removes near-black background in memory, crops irregularly spaced poses, and caches 128×144 masks.
- Idle uses three poses in order 1–2–3–2, holding each for 0.5 seconds. Run is nine poses at 9 fps; roll is nine at 13 fps. Jump borrows three inferred airborne poses; ordering is provisional.
- Frame alignment uses white torso mass horizontally and a common bottom baseline. Masks crossfade over 100 ms with premultiplied-alpha color blending. The particle buffer persists across pose changes.
- Jump uses a 0.85-second arc. Roll during jumping changes to airroll without restarting the flight clock. Jump-roll button starts both from the ground.
- Casting combines four character poses with three red ring crops from the second sheet. Shield uses the large red ring/blue emblem on that sheet's right side and lasts 1.2 seconds.
- Autoattack is off by default; when enabled, repeats casting roughly every 1.5 seconds while idle, yielding to movement and other actions. Simulation pause stops its clock.
- Attack/shield are visual previews only. There are no enemies, targeting, damage, blocking, or win/loss rules.
- `src/effects/CollisionRain.js`: 10,000 focused particles in an actor-following rectangle plus 1,600 ambient drops. Focused particles renew throughout the rectangle to avoid starving lower body pixels. Bright areas slow particles, not block them.
- `src/main.js`: gameplay/UI wiring and offscreen detail accumulation. Drag repositions the character. Rain Lab edits properties live. Its collapse button remains accessible when collapsed.
- `src/audio/AudioField.js`: music and SFX analysis; bass controls fall speed, mids drift, treble shimmer. Separate SFX analysis produces local disturbance. Local audio picker and synthesized demo work.

## Controls

- A/D or left/right: run; canvas drag: reposition.
- W/up: jump. Shift: roll, or aerial roll while jumping.
- Jump-roll button: start an aerial tumble directly.
- Space / Pulse SFX: cast with sound. E / Shield: temporary shield preview.
- Autoattack toggle: repeat idle casting.
- Preview selector: loop individual poses, including airroll and shield. This previews artwork; use action buttons/keys for actual jump movement.
- Stop animation pauses automatic pose cycling, but movement/actions still animate.
- M: reveal collision mask. P: pause simulation. R: reset rain.
- Rain Lab: density, size, fade rate, turn-on smoothing rate, reveal intensity, drift, reset defaults.

Important UI explanation: LOWER fade means longer persistence; higher fade erases faster. LOWER turn-on smoothing rate makes illumination emerge more slowly. A previous chat answer incorrectly advised raising fade for longer persistence; README now states the correct direction.

## References and assets

- Root character sheet: `WhatsApp Image 2026-09-06 at 3.19.01 PM.jpeg`.
- Root effects sheet: `WhatsApp Image 2026-09-06 at 3.19.01 PM (1).jpeg`.
- `examplerain.png`: desired detailed particle-image appearance.
- https://codepen.io/franksLaboratory/pen/ZEprPKx — inspected; titled Particle Smoke, uses brightness/color sampling and long trails. This variant rises/swirls; ours falls.
- https://codepen.io/franksLaboratory/pen/MWEaVNd — user supplied music reference for later; not yet inspected successfully or adapted.
- Four root MP4 recordings of old project. Six timestamped frames per video extracted into `archive/video-reference/`; README there records Aim 1. Camera/monitor striping is not necessarily intentional game rendering.
- `archive/cape-reference/atlas.png`: extracted, aligned animation poses; rain/mobile/shield PNGs are verification captures.
- Catharmonimundi music engine was not located under the REACTJS parent. User was asked for its path. Cathedral's cosmic-resonator was inspected read-only but is not confirmed to be that engine; no external project was changed. Integration remains deferred.

## Verification last completed

- `node --test tests/rain.test.mjs`: 8 passing tests, including background keying, mirrored sampling, traversal, audio analysis, animation-mask caching, and correct crossfade color/alpha.
- `node tests/cape-browser.mjs`: passed after the latest changes. Checks idle hold/advance, jump-to-roll flight continuity, landing, shield expiry, all preview choices, autoattack UI, nonempty frame masks, and desktop/mobile screenshots. No browser page errors.
- `git diff --check`: passed (only Windows LF/CRLF notices).
- Browser test/extractor use machine-specific cached Playwright and installed Chrome paths. They may require sandbox escalation. Do not install dependencies unnecessarily.

## Remaining limitations / sensible next work

1. Let the user judge the latest slower, blended animation before further tuning. Frame identities/order remain inferred, especially jump.
2. Blending improves continuity but does not invent intermediate anatomy; long rain persistence can still produce ghost limbs. Dedicated bloom is not implemented.
3. Most spell art and the large central drawing on the second sheet remain unmapped. Don't expand combat unless requested.
4. Rain Lab settings aren't persisted between reloads. Fade range step is 0.1 while default code/output is 3.08, so the native range rounds its initial position slightly; low-impact cleanup opportunity.
5. Keep originals and useful contact sheets; don't overwrite user art or clean the dirty worktree.
