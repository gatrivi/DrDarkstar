# Dr Darkstar

Pixel-art game experiment based on a simple idea:

> rain particles collide with the **visible pixels of the current animation frame**.

When the character walks and the spritesheet advances, the collision surface changes with the sprite.

## Core loop

```text
spritesheet frame
      ↓
offscreen canvas
      ↓
getImageData() alpha mask
      ↓
world → sprite-local coordinates
      ↓
rain particle hits solid pixel
      ↓
alpha-gradient surface normal
      ↓
particle velocity reflects
```

Only a tiny sprite-sized canvas is sampled. We do **not** scan the whole game canvas every frame. Masks are cached per animation frame.

## Run

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Controls

- WASD / arrows — move; movement advances the spritesheet
- M — show the exact collision pixels
- R — reset rain
- P — pause

## Sprite

Put a sprite at:

```text
assets/player.png
```

Current prototype assumes one horizontal row of frames and infers square frames from image height. Until the real Dr Darkstar sheet is restored, a deliberately chunky 4-frame procedural character is used so the changing collision silhouette is obvious.

## Files

```text
src/game/AnimatedSprite.js    spritesheet animation + cached alpha masks
src/effects/CollisionRain.js  falling particles + pixel collision/reflection
src/engine/Input.js           keyboard input
src/engine/GameLoop.js        delta-time animation loop
src/main.js                   experiment wiring
```

## Why this structure

Frank's canvas image techniques use `drawImage()` and `getImageData()` to turn image pixels into usable data. Here that same idea is applied dynamically to a game spritesheet: each animation frame becomes collision geometry for another particle system.
