# Foliage and ruins — companion pass

[foliage-props-v1.png](foliage-props-v1.png) adds sixteen environmental prop groups to the original terrain kit. One built-in imagegen call; exact prompt: [foliage-generation-prompt.txt](foliage-generation-prompt.txt). Source is a 1254 × 1254 RGBA PNG with actual transparent pixels verified by sampling.

The direction starts from the nostalgic alien wilderness of Generations Lost: monumental trees, humid green foliage, old technology swallowed by roots. These new shapes can become the foundation of an original world. The existing Root Archive terrain sheet was inspected as the palette and pixel-art reference.

Visual order, left to right:

| Band | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Upper | Broad ancient tree | Forked forest tree | Bare tree with machine remnants | Distant teal tree |
| Upper middle | Trunk segment | Branch junction | Hollow buttress-root base | Canopy cluster |
| Lower middle | Fern clump | Stump and fungi | Three hanging vines | Root curtain |
| Bottom | Fallen-log bridge | Rooted stone arch | Mossy platform | Ground-cover cluster |

## Handoff

The sheet is now integrated into `/lost.html`. `src/game/lost/Foliage.js` uses authored polygon crops to isolate the sixteen irregularly spaced prop groups and caches them once at load time. The original PNG remains unchanged. The generator used unequal row heights and some touching silhouettes, so reuse those authored outlines rather than slicing into a uniform 4 × 4 grid. Preserve alpha when exporting.

Use the teal tree behind the play area, full trees in the middle distance, and fern/root clusters along foreground edges. Keep collision surfaces separate from decorative foliage. The log and stone ledge suggest walkable tops, while the hollow root base suggests a crouch passage; author their collision bounds explicitly. Trunk and canopy modules need overlap or seam cleanup before seamless stacking. Match scale to the existing character when placing each prop, rather than stretching every prop to the same tile size.

The demo uses all sixteen groups across parallax trees, world scenery, and foreground ground cover. Nearby foreground plants fade to keep the hunter readable. Three explicit one-way platforms add a log-and-ledge canopy route and replace the stone crossing above the water with a fallen-log bridge. E discovers three optional memories at the canopy perch, rooted arch, and upper lookout; these survive a water respawn but reset with a new expedition. The original three-relay route remains traversable.
