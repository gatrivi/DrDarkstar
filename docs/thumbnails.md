# Share thumbnails — recipe for every game

Every playable page gets its own bespoke share card: one image, one title,
one description. This is what makes links unfurl nicely on WhatsApp /
Telegram / Discord, and the same image dresses the game-select card.

## The standard

- **Image:** 1200×630 (`summary_large_image`), under ~150KB. PNG for flat
  pixel art, quality-82 JPEG for noisy/gradient scenes (see Night Hunters).
- **Location:** `assets/<game>-thumbnail.{png,jpg}` (flat, next to the
  existing three — no new folders).
- **Title:** page `<title>` + `og:title` / `twitter:title`, one line, game
  name first. Spanish only where the audience is family (Smash); English
  everywhere else.
- **Description:** `meta[name=description]` + `og:description`, one or two
  sentences: fantasy first, controls second, invitation last.

## Wiring checklist for a new game (`newgame.html`)

1. Capture: serve locally (`node server.mjs`), screenshot real gameplay at
   1200×630 headless, e.g.
   `msedge --headless --disable-gpu --hide-scrollbars --window-size=1200,630 --virtual-time-budget=8000 --screenshot=shot.png http://localhost:8080/newgame.html`
   Retake until the frame shows action (HUD + fighters, no menus unless the
   menu IS the vibe). Compress to target size (PIL: `optimize=True`, or
   JPEG q82 for gradients).
2. Save as `assets/newgame-thumbnail.{png,jpg}`.
3. Add the file to `scripts/build.mjs` `entries` or Vercel ships a 404
   (the deploy only includes listed files — this step is the one everyone
   forgets).
4. Paste the tag block into `<head>`, swapping text and image path
   (root-relative `/assets/...` so it resolves on localhost AND Vercel —
   never guess the domain):
   ```html
   <meta name="description" content="..." />
   <meta property="og:type" content="website" />
   <meta property="og:title" content="..." />
   <meta property="og:description" content="..." />
   <meta property="og:image" content="/assets/newgame-thumbnail.png" />
   <meta name="twitter:card" content="summary_large_image" />
   <meta name="twitter:image" content="/assets/newgame-thumbnail.png" />
   ```
5. Add the card `<img src="./assets/newgame-thumbnail.png" width="1200"
   height="630" ...>` to `games.html` (`.card img` styling already exists).
6. Verify: `npm run build` includes it in `dist/`, both URLs return 200
   locally, and bust messenger caches with `?v=2` on first share —
   WhatsApp caches previews aggressively.

## Current set

| Game | Page | Image | Language |
|---|---|---|---|
| Super Smash Cousins | `smash.html` | `assets/smash-cousins-thumbnail.png` | ES (family share) |
| Night Hunters | `night.html` | `assets/night-hunters-thumbnail.jpg` | EN |
| Rain Studies | `rain.html` | `assets/rain-studies-thumbnail.png` | EN |
| Game select | `games.html` | reuses the Smash image (flagship) | ES-leaning |
