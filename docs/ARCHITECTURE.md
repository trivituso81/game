# Architecture

Facts about the engine as built. Everything visible is a grey placeholder.

## File map

| Path | What it is |
|---|---|
| `index.html` | The game page: canvas, D-pad, A, ROTATE, SOUND, toast, and the engine script tags |
| `sw.js` | Service worker for the game page (see "Cache tags and the service worker") |
| `engine/world.js` | Tile size, built-in grey areas, installed areas, walk test, portals, world check, path finding |
| `engine/audio.js` | Voice and music players. No side effects at load, so admin pages load it too |
| `engine/draw.js` | Tiles or an area picture, walker, scene actors, monsters, title, fades |
| `engine/battle.js` | Fight rules and state |
| `engine/battle-draw.js` | Fight screen and its taps |
| `engine/story.js` | Story state, chapter list, scene runner, scene scripts, close-up rules |
| `engine/story-draw.js` | Chapter select, cards, GOAL line, speech box, close-ups |
| `engine/main.js` | Layout, input, walking, transitions, frame loop, boot, debug handle. Loaded last |
| `engine/areacheck.js` | Area check in JavaScript for the Area editor. Not loaded by the game |
| `art.html`, `heads.html`, `portraits.html`, `areas.html`, `voices.html`, `music.html` | Admin pages (phone pages, linked to each other at the top) |
| `admin-lib.js` | Shared admin code: setup storage, GitHub calls, page style, nav |
| `data/` | Lists the game and admin pages read: areas, art, portraits, voice lines, voice slots, music |
| `art/`, `audio/voice/`, `audio/music/` | Approved pictures and audio files. Loaded only when needed |
| `tools/` | Tests, the repo check, the area installer, the sprite bakers |

## One shared scope

Engine files are classic scripts. Every top-level `const`, `let` and `function` is visible to every later file, and functions may call ones defined in later files as long as the call happens after load. There are no modules and no build step. Two names to know: `battle.js` defines `say()` for fight messages and `admin-lib.js` defines `say()` for the status line, which is why admin pages load `admin-lib.js` last.

## Boot order

1. Script tags load in this order: world, audio, draw, battle, battle-draw, story, story-draw, main.
2. `main.js` runs layout, wires input, then fetches in parallel: `data/areas/index.json` plus each listed area file (`loadInstalledAreas`), and `data/voice-lines.json` plus `data/music.json` (`loadAudioLists`). No audio file and no picture is fetched here.
3. When both finish (or fail), `__FFIV.ready` turns true, the title track is asked for, and the frame loop starts. If the area list cannot be read the game starts with the built-in grey areas and puts the reason in `__FFIV.areasNote`.
4. On the page's load event `main.js` registers `sw.js`.

## Modes

`game.mode` is one of: `title`, `chapters`, `card`, `play`, `battle`, `closeup`. A scene runs inside `play` (`game.scene` is set). Each frame runs pad poll, update, camera, draw, each inside a guard that records a fault in `__FFIV.faults` instead of stopping the loop.

## Areas

| Topic | Fact |
|---|---|
| Tile | 16 logical pixels. One logical pixel is one CSS pixel. The stage fills the window |
| Mask legend | `#` blocked, `.` walkable, `D` door, `M` mat, `E` edge, `L` locked door (a wall until its flag is set) |
| Portals | Every D, M, E and L tile has an entry saying which area it leads to and the arrival tile |
| Triggers | A tile that starts a scene the first time the walker stops on it |
| Monsters | A visible fight standing on a tile. Walking onto it starts the fight. A win removes it until the chapter restarts |
| Built-in areas | `town` (TOWN A), `field` (FIELD B), `room` (ROOM A), `roomb` (ROOM B), built in `world.js` |
| Installed areas | `data/areas/<id>.json`, listed in `data/areas/index.json` with a cache tag. An installed area with a built-in id replaces it. Written by `tools/install_area.py` or the Area editor |
| Picture | An installed area may name a picture (`art`). It is drawn in place of the grey tiles once loaded, with `?v=<area tag>` |
| Check | `validateWorld()` in the game, `check()` in the installer, `checkAreaSpec()` in the editor. The test suite runs the Python and JavaScript versions on the same specs and compares |

There is no world map. Areas join at doors and edges.

## Story

- `STORY` holds the chapter number, flags, the objective line and the done marks. Done marks live in memory only. There are no saves yet.
- `CHAPTERS` is the chapter list. `startChapter(n)` resets story, party, bag and monsters, shows the title card, then starts play in `town`.
- A scene is a list of plain steps in `SCENES`. Each step has an `op` from `SCENE_OPS`. To add a kind of step, add an entry to `SCENE_OPS` with `start` and `update`.

| Op | What it does |
|---|---|
| `wait` | Pauses |
| `walk` | Walks an actor (or `hero`) along the shortest path |
| `face` | Turns an actor |
| `say` | Shows a line and plays its voice. A press moves on |
| `camera` | Glides the camera to an actor or back to the hero |
| `fade` | Fades out or in |
| `spawn`, `remove` | Adds or removes a scene actor |
| `flag` | Sets a story flag (opens locked doors, gates triggers) |
| `objective` | Sets the GOAL line |
| `battle` | Starts a fight. A loss restores the party and starts it again |
| `closeup` | Opens a close-up: REVEAL, WATCH, PLACE or ORDERED |
| `end` | Ends the chapter: end card, then chapter select shows DONE |

## Audio

- A voice line's id is the speaker plus a hash of the exact text (`voiceId`). A changed line is a new line.
- A scene line with a file plays the file. A scene line with no file is read by the phone's speech synthesis. A fight line plays only if it has a file.
- Music: one looping track at a time. `musicFor(use)` picks the track for `title`, `battle`, `boss` or `area:<id>`. A use with no track is silence. If the browser blocks sound before the first tap, the track starts on the first tap or key.
- SOUND ON/OFF is saved as `ffiv-mute`.

## Admin pages and the commit path

Tom's phone is the only place content is made. Each admin page reads the site's data lists, lets him generate or edit, and commits straight to `main` through the GitHub API with the token saved in Setup on the Art Library page (`ffiv-gh-token`, `ffiv-repo`). One setup serves all six pages.

| Helper in `admin-lib.js` | Use |
|---|---|
| `ghGet`, `ghPut`, `ghDelete` | One file through the Contents API |
| `ghCommit(changes, message)` | Several writes and deletes in ONE commit through the Git Data API. `changes` are `{path,b64}` or `{path,del:true}`. Use it whenever a file and its list change together or a replaced file must go |
| `ghList(dir)` | Files in a folder |
| `siteJson(path)` | A data list from the site, never from cache |
| `EL_BASE()` | ElevenLabs address. `?el=<base>` points a page at a test stub |

Pages takes about a minute to show a commit.

## Cache tags and the service worker

GitHub Pages lets browsers keep files for ten minutes, and a phone home-screen app can hold them longer. Three tags stop a stale file from being used.

| Tag | Where it lives | Covers | Who moves it |
|---|---|---|---|
| Build tag | `?v=` on the engine script tags in `index.html`, and `SW_TAG` in `sw.js` | `index.html`, `engine/*.js` | Claude, on every push that changes them. One tag for all scripts |
| Area tag | `tag` in `data/areas/index.json` | Area files and area pictures | The installer and the Area editor, on every save |
| Audio tags | `tag` in `data/voice-lines.json` and `data/music.json` | Voice files, music files | The Voice Library and Music Library, on every approve, delete or purge |

What `sw.js` does with each request from the game's site:

| Request | Rule | Why |
|---|---|---|
| `index.html` | Network first, never the browser's own cache. Saved copy only if the network fails | One refresh after a push always shows the new build |
| `engine/*.js?v=TAG` | Saved copy first | A tagged address never changes its content |
| `art/...?v=TAG` | Saved copy first, saved on first view. An older tag of the same picture is dropped | Pictures stay on demand and replaced ones are purged |
| `data/*.json` | Network first. Saved copy only if the network fails | Lists are always fresh online, and the game still starts offline |
| Audio, admin pages, `admin-lib.js`, untagged files, other sites, anything that is not a GET | Not touched | Admin pages must always be live. Audio is left to the browser because phones ask for audio in pieces, which a saved copy answers badly |

Result: after one online visit the game starts with no network (pictures already seen included, audio not). A new `SW_TAG` installs at once, takes over open pages and deletes the old saved shell.

A browser driven by a test does not register the worker, so tests see plain network behaviour. A test that wants the worker opens `index.html?sw=1`.

## Debug handle

`window.__FFIV` exposes read-only state for tests and for checking by hand: `mode`, `area`, `walker`, `ready`, `busy`, `faults`, `problems`, `battle`, `party`, `bag`, `difficulty`, `lastResult`, `monsters`, `chapter`, `flags`, `objective`, `done`, `audio`, `scene`, `say`, `card`, `closeup`, `actors`, plus `startGame`, `startChapter`, `tapTile`, `tileToClient`, `toggleLayout`, `startBattle`.
