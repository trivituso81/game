# Changes

Every push adds an entry here. Newest first.

## 1d.1 (2026-11-12): Art Library, generic bakers, area installer

- New `art.html` (Art Library), a phone page. Setup box (xAI key, GitHub token, repo, model, optional relay) kept in this phone's localStorage under `ffiv-`, never in the repo. Prompt list from `data/art-prompts.json` (one TEST prompt for now). GENERATE calls the xAI image API from the phone (`grok-imagine-image`, b64 result; with reference pictures it uses the edits endpoint). UPLOAD MY OWN is the free alternative. Last 5 results per picture are kept on the phone (IndexedDB). APPROVE commits the picture (`art/<id>.<ext>`), the edited prompt (`art/<id>.prompt.txt`) and the list `data/art-ingame.json` to main through the GitHub API. REJECT commits Tom's note to `data/art-notes.json` and drops the picture. Spend counter is an estimate ($0.04 per picture, $0.01 per reference).
- New `tools/sprite-bake/`: `bake_character.py` and `bake_enemy.py` (one spec file per character or enemy, no per-character code), shared `bakelib.py`, and `heights.json` (every height plus the ONE head multiplier). Sheet rules: solid magenta background; characters are battle 2 rows of 6 and walk 3 rows of 4; enemies default to 4 x 1. One scale per sheet so walk cycles do not jitter; figures stand on the bottom centre of their cell. A sheet that is not on magenta fails with a clear message.
- New `tools/install_area.py`: checks an area spec against the same rules as `validateWorld()`, saves the picture at 2x logical size, writes `data/areas/<id>.json`, regenerates `engine/areas-data.js`, bumps `ART_TAG` and the `?v=` tag on that script. Replacing an area purges its old picture; `--remove` purges everything.
- Engine: `engine/areas-data.js` (generated, empty for now), `areaFromData()` in `world.js`, and `drawArea()` in `draw.js` draws an installed area's picture instead of the grey tiles once it has loaded.
- New `tools/test_tools.py`: 68 checks on grey placeholders in a temporary copy of the repo (bakers, installer, installed area drawn in the game, art.html end to end against stubbed xAI and GitHub in portrait and landscape). `tools/smoke.py` still 84/84.
- Cache tags bumped to `?v=1d1`.
- Known: not yet tried with the real xAI and GitHub services (needs Tom's keys on his phone). If the browser blocks Generate, a relay address is needed. The head multiplier treats the top 30 percent of a figure as the head; check by eye on the first real character.

## 1c (2026-11-12): story engine with a placeholder chapter

- New `engine/story.js`: story state (chapter, flags, objective, done), the chapter list, the cutscene runner and the scene scripts. A scene is a list of plain steps; ops: wait, walk, face, say, camera, fade, spawn, remove, flag, objective, battle, closeup, end. A fight inside a scene replays after a loss, so a scene never skips it.
- New `engine/story-draw.js`: chapter select, title and end cards, the GOAL line, the speech box (top of the window, clear of the controls) and the four close-ups. All fill the window; controls overlay them.
- Close-ups: REVEAL (one object shown large), WATCH (a short animation that plays once), PLACE (an object lowers onto a spot that lights up), ORDERED (put A, B, C in order; a wrong item is refused with a message).
- Flow: title, chapter select, title card, play. Walking onto the GO tile in the south of TOWN A runs the opening cutscene (spawn, camera, fade, speech, walk, face, fight, flag, objective). It sets the flag `door-open`; the locked door on the plain house (a wall until then) leads to ROOM B. A tile in ROOM B runs the four close-ups, then the end card, then chapter select shows DONE.
- `engine/world.js`: new tile `L` (locked door), per-area `locks` and `triggers`, `resetWorld()`, and checks for both. Scene actors share the walker's shape (`actorPos`), so one walk routine moves both. Camera glides during a scene.
- Debug handle adds `chapter`, `flags`, `objective`, `done`, `scene`, `say`, `card`, `closeup`, `actors`, `startChapter`.
- `tools/smoke.py`: 84 checks (42 per orientation), all passing. Plays the chapter start to finish, including a refused wrong item in ORDERED.
- Cache tags bumped to `?v=1c` on all engine scripts.
- Known: progress (DONE mark) is kept in memory only; saves come later. All text is placeholder.

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
