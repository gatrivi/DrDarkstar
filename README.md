# Dr Darkstar

A small browser game / creative-coding playground rebuilt around two independent pieces:

1. a tiny vanilla-JS game core (input, loop, asset loading, scene), and
2. a pixel-rain renderer that can process the game scene without owning game logic.

No frameworks. No runtime dependencies. The point is to keep it easy to understand, break and remix.

## Run

ES modules need HTTP rather than `file://`.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Controls

- WASD / arrows: move
- R: cycle `hybrid -> rain -> clean`
- P: pause

## Assets

The game tries to load:

```text
assets/player.png
```

If it is missing, a procedural ship is used. Existing DrDarkstar art can be restored progressively without blocking the engine.

## Structure

```text
src/engine/GameLoop.js       requestAnimationFrame + clamped delta
src/engine/Input.js          keyboard state
src/engine/AssetLoader.js    async images with safe fallback
src/effects/PixelRain.js     scene post-process / renderer
src/game/DrDarkstarGame.js   current toy scene and rules
src/main.js                  composition + resize + modes
```

## Design rule

Gameplay renders to an offscreen scene canvas. Pixel rain consumes that canvas and renders to the display canvas. Neither layer needs to know the internals of the other.

That separation is the part worth preserving as the project grows.
