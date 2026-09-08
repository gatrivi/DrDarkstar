# Old-project video references

Six timestamped frames were extracted from each original MP4, without modifying the videos.

- [WA0004 — overview, 9.66 seconds](VID-20220203-WA0004.png)
- [WA0035 — character close-up, 2.22 seconds](VID-20220203-WA0035.png)
- [WA0037 — upright character, 2.99 seconds](VID-20220203-WA0037.png)
- [WA0040 — portrait close-up, 3.05 seconds](VID-20220203-WA0040.png)

Adjacent JSON files record source dimensions, duration, and exact sampled timestamps. `extract.mjs` uses locally cached Playwright and Chromium and the local server; its tool paths are specific to this machine.

## Aim 1 — visual richness from simple sprite art

The user wants pixel rain to compensate for limited sprite-drawing capacity, inspired by the glow and persistence of CRT displays used with older console games. The rendering should contribute texture, light, and continuity while keeping a small animated sprite recognizable.

Observations from the extracted frames:

- A pale, outlined creature remains identifiable against a mostly monochrome, high-contrast environment.
- Strong light/dark masses carry the scene; dense fine texture supplies surface richness.
- The recordings include a physical monitor, perspective, and camera artifacts. Fine striping and moire cannot be confidently attributed to the game's rendering.
- These contact sheets show sampled appearances, not enough evidence to measure the original effect's timing or reconstruct its renderer.

Implications for the next rendering pass:

1. Preserve a legible body, face, and pose beneath the evolving particle texture.
2. Add restrained bloom around bright particle marks; avoid washing out internal shading.
3. Let previous poses decay briefly instead of clearing all detail on every frame change. Tune persistence so movement feels continuous without leaving confusing extra limbs.
4. Preserve dark gaps and contrast; brightness everywhere would weaken the silhouette.
5. Evaluate still frames and moving sequences. Success is a simple sprite that feels richer in motion, not only a dense static particle silhouette.

Current demo baseline: readable particle-only astronaut, dense local sampling, long-lived marks within each pose, and a hard reset between poses. Bloom and continuity across poses remain future work. Music-reference development is deferred.
