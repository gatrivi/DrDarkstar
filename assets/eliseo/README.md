# Eliseo spritesheet v1

Created with the built-in imagegen tool, using `eliseo snake viego rulos.jpeg` as the facial reference. Red Snake-inspired tactical costume, prominent curls, and Viego-inspired spectral weapons. Exact prompt: `generation-prompt.txt`.

Pose order, left to right, top to bottom:

1. Idle, walk1, walk2, dash.
2. Jump, roll, spectral jab, tilt poke.
3. Charge, smash impact, smash follow-through, snake summon.
4. Possession, block, hurt, victory.

Source PNG is 1254 x 1254 RGB. Transparency was requested but the generator baked in a checkerboard. This is a pose-art source, not an engine-ready animation atlas. Some weapons extend beyond nominal equal cells, and the walking poses need greater differentiation. Remove the background and isolate/align frames before runtime use; do not slice blindly into quarters.

The existing game remains on its procedural Eliseo sheet. Its sprite loader expects one horizontal row. Importing this artwork requires clean alpha, individually aligned frame bounds, consistent pivots and animation timing. Pixel rain samples alpha and brightness, so the baked checkerboard must not enter its sampling mask. Red costume planes, warm curl highlights and mint sword edges were chosen for that renderer.
