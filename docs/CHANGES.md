# Changes

Every push adds an entry here. Newest first. Numbering restarts at 1 with the finished blank engine.

## 1 (2026-11-12): blank engine complete (Build 1f)

- Docs written for the blank engine: `CLAUDE.md` (working agreement), `docs/ARCHITECTURE.md`, `docs/BATTLE_SYSTEM.md`, `docs/ART_PIPELINE.md`, `docs/VOICE_PIPELINE.md`, `docs/MUSIC_PIPELINE.md`, `docs/WORKFLOW.md`, and an empty `docs/CANON.md`.
- New `sw.js`, a service worker for the game page. After one online visit the game starts with no network. `index.html` and the data lists are always fetched fresh when there is a network, so one refresh after a push shows the new build. Tagged engine scripts and pictures already seen are kept on the phone. Audio and the admin pages are left alone. Rules and reasons are in `docs/ARCHITECTURE.md`.
- One build tag: the `?v=` tag on the engine scripts in `index.html` and `SW_TAG` in `sw.js` move together. Now `1f`.
- New `tools/check_repo.py`: fails if the tags differ, if any text file names a cast member, place or story item of the first game, if any text file contains a long dash, or if a promised doc is missing.
- `tools/test_tools.py` adds the service worker part: saved shell, start with the server off, an update shown by one refresh, old shell purged, admin pages untouched, and the repo check catching a stale tag and a banned name.
- Known: audio needs a network the first time each file plays. Saves do not exist yet, so progress is lost on reload.

## Build history before entry 1

| Build | Commit | What it added |
|---|---|---|
| 1a | 2485873 | Placeholder shell: title, three grey areas, walker, doors and edges, portrait and landscape, smoke test |
| 1a.2 | 72f7f82 | Full-window stage with the controls over the map |
| 1b | e3af1bb | Battle core with grey placeholders |
| 1c | fd20183 | Story engine with one placeholder chapter |
| 1d.1 | f302b6d | Art Library, generic bakers, area installer |
| 1d.2 | ce1ed6b | Head Sizes, Portraits, Area editor; areas read from `data/areas/` at boot |
| 1e | 5cacc7d | Voice and music as real audio files; Voice Library and Music Library |
