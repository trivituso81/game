# Art pipeline

How a picture gets from Tom's phone into the game. Tom makes pictures only in the Art Library. Claude never writes prompts for an outside image tool.

## Steps

| Step | Who | Where | Result |
|---|---|---|---|
| 1. Add a prompt | Claude | `data/art-prompts.json` (`id`, `title`, `kind`: character, enemy, area or object, `size`, `prompt`) | The picture appears in the Art Library list |
| 2. Generate or upload | Tom | `art.html`: GENERATE (xAI image API, from the phone) or UPLOAD MY OWN | Up to 5 recent results per picture, kept on the phone |
| 3. Approve or reject | Tom | `art.html` | APPROVE commits `art/<id>.<ext>`, `art/<id>.prompt.txt` and `data/art-ingame.json`. REJECT commits his note to `data/art-notes.json` and drops the picture |
| 4. Install | Claude | A baker or the area installer, below | The picture is in the game |
| 5. Adjust | Tom | `heads.html`, `portraits.html`, `areas.html` | Head size, portrait crop, walk mask and doors |

Setup on `art.html` holds the xAI key, the GitHub token, the repo, the model and an optional relay address, all in the phone's localStorage under `ffiv-`. If the browser blocks GENERATE, a relay address is needed. The spend counter is an estimate.

## Sprite sheets

Rules for every sheet: solid magenta background (`#FF00FF`), figures laid out in a grid, one scale for the whole sheet so a walk cycle does not jitter, each figure standing on the bottom centre of its cell. A sheet that is not on magenta fails with a clear message.

| Tool | Input | Default grid | Output |
|---|---|---|---|
| `tools/sprite-bake/bake_character.py spec.json` | Battle sheet and walk sheet | Battle 2 rows of 6, walk 3 rows of 4 | `art/chars/<name>-battle.png`, `<name>-walk.png`, `<name>.json` |
| `tools/sprite-bake/bake_enemy.py spec.json` | One sheet | 4 by 1 | `art/enemies/<name>.png`, `<name>.json` |

There is one generic baker of each kind: one spec file per character or enemy, no per-character code. The spec format is at the top of each script.

## Heights and heads

`tools/sprite-bake/heights.json` is the one file for every height and the ONE head multiplier (`head`, with `head_frac` as the share of the figure treated as the head). Tom edits it on `heads.html`. Values apply at the next bake. The head multiplier is not applied to enemies. A character's real height is required from Tom before any spec is written.

## Portraits

`portraits.html`: pick an approved picture, drag a square and zoom, save a 256 by 256 `art/portraits/<name>.png`, listed in `data/portraits.json`. REMOVE SAVED deletes the file and its entry.

## Areas

| Way | Use |
|---|---|
| `python3 tools/install_area.py spec.json` | Installs or replaces an area from a picture and a mask. Saves the picture at twice the logical size to `art/areas/<id>.png`, writes `data/areas/<id>.json`, rewrites `data/areas/index.json` with a new tag, and purges a replaced picture |
| `python3 tools/install_area.py --remove ID` | Removes the area, its picture and its list entry |
| `areas.html` (Area editor) | On the phone: paint WALL, FLOOR, DOOR, MAT, EDGE and LOCKED tiles over the picture, set where each door leads, the lock flag, the spawn point, GO tiles and fights, or make a new area with no picture. SAVE refuses while the check lists problems |

The picture must match the mask's shape within 2 percent. Ids are a-z, 0-9 and dashes, and never `index`.

## Not built yet

The game does not yet draw baked character or enemy sheets or portraits. The walker, actors and enemies are grey figures. That wiring comes with the art direction and cast builds.
