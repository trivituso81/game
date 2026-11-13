# Working agreement for this repo

This repo is a JRPG in plain browser JavaScript. The engine is finished as a blank slate: grey placeholders, no story, no cast, no art. Tom designs and directs and plays on his iPhone. Claude does all technical work. Every finished change is pushed to `main`, which GitHub Pages serves.

Read this file first. Then read only the docs the task needs (table at the bottom).

## Rules that are never skipped

| Rule | What it means in practice |
|---|---|
| Test before every push | All three commands under "Tests" report no failures |
| Look before every push | Open the screenshots in `/tmp/ffiv-shots` for every new scene, map and fight, in portrait and in landscape |
| Move the cache tag | Any change to `index.html` or `engine/*.js` moves the one build tag in `index.html` (`?v=`) and `SW_TAG` in `sw.js` together. `tools/check_repo.py` fails if they differ |
| Log the push | Add an entry at the top of `docs/CHANGES.md` |
| Purge replaced files | A replaced picture, voice line or track is deleted in the same commit as its replacement. Never leave a file nothing uses |
| No unused voice lines | A voice file exists only for a line a scene or fight plays |
| No long dashes | Not in game text, docs, comments or data. Use commas, colons, full stops |
| Never copy from the first game | The engine came from `trivituso81/adventures-of-tom`. It may be read for how a system worked. Never push to it. Never copy its story, cast, places, art, voices, lines or music, and never name them here. `tools/check_repo.py` holds the banned list |
| Do not invent canon | Story, cast, battle rules and world are Tom's. Until he decides, use labelled placeholders (grey figures, HERO, TOWN A). Decisions go in `docs/CANON.md`, one dated line each |
| Full screen | Map and battle art fill the window. The D-pad and A overlay them. Never reserve space for controls |
| Phone first | Portrait and landscape must both work. Controls: on-screen D-pad and A, keyboard, gamepad |
| Images | Tom makes pictures only in the Art Library page (`art.html`: Generate, then Approve or Reject). Never write prompts for an outside image tool |
| Voice slots | The ElevenLabs account is shared with the first game and capped at 30 custom voices. Never plan a voice without a slot plan (`data/voice-slots.json`) |

## Code shape

- Classic scripts, one shared global scope, no modules, no build step. Load order is the order of the script tags in `index.html`.
- Storage keys start with `ffiv-`. The debug handle is `window.__FFIV`.
- Secrets (image key, voice key, GitHub token) live only in the phone's localStorage. Never commit one.
- Admin pages load engine files first and `admin-lib.js` last, without a `?v=` tag.

## Tests

```
CHROMIUM=/usr/bin/google-chrome python3 tools/smoke.py        # the game, both orientations
CHROMIUM=/usr/bin/google-chrome python3 tools/test_tools.py   # tools, admin pages, audio, service worker (needs ffmpeg)
python3 tools/check_repo.py                                   # cache tags, banned names, long dashes, docs present
```

Screenshots go to `/tmp/ffiv-shots`. Leave `CHROMIUM` unset to use Playwright's own Chromium.

## Push recipe

```
git add -A && git commit            # message ends with the attribution lines the session gives
git fetch --depth=50 origin main
git rebase origin/main              # never push conflict markers
git -c push.negotiate=true push origin HEAD:main
```

Pages shows a push after about a minute.

## Docs

| Doc | Read it when |
|---|---|
| `docs/ARCHITECTURE.md` | Touching any engine file, the boot order, areas, the service worker or cache tags |
| `docs/BATTLE_SYSTEM.md` | Touching fights |
| `docs/ART_PIPELINE.md` | Pictures, sprite sheets, portraits, installing an area |
| `docs/VOICE_PIPELINE.md` | Voice lines and the slot plan |
| `docs/MUSIC_PIPELINE.md` | Tracks and where they play |
| `docs/WORKFLOW.md` | Build cycle, session handoff, how to report to Tom |
| `docs/CANON.md` | Any story, cast, world or rules question |
| `docs/CHANGES.md` | What each push changed |
