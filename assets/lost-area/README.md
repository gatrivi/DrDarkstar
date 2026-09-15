# The Root Archive tileset

Integrated art pass: [trees, foliage and overgrown ruins](foliage-notes.md). Sixteen transparent prop groups dress all three chambers, with a climbable canopy route, a fallen-log bridge and three optional memories to discover with E. All existing artwork is reused; integration required no new generation.

One built-in imagegen call produced [tileset-v1.png](tileset-v1.png), a 1254 × 1254 opaque source atlas with sixteen environmental modules. Exact prompt: [generation-prompt.txt](generation-prompt.txt). Inspired by Generations Lost: mossy alien ruins, aged bronze machines, deep teal masonry and cyan energy.

| Row | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| 1 | Mossy platform | Bronze platform | Stone fill | Rooted stone fill |
| 2 | Background wall | Machine wall | Pillar | Rooted ceiling |
| 3 | Sealed door | Open door | Dormant relay | Powered relay |
| 4 | Undergrowth | Distant arch | Engraved mural | Water |

The source has painted dividers and slightly irregular row boundaries. `src/lost.js` explicitly crops and caches sixteen 64 × 64 tiles at load time. It reuses those tiles for terrain, props, and parallax. No additional background images or generation calls are needed. These are modular art blocks rather than a full corner/edge autotiling set; seams can remain visible on repetition.

## Play / edit

Run `node server.mjs`, open `/lost.html`, or select **004 / Lost Expedition** in Game Select. Walk, jump, crouch through the low passage, and whip the three circular relays. Read the murals with E; enter the archive with E after all relays are awake. The map spans 110 × 20 tiles (3520 × 640 logical pixels) across three connected chambers. Beacons restore your location after falling into water; relay progress survives that reset. Reloading or New Expedition starts fresh.

- A/D or arrows: move. Space/W/Up: jump. S/Down: crouch.
- J: energy whip. E: read / enter. M: map. P: pause. Esc: game select.
- On-screen buttons support held movement and simultaneous pointer input.
- Terrain, collisions and relays: `src/game/lost/World.js`.
- Rendering, sprite crops, camera, keyboard and pointer controls: `src/lost.js`.
- Reuses the existing relic hunter source sheet with manually aligned pose bounds; no new character generation. Source animation remains limited to its existing poses.

Checks: `node --test tests/lost.test.mjs` verifies a full traversal with ordinary movement, crouch clearance, directional whip/occlusion, checkpoints and door locking. `node tests/lost-browser.mjs` checks navigation, keyboard and pointer controls, UI state, mobile fit, and resource/browser errors. Browser screenshots and verification output go to `output/lost-area/`. `npm.cmd run build` includes the area and both source atlases in `dist/`.
