# Game (trivituso81/game)

A new JRPG on a fresh engine. Currently at Build 1c: placeholder world, grey fights and a story engine with one placeholder chapter. No story, cast or art yet.

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
| `tools/smoke.py` | Headless test |
| `docs/CHANGES.md` | One entry per push |
