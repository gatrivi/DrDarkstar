# Night Hunters artwork

[Relic hunter character art](relic-hunter/README.md) adds a Generations Lost-inspired 16-pose concept sheet with dark brown hair, olive complexion, green eyes, crouches, and a gauntlet energy whip. Source artwork only; frame extraction and game integration are pending.

`city.png` and `sprites.png` reuse the built-in imagegen artwork created for the three-second Blade / Blade Runner clip. `generation-prompts.json` records their prompts; the original local clip remains in `output/blade-runner-genesis/`.

`src/game/night/Atlas.js` normalizes all sixteen cels onto common centers and boot baselines, mirrors the enemy rows to the shared facing convention, and caches two restrained step poses. The same frame pixels drive the visible sprites and Dr Darkstar's `CollisionRain` sampling.

Fan-art demo inspired by Generations Lost, X-Men 2: Clone Wars, Blade, and Blade Runner. The source sheet has four main poses per character; locomotion uses derived steps.

`throw-guard-v2.png` adds nine matching generated cels: Blade's shuriken windup/release/follow-through, Blade's sword guard/impact, and Deckard's forearm shield/impact. `throw-guard-prompt.txt` records the built-in imagegen prompt and the transparency correction. `Atlas.js` maps throw frames to 6–8 and guard frames to 9–11, with a shared boot baseline. The detached star supplies the spinning projectile's transparent sprite.

World Rain samples a complete offscreen scene through `SceneField` and the shared `CollisionRain` engine. It includes buildings, characters, reflections, weapons, and impacts; HUD labels remain clear. A faint 16% source image supports silhouettes beneath the falling particles. Rendering uses 12,000 world drops, 5,700 local character drops, a shared color palette, and one 480×300 RGBA particle buffer. Each flying shuriken has a compact stream sampling its rotating alpha mask. The toolbar toggles this mode for comparison with the original scene, which retains the original character density.
