# Simon spritesheet v1

Eight move key poses for Super Smash Cousins, generated with the built-in imagegen tool. Facial reference: `simon ping pong siesta con gatito encima.jpeg`. Exact prompt: `generation-prompt.txt`.

Simon wears a rust-orange work vest, off-white shirt, faded jeans and work boots. His weapons are a red ping-pong paddle and a bent, rusted iron bar. Kled is the assumed League reference, based on the user's scrappy rider and dismount description: https://www.leagueoflegends.com/en-gb/champions/kled/

Read left to right, top row then bottom row:

| Slot | Input | Key pose |
| --- | --- | --- |
| 1 | Idle | Relaxed paddle-ready stance |
| 2 | A | Short paddle jab |
| 3 | Tilt | Low paddle sweep |
| 4 | Smash | Raised rusted-iron strike windup |
| 5 | Up B | Two friends form a human ladder; Simon climbs off the top |
| 6 | Neutral B | Simon rides a gray pitbull while wielding the iron bar |
| 7 | Down B | Long siesta with an orange cat asleep on his chest |
| 8 | Side B | Paddle strike launches a ping-pong ball |

## Import status

This is a first-pass pose-art source, not a complete animation atlas. Actual PNG: 1774 x 887, RGB, with a baked-in checkerboard despite the requested transparency. Equal quarter crops are unsafe: a few props approach or cross nominal cell boundaries. Simon is visibly smaller in the human-ladder pose, which needs independent scaling/alignment.

Before engine integration, remove the checkerboard, isolate and align each pose, and define consistent body pivots. Pixel rain samples alpha and brightness: the checkerboard must not enter the sampling mask. Orange cloth highlights, skin and pale shirt provide readable luminance.

The ball, dog, cat and friends are currently drawn into their respective key poses. Extract or regenerate them as separate assets for independent projectile, summon and mount behavior. The mounted pose illustrates neutral B; damage-triggered dismount behavior is a future game mechanic, with no dismount frame in this sheet. Add that transition alongside attack follow-throughs and movement loops in a later pass. No gameplay code was changed.
