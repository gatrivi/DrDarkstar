# Relic hunter — character art v1

Original Night Hunters character concept with a stronger Generations Lost influence: dark brown hair, warm olive Iberian complexion, green eyes, aged bronze biomechanical armor, and a cyan energy whip emitted from a gauntlet.

Created with the built-in imagegen tool. The existing Night Hunters sprite sheet and city were inspected as visual references. Exact generation prompt: [generation-prompt.txt](generation-prompt.txt).

Asset: [relic-hunter-spritesheet-v1.png](relic-hunter-spritesheet-v1.png), 1254 × 1254 PNG with actual transparency verified by alpha sampling.

Pose order, left to right and top to bottom:

| Row | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| 1 | Idle | Walk A | Walk B | Dash |
| 2 | Jump | Landing anticipation | Deep crouch | Crouch-walk |
| 3 | Whip windup | Whip cast | Whip impact | Whip recovery |
| 4 | Crouching whip sweep | Overhead whip | Guard | Hurt |

This source sheet is now used by the playable [Root Archive exploration demo](../../lost-area/README.md). `src/lost.js` supplies individual frame crops, shared body scale and foot anchors, plus a live whip extension. The source itself is not a regular engine-ready atlas: some whip effects cross nominal quarter-cell boundaries, and grounded baselines vary. Do not slice blindly into equal cells. Walk A and B would benefit from stronger opposing-leg differentiation for a polished looping gait. Night Hunters itself still uses its original hunters.
