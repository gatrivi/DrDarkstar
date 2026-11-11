# AGENTS.md (C:\zengatrivi\REACTJS\drdarkstar)

Response style: After finishing your response, ensure you briefly recap your response and break down WHY.

## Project

Plain browser JavaScript + Canvas 2D games. No framework, no bundler, no runtime dependencies. `HANDOFF.md` holds the per-game history and design notes; read it before changing a game.

| Game | Page | Entry | Code |
|---|---|---|---|
| Super Smash Cousins (main project) | `smash.html` | `src/smash.js` | `src/game/smash/` |
| Rain Studies | `rain.html` | `src/rain.js` | `src/game/`, `src/effects/` |
| Night Hunters | `night.html` | `src/night.js` | `src/game/night/` |
| Root Archive / Lost Expedition | `lost.html` | `src/lost.js` | `src/game/lost/` |

`games.html` is the game select page; `/` redirects to `smash.html`. `sprites.html` (Sprite Forge) and `cape-keyframes.html` are dev tools. Shared engine code lives in `src/engine/` (`Input.js`, `GameLoop.js`). Night Hunters extends Smash's `AndyFighter`, so changes there affect two games.

## Commands

- `npm run dev`: serves http://localhost:8080 (check that it isn't already running).
- `npm test`: unit tests (`node --test`).
- `npm run test:browser`: every `tests/*-browser.mjs` harness, headless. Starts the server if needed. Filter by name: `npm run test:browser -- smash night`.
- `npm run test:all`: both of the above. Run this before calling work done.
- `npm run build`: writes the deployable site to `dist/` (Vercel runs this).

Browser harnesses use `playwright-core` with the installed Edge/Chrome (`tests/browser-env.mjs`). Overrides: `CHROMIUM_PATH`, `PLAYWRIGHT_MODULE`, `BASE_URL`. They write screenshots and `verification.json` into `output/<game>/`.

## Rules

- Don't overwrite user art (`assets/`, photos and videos in the root) or delete untracked files without asking.
- A gameplay fix gets a browser check that drives real keyboard input, not just a unit test.
- Modules export their live state (`export { stage }` etc.) so harnesses can `import('/src/<game>.js')` and inspect it.
- Update `HANDOFF.md` when behavior or controls change.
