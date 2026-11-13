# Game (trivituso81/game)

A new JRPG on a fresh engine. Currently at Build 1e (voice and music as real audio files; Voice Library and Music Library pages). Build 1d.2 (adds the Head Sizes, Portraits and Area editor pages; areas are now read from `data/areas/` at boot). Build 1c: placeholder world, grey fights and a story engine with one placeholder chapter. No story, cast or art yet.

## Run it

Open the GitHub Pages address for this repo, or serve the folder over http (opening `index.html` directly will not work):

```
python3 -m http.server 8000
```

Headless test (portrait and landscape):

```
CHROMIUM=/usr/bin/google-chrome python3 tools/smoke.py
```

Leave `CHROMIUM` unset to use Playwright's own Chromium. Screenshots go to `/tmp/ffiv-shots`.

## Layout of the code

| Path | What it is |
|---|---|
| `index.html` | Markup and CSS for the stage, controls and toast |
| `engine/world.js` | Tile size, walk masks, portals, path finding, world check |
| `engine/draw.js` | Drawing: tiles, walker, scene actors, title, fade |
| `engine/battle.js`, `engine/battle-draw.js` | Fight rules and the battle screen |
| `engine/story.js`, `engine/story-draw.js` | Chapters, cutscene runner, scene scripts, cards, close-ups |
| `engine/main.js` | Layout, input, walking, transitions, frame loop, debug handle |
| `art.html`, `data/art-*.json` | Art Library page and its prompt, in-game and note lists |
| `tools/sprite-bake/` | Generic character and enemy bakers, `heights.json` |
| `heads.html`, `portraits.html`, `areas.html`, `admin-lib.js` | Head Sizes, Portraits and Area editor pages; shared GitHub helpers |
| `voices.html`, `music.html`, `engine/audio.js`, `audio/`, `data/voice-lines.json`, `data/voice-slots.json`, `data/music.json` | Voice Library and Music Library pages; game audio (files loaded on demand); lists and voice plan |
| `engine/areacheck.js` | Area check in JavaScript (same rules as the installer) |
| `tools/install_area.py`, `data/areas/` | Area installer; area files and `index.json` (the list the game reads at boot) |
| `tools/smoke.py` | Headless test of the game |
| `tools/test_tools.py` | Headless test of the Art Library, bakers and installer |
| `docs/CHANGES.md` | One entry per push |
