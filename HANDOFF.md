# Dr Darkstar handoff — 2026-11-11

## Added 2026-11-11: test tooling (branch `smash-cousins-demo`)

`npm run test:browser` / `test:all` run every browser harness with no setup (shared launcher `tests/browser-env.mjs`, `playwright-core` devDependency, installed Edge/Chrome). New `tests/smash-browser.mjs` (29 checks). `AGENTS.md` now carries the file map, commands and rules. The sections below the dated log were refreshed to match the code.

## Added 2026-10-20 — bug-fix pass (branch `smash-cousins-demo`)

**Root Archive:** the pillars added in `0fa97c8` were solid walls (level unbeatable). They are now climbable (hold W/↑/JUMP; S down; sideways lets go; tops are one-way perches) and stop above the floor. The new walkways are one-way, the passable pipes render faded, and the Skyline/Data Lair memories moved to reachable perches (5 total). **Night Hunters:** the breach no longer teleports to x=868 (past the Sector gate, which started the hunt inside the ruins). The archive is walked west→east and `RUINS_EXIT_X` 880 returns you to the street at `RUINS_RETURN_X`. The gate is ignored while in ruins. **Smash:** blur clicked buttons and let the toolbar pass game keys through (`data-game-keys` in `Input`), so keys no longer die after a click or type into pickers. Last-stock KO stays out until Reset. Camera frames the slab above the toolbar, and the toolbar and help sit in one `.dock`. Up-moves hit adjacent foes and launch away from the attacker. P2 join uses remapped keys. 3-frame jump-squat (`JUMP_SQUAT`) so W→J / W→K give up-tilt / up-smash. Landing requires crossing the slab from above (no teleport from under the stage), with a re-snap on resize. Auto-pause on blur. Browser tests take `PLAYWRIGHT_MODULE` / `CHROMIUM_PATH` (the cached npx Playwright is gone; `playwright-core` + Edge works). Reset match puts the fighters back at opposite sides (it used to stack them at center). **Rain:** clicked buttons, the preview picker and the file picker release focus, so A/D/Space keep driving the actor (Space used to re-click the button).

## Added 2026-09-13 — Night Hunters: demo level, ducking, share pack (branch `smash-cousins-demo`)

**Crouch (S / DUCK):** hold Down on the ground to duck under level bolts; the hurtbox drops from 96px to 54px and the sprite squashes. Replicant bolts now **aim at the chest line with a ±0.42 rad clamp** (`aimShot` in `Combat.js`), so ducking beats a shot already in flight, and ledges turn shots into rising arcs you beat by jumping or dropping off. Replicants keep distance; vampires now **leap after hunters standing on ledges**. **Rooftops demo layout**: `T` or the ROOFTOPS toolbar button swaps in five one-way ledges (tuned so 366 is a single jump, 236 a double-jump perch). Landing support lives in `NightFighter.physics` via `stage.surfaces`; the shared fighter file is untouched, so Smash physics stay identical. Projectile sweep is now 2D; angled bolts draw along their flight path. **Phone landscape** (`orientation:landscape and max-height:560px`) goes full-width with floating thumb controls over the lower canvas, menu overlays hide the pads, and `DUCK` was added to the touch row. **Chiptune**: a 16th-note scheduler (116 BPM, A-minor arp + Genesis bass + half-time kick, `AudioField.tone(..., when)` gains absolute `AudioContext` start times) replaces the old pad loop. Verify: `npm test` 46 passing (aim/sweep/crouch/rooftop tests), `tests/night-browser.mjs` 65 checks 0 errors (duck + ledge landing + pass-through), effects harness clean. Screenshots: `output/night-hunters/rooftops-demo.png`, `landscape-briefing.png`, `landscape-duck.png`.

## Added 2026-09-12 — Smash Cousins melee demo (branch `smash-cousins-demo`)

Melee-inspired kit for both cousins (inspiration only, arcade-tuned): neutral **jab**, directional **tilts** (f/up/down via J+dir or L+dir), chargeable **smashes** (f/up/down via hold-K, down-smash hits both sides, up moves hit above), **shield** bubble (60HP, 0.7x damage, drain/regen, shieldstun, pushback, break → dizzy), and **rolls** (directional, invulnerable) + neutral **spot dodge** + **air dodge**. P1 (WASD + J/L/K/S/Shift) vs CPU dummy with a full-kit AI (chase, jab/tilt/smother, charged smashes, reactive shields/rolls), or local **versus**: press any P2 key (arrows + `,.⁄` + RightShift, T toggles) to join. Shield bubbles, charge auras, directional slash arcs, roll afterimages, combat popups (HIT/BLOCK/DODGE/BREAK), shield + charge bars in the HUD, new procedural SFX (shieldHit/shieldBreak/dodge/spot). Night Hunters untouched behaviorally (legacy fallbacks: L=serve, K=golfswing, neutral-Shift roll, no S-shield). Verify: `npm test` 34 passing; headless harness 24/24 combat checks; Edge headless screenshot renders with zero console errors.

## Added 2026-09-12 — Night Hunters

Latest expansion: **L throws Blade's spinning shuriken**, with new windup/release/follow-through frames. **Hold E blocks**: Blade parries with his sword; Deckard raises a forearm shield. Guard protects the front, drains while held/hit, recovers on release, and breaks at zero. Switching retains guard. New atlas: `assets/night-hunters/throw-guard-v2.png` (frames 6–8 throw, 9–11 guard; prompts adjacent).

**World Rain** is on by default. `src/game/night/WorldRain.js` adapts a full offscreen scene to the shared `CollisionRain` engine: 12k full-world drops plus 5.7k local character drops, a shared color palette, half-resolution RGBA particle rasterization, and a faint source silhouette. `ProjectileRain.js` samples rotating shurikens in compact focused streams. City, sprites, shields, shots, and impacts all contribute; combat labels remain clear. Toggle off for the original look and original character density. `tests/night-effects-browser.mjs` captures the added effects and records frame-rate measurements in `output/night-hunters/effects-verification.json`.

- Third game: `night.html`, linked first in `games.html` as **003 / Night Shift**. Existing home redirect and other games retain their current behavior.
- `src/night.js` / `src/night.css` provide the responsive UI, character selection, sound, keyboard/touch input, pause, restart, and win/loss screens.
- `src/game/night/`: `NightFighter` extends Cousins' `AndyFighter` for its physics and movement controls; `Combat.js` uses the shared Smash knockback function; `NightStage` uses Dr Darkstar's `CollisionRain` for each fighter. `Atlas.js` normalizes the clip's sixteen irregular sprite cels and mirrors enemy art.
- Assets are copied into `assets/night-hunters/`. Clip originals and prompts remain in `output/blade-runner-genesis/`.
- Blade: J sword, K charged slash, L silver glaive. Deckard: J/L blaster, K charged shot. Both: A/D move, Space/W double-jump, double-tap dash, Shift invulnerable roll, S fast-fall, C switch preserving damage/lives, P pause, Esc game select.
- Two waves of three vampires/replicants. Damage increases knockback; enemy defeat thresholds are 52% / 66%, hunter threshold is 150%, three lives. Leaving blast zones also defeats an actor. Enemy AI attacks with visible windups; projectiles use swept collision and remember their firing direction.
- Verification: `tests/night.test.mjs` covers hit protection, charge release, projectile direction and swept collision. `tests/night-browser.mjs` verifies actual keyboard movement plus both weapons, jumps, roll immunity, enemy attacks, switching, both waves, win/loss/retry, and on-screen controls. Outputs: `output/night-hunters/`.
- Animation limit: four generated main poses per character, with derived step frames. Background is one city plate with animated rain, signs, a patrol light, and impact particles.

## Intent and scope

Small-games playground in plain browser JavaScript + Canvas 2D (no framework, no runtime dependencies, no bundler; `npm run build` just copies the runtime files to `dist/` for Vercel). Started as pixel-rain music visualizations; now four games behind `games.html`, built for a birthday demo:

1. **Rain Studies** (`rain.html`, 001): the original invisible-character-in-rain visualization.
2. **Super Smash Cousins** (`smash.html`, 002): Smash-style fighter starring the cousins. The main project; `/` redirects here.
3. **Night Hunters** (`night.html`, 003): Blade/Deckard side-scroller with waves, a rooftops layout and the Root Archive breach.
4. **Lost Expedition / Root Archive** (`lost.html`, 004): exploration level with climbable pillars and collectible memories.

Dev pages: `sprites.html` (Sprite Forge), `cape-keyframes.html`, `debug-forge.html` (untracked). See `AGENTS.md` for the file map, commands and working rules.

Be laconic; continue authorized work without repeated confirmation. Don't overwrite user art or clean the dirty worktree.

## Run and test

- `npm run dev` serves http://localhost:8080 (check it's not already running first).
- `npm test`: unit tests. `npm run test:browser`: every `tests/*-browser.mjs` harness (starts the server if needed; `-- smash` filters). `npm run test:all`: both.
- Browser harnesses use the `playwright-core` devDependency plus the installed Edge/Chrome (`tests/browser-env.mjs`). They write screenshots and `verification.json` to `output/<game>/` (the cape harness writes to `archive/cape-reference/`).

## Super Smash Cousins: current state

### Files (`src/game/smash/`)
- `SmashStage.js`: scene, hit resolution (shield, dodge, hitstop, screen shake), percent HUD + stocks, floating slab, blast-zone KOs, camera, full-world rain. Pure helpers (`knockback`, `isOutOfBounds`, `shieldCost`, `boxesOverlap`, `foeFor`…) are unit-tested.
- Roster: `AndyFighter.js` (base fighter class: physics, double-jump, dash, shield, rolls, P1/P2 key bindings; also the parent of Night Hunters' fighter), `Eliseo.js`, `Simon.js`. Art comes from generated pose sheets (`AndySheet.js`, `SheetLoader.js`) with the checkerboard keyed out at load.
- `Moveset.js`: N64-tier kit data (jab, tilts, aerials, dash attack, charged smashes), shield and hitstop tuning.
- `CpuBrain.js`: CPU presses a virtual pad, so it plays through the same move code as a human. `Y` toggles it between fighting and an idle training dummy.
- Summons and projectiles: `Retriever.js` (Andy's retriever, Simon's pitbull), `SnakeSummon.js` (Eliseo), `Projectile.js`.
- `StageArt.js` (painted city + slab; photo backdrops in `assets/smash/` replace the plate, `B` cycles), `Sfx.js` (procedural sound effects).
- `src/smash.js`: entry. Cousin pickers, versus toggle, win check, Reset match, pause (auto on blur), remappable controls panel (persisted in localStorage), touch pad.

### Controls
The in-page footer in `smash.html` is the source of truth. P1: A/D move · W jump ×2 · S shield/fast-fall · J attack (+direction for tilts/aerials) · L tilt · hold K smash · Shift roll. P2: arrows · `,` jab · `.` tilt · hold `/` smash · RightShift dodge. System: T versus · Y CPU/dummy · C swap · N world rain · B backdrop · P pause · M music · R reset damage · H hitboxes · I summon · U power · O controls · Esc game select.

## Engine fixes worth knowing (made for embedded-webview testing, kept for robustness)

- `GameLoop` (`src/engine/GameLoop.js`) is rAF-first but **falls back to a setTimeout tick** if no rAF frame arrives within 500ms; some embedded webviews never fire rAF.
- Sprite loading resolves on `image.onload`, **not `image.decode()`**; `decode()` hangs forever in some webviews.
- `Input` passes game keys through toolbar controls marked `data-game-keys`, and clicked buttons blur themselves, so keys keep driving the game after a click.

## Verification last completed (2026-11-11)

- `npm run test:all`: 67 unit tests pass; 5/5 browser harnesses pass (cape, lost, night, night-effects, smash). Smash harness: 29 keyboard-driven checks, see `output/smash-cousins/verification.json`.
- Every page (`games`, `smash`, `rain`, `night`, `lost`, `sprites`) loads with zero console errors. `cape-keyframes.html` logs one 404 (dev page, unlinked).

## Known limitations / sensible next work

1. No browser harness yet for Rain Studies gameplay (the cape harness checks sprite frames only) or for Sprite Forge.
2. Recovery after falling off the slab is hard (double-jump only); consider a softer bottom blast zone if it frustrates casual players.
3. Rain Studies: Rain Lab settings not persisted; fade slider step quirk.
4. Untracked debug probes (`output/relic-*.mjs`, probe PNGs, `debug-forge.html`) are left from the Root Archive work; keep or delete by the owner's call.

## References and assets

- `andy.jpeg` (899×1599) — Andy's photo; used for palette sampling only now.
- Cape sheets: `WhatsApp Image 2026-09-06 at 3.19.01 PM.jpeg` (+ `(1)` effects sheet) — Rain Studies.
- `archive/` — old engine versions, video references; leave untouched.
