# Dr Darkstar handoff — 2026-09-08

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

Small-games playground in plain browser JavaScript + Canvas 2D (no React, no dependencies, no build step). Started as pixel-rain music visualizations; now a two-game select structure built for a birthday demo:

1. **Super Smash Cousins** (`smash.html`) — 8-bit Smash-Bros-style fighter with the user's cousin Andy as the playable character vs a training dummy. This is the active project.
2. **Rain Studies** (`rain.html`) — the original invisible-character-in-rain visualization. Set aside as its own game; still fully working.

Be laconic; continue authorized work without repeated confirmation. Don't overwrite user art or clean the dirty worktree.

## Run and state

- `node server.mjs` serves http://localhost:8080 (check it's not already running first).
- **`/` (index.html) redirects straight to `smash.html`** so reloads land on the fight. Game select lives at `games.html`; Esc and the "◀ Game select" links go there.
- Entry points: `src/smash.js` and `src/rain.js` (the old combined `src/main.js` is deleted).
- Tests: `node --test tests/smash.test.mjs tests/rain.test.mjs` — 12 passing.

## Super Smash Cousins — current state

### Files (`src/game/smash/`)
- `AndyFighter.js` — extends `AnimatedSprite`. Builds a **hand-drawn 9-frame 24×32 pixel spritesheet** (poses: idle, punch1-3, windup, swing, serve, super, whistle). No photo pixelation anymore. Skin/hair palette is **sampled from `andy.jpeg`** at load (face/hair regions averaged; falls back to hardcoded palette). Wardrobe: Akatsuki-style black jacket with red cloud pixels, Link cap (he's an SSB1 Link main), Hylian shield on back for non-sword poses, Master Sword for windup/swing. Dummy = palette-swap (`PALETTES.dummy`). Real physics: gravity/velocity, double-jump, fast-fall, double-tap dash.
- `Moveset.js` — data table. J = Wing Tsun chain punch (3%, flurry poses). Hold K = Master Sword charge → release for golf-style drive (9–21%, knockback scales with victim %). L = ping-pong ball projectile. I = retriever summon. U = Todd-the-Vegan power (5s, 1.5× knockback, green aura).
- `Retriever.js` — black retriever, red collar, 2-frame gallop; sprints the stage, 7% hit, tumbles off platform edges with gravity, never bites its owner.
- `Projectile.js` — bouncing ball; bounces only on the slab.
- `SmashStage.js` — scene, hitboxes, Smash percent HUD + stocks, **floating platform** ({x0: 12%w, x1: 88%w, y: 62%h}) raised clear of the bottom UI; falling off an edge KOs off the bottom. Pure exported fns `knockback()` / `isOutOfBounds()` are unit-tested. Exports `MOVES`-driven spawn handling. Per-fighter focused `CollisionRain` reveal layers + ambient rain. Master Sword slash arc effect. Dummy AI wanders within a safe band and steers back from edges.
- `smash.js` — standalone entry. Win check (all stocks lost → status announces winner), Reset match button, Esc → games.html.

### Controls
A/D/arrows move · W/Space jump (double-jump) · S fast-fall · double-tap direction dash · J punch · hold K charged sword · L ball · I dog · U vegan power · Esc exit.

## Engine fixes worth knowing (made for embedded-webview testing, kept for robustness)

- `GameLoop` (`src/engine/GameLoop.js`) is rAF-first but **falls back to a setTimeout tick** if no rAF frame arrives within 500ms — some embedded webviews never fire rAF.
- Sprite loading in `CapeSprite.js`/`AndyFighter.js` resolves on `image.onload`, **not `image.decode()`** — `decode()` hangs forever in some webviews.
- `server.mjs` mime map now includes `.jpg`/`.jpeg`.

## Rain Studies — unchanged behavior

See `rain.html` + `src/rain.js`; CapeSprite sheets, Rain Lab toolbox, music picker/demo, autoattack all as before (details in git history / earlier README notes). Only change: Game select link points to `games.html`, and the two engine fixes above apply to it too.

## Verification last completed (2026-09-08)

- 12 unit tests pass (knockback scaling incl. vegan 1.5×, blast-zone margins + original 8 rain tests).
- In-browser harness (injected module in the page) verified: punch/golf/ball/dog damage numbers, KO → stock loss → respawn, vegan multiplier, edge-walk fall KO, dummy edge safety, palette sampling from andy.jpeg, zero page errors on both games.

## Known limitations / sensible next work

1. Sprite is procedurally drawn — charmingly crude. Agreed next step: **export the generated sheet to PNG once, hand-edit in Aseprite/Piskel, load the file instead** (`buildSpriteSheet` → `applySheet` split makes this a small change).
2. No sound effects wired for smash hits yet (AudioField pulse exists; stage calls `sound.pulse()` on hits).
3. One-player only vs dummy; second human player needs a second Input mapping.
4. Recovery after falling off the platform is hard (double-jump only) — consider a lower ledge or softer bottom blast zone if it frustrates casual players.
5. Rain Studies: Rain Lab settings not persisted; fade slider step quirk (see old notes below in git history).

## References and assets

- `andy.jpeg` (899×1599) — Andy's photo; used for palette sampling only now.
- Cape sheets: `WhatsApp Image 2026-09-06 at 3.19.01 PM.jpeg` (+ `(1)` effects sheet) — Rain Studies.
- `archive/` — old engine versions, video references; leave untouched.
