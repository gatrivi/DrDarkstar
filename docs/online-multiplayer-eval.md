# Online multiplayer eval — Smash Cousins, cross-PC play

Date: 2026-09-13. Question: can two players on different PCs fight each other?
Short answer: **yes, and the codebase is already shaped for it** — each
fighter reads from a swappable `input` object (`setMode('versus')` proves it:
the dummy becomes a human just by handing it P2 bindings). What is missing is
only the transport: getting Player 2's button presses from another PC into
that input object, ~20 times a second. No game-logic rewrite needed.

## Constraints that decide the options

- The Vercel deploy is **100% static** (`vercel.json`: no functions, `dist/`
  only). Anything needing an always-on server cannot live on Vercel.
- The match sim is tiny (2 fighters + a few projectiles) and runs at
  render framerate with `Math.min(delta, 0.05)` clamping — friendly to
  networked play.
- Versus mode already removes the AI, so there is no `Math.random` in the
  critical path during a net match (only cosmetic rain). Two sims fed the
  same inputs stay close; small divergences can be papered over with
  periodic snapshots.
- Family demo: cheating, ranked matchmaking, and reconnect-after-drop can be
  ignored for v1. Pause must become "both players agree" (or just disable P
  online and let the host call it).

## Options

### A. WebRTC peer-to-peer + free signaling (RECOMMENDED for remote cousins)

- Each browser opens a `RTCDataChannel` to the other; one player clicks
  "Host" (gets a 4-letter code), the other types it in ("Join"). Signaling
  (exchanging the code) goes through a free service — e.g. PeerJS cloud
  (`peerjs.com`, free tier, ~50 concurrent conns) or a ~30-line WebSocket
  rendezvous you host yourself. **Game traffic never touches a server.**
- Latency: direct browser-to-browser, usually 20–80 ms; fine for this game's
  pace (melee players tolerate ~60 ms; our hitstop even masks jitter).
- NAT: free Google STUN servers punch through most home routers. Symmetric
  NATs / strict corporate firewalls need TURN relaying — public free TURN is
  flaky, so ~5–10% of pairs may fail to connect. Mitigation: fall back to
  option B when both players are local, show "connection failed, try same
  Wi-Fi" otherwise.
- Cost: $0. Works on the existing Vercel URL over HTTPS (required by
  WebRTC) with zero deploy changes.
- Effort: 2–4 days. Netcode is ~300 lines: lobby UI, `PeerInput` class
  implementing `{ isDown(), consume(), endFrame() }` fed by the data
  channel at 20 Hz, 2 Hz snapshot resync `{ x, y, vx, vy, percent, stocks }`,
  pause-request handshake.

### B. LAN relay on this PC (RECOMMENDED for this week's testing)

- Run a ~50-line Node WebSocket relay next to `server.mjs` on this machine
  (same LAN). Both browsers open `ws://<this-PC-LAN-IP>:8090` and the relay
  forwards each player's input mask to the other. No NAT, no STUN, no
  accounts — if you can open `http://<ip>:8080/smash.html` on the second PC,
  netplay works.
- Latency on Wi-Fi: 2–15 ms. Basically indistinguishable from local.
- Limits: same network only (or VPN like Tailscale, which then makes it
  work remotely too with ~30 ms — honestly the best effort/quality ratio if
  everyone installs Tailscale). The relay PC must stay on; no internet
  randoms.
- Effort: ~1 day (relay) + reuse the exact `PeerInput` design from A, so B
  is a stepping stone, not throwaway work.

### C. Authoritative dedicated server (NOT recommended yet)

- Proper rollback/lockstep server on Fly.io/cheap VPS, anti-cheat,
  matchmaking. Best quality at scale, but weeks of work plus hosting cost
  and ops — absurd for testing with cousins. Revisit only if A/B prove the
  game is worth it.

## Suggested path

1. **Now:** build B (LAN relay + `PeerInput`), test cousins in the same
   house. It exercises the exact input-plumbing A needs.
2. **Next:** add A (WebRTC via PeerJS cloud) behind the same lobby UI, with
   automatic fallback messaging. Optionally bless Tailscale as the "it just
   works remotely" route.
3. **Later, maybe:** C if strangers on the internet ever need to play.

## Protocol sketch (shared by A and B, so v1 work carries over)

- 20 Hz UDP-like messages (DataChannel unreliable-unordered, or WS): 
  `{ seq, buttons: bitmask, facingHint }`. Buttons: left/right/up/down,
  jab, tilt, smash, roll, jump. ~8 bytes + overhead.
- Each client simulates BOTH fighters locally; the remote fighter's
  `fighter.input` is the `PeerInput` fed by the network. This is the same
  trick `setMode('versus')` uses — no sim changes.
- 2 Hz snapshot: `{ x, y, vx, vy, percent, stocks, shieldHP }` per fighter;
  if positions diverge > 40 px, snap the remote fighter (with a puff effect
  so pops read as intentional).
- Pause: P sends `pause-request`; game pauses only when both sides ack (or
  host forces). R/H/M stay local-only.
- Join flow: lobby overlay on `smash.html` (Host shows code, Join enters
  code), then countdown 3-2-1-GO to absorb initial jitter.

## Risks / unknowns

- Free TURN flakiness (A) — accept, message clearly, offer B/Tailscale.
- PeerJS cloud limits — fine for family scale; self-host the 30-line
  signaling later if needed.
- Clock differences don't matter (no lockstep); mashing stays fair because
  both sides see the same ~50 ms delay.
- Mobile browsers: no touch controls in Smash yet — netplay is desktop-only
  until touch buttons exist.
