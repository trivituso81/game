# Changes

Every push adds an entry here. Newest first.

## 1a (2026-11-12): placeholder shell

- New engine written for the blank slate: `index.html` (markup and CSS), `engine/world.js` (three grey placeholder areas with walk masks and portals), `engine/draw.js` (grey tiles, placeholder walker, title card, fade), `engine/main.js` (layout, keyboard, gamepad, on-screen D-pad and A, tap to walk, doors and edges, frame loop, debug handle).
- Placeholder areas: TOWN A (one house with a door, one plain house, a pond, a fence, an east edge), FIELD B (west edge back), ROOM A (one table, one mat out).
- Portrait and landscape both work. Layout follows the window shape; ROTATE or the L key switches it and is remembered on the device.
- Storage key prefix `ffiv-`. Debug handle `window.__FFIV`.
- `tools/smoke.py` drives both orientations headless: title, arrow keys, tap to walk, door in and out, both edges, world table check, faults, console errors. 22 checks, all passing.
- Not in this build yet: the service worker and cache tags (Build 1f or 8), the battle core (1b), the story engine (1c), the admin pages (1d), voice (1e).
