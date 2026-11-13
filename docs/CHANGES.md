# Changes

Every push adds an entry here. Newest first.

## 1a.2 (2026-11-12): full-screen stage

- The map fills the whole window in portrait and landscape, one logical pixel per screen pixel. The D-pad and A are drawn over the map, as in the first game, instead of reserving space around it.
- Outside the map's walls the screen is filled with wall grey, so no black bars show.
- Cache tags bumped to `?v=1a2`. Smoke 22/22 in both orientations.
- Known: the placeholder town is 22 tiles wide, so in landscape grey shows at the sides. Map sizes come with intake round 5.

## 1a (2026-11-12): placeholder shell

- New engine written for the blank slate: `index.html` (markup and CSS), `engine/world.js` (three grey placeholder areas with walk masks and portals), `engine/draw.js` (grey tiles, placeholder walker, title card, fade), `engine/main.js` (layout, keyboard, gamepad, on-screen D-pad and A, tap to walk, doors and edges, frame loop, debug handle).
- Placeholder areas: TOWN A (one house with a door, one plain house, a pond, a fence, an east edge), FIELD B (west edge back), ROOM A (one table, one mat out).
- Portrait and landscape both work. Layout follows the window shape; ROTATE or the L key switches it and is remembered on the device.
- Storage key prefix `ffiv-`. Debug handle `window.__FFIV`.
- `tools/smoke.py` drives both orientations headless: title, arrow keys, tap to walk, door in and out, both edges, world table check, faults, console errors. 22 checks, all passing.
- Not in this build yet: the service worker and cache tags (Build 1f or 8), the battle core (1b), the story engine (1c), the admin pages (1d), voice (1e).
