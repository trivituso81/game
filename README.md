# Game (trivituso81/game)

A new JRPG on a fresh engine. Currently at Build 1a: a placeholder shell with grey areas, a placeholder walker, doors and edges. No story, cast or art yet.

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
| `engine/draw.js` | Drawing: tiles, walker, title, fade |
| `engine/main.js` | Layout, input, walking, transitions, frame loop, debug handle |
| `tools/smoke.py` | Headless test |
| `docs/CHANGES.md` | One entry per push |
