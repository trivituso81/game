# Changes

Every push adds an entry here. Newest first.

## 1b (2026-11-12): battle core with placeholders

- New `engine/battle.js` (rules and state): two grey party members (ATTACK, SPECIAL once per fight, BAG, GUARD), one grey monster, one grey boss with a two-hit shield. Turn order: each living member picks a command in turn, then the enemy acts. No randomness.
- Level-up: each standing member gains XP per win and levels at 12 x level, adding 5 max HP and 1 attack.
- Difficulty: EASY, NORMAL, HARD scale enemy damage (x0.5, x1, x1.5). Picked on the title with LEFT and RIGHT, the D-pad, or a tap on the line.
- Bag: two placeholder items, each heals the lowest-HP member for 12.
- Second-layer rules are present behind `SECOND_LAYER` switches (weakness, status effects, combos), all off.
- New `engine/battle-draw.js`: the battle fills the window and the D-pad and A overlay it. Command cross (SPECIAL up, BAG left, GUARD right, ATTACK down), turn chips, HP bars, shield pips, message box, result box. Taps work on the cross, on messages (skip) and on the result.
- Field FIELD B has a grey monster at (14,14) and a grey boss at (18,34). Walking onto one starts its fight. A win removes the monster; a loss restores the party and leaves it in place.
- `engine/world.js` validates that monsters stand on walkable tiles and have a known kind. `engine/draw.js` draws monsters and the difficulty line on the title.
- Debug handle adds `battle`, `party`, `bag`, `difficulty`, `lastResult`, `monsters` and `startBattle(kind, opts)`.
- `tools/smoke.py`: 46 checks, all passing in both orientations. Adds the monster fight won, the boss shield absorbing the first hit, and a loss that restores the party.
- Cache tags bumped to `?v=1b` on all engine scripts.
- Known: names, numbers and rules are placeholders until intake round 2. The battle uses the reference's shape (shield pips, difficulty on enemy damage) without its names, art or animation.

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
