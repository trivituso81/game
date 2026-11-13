#!/usr/bin/env python3
"""Generic character baker. One spec file per character, no per-character code.

Usage: python3 tools/sprite-bake/bake_character.py spec.json [--root REPO_ROOT]

spec.json:
{
  "name": "hero",
  "battle_source": "path/to/battle-sheet.png",   // magenta background, 2 rows of 6 (default)
  "walk_source":   "path/to/walk-sheet.png",     // magenta background, 3 rows of 4 (default)
  "battle": {"cols": 6, "rows": 2, "cell": [64, 64]},   // optional overrides
  "walk":   {"cols": 4, "rows": 3, "cell": [32, 32]},
  "out": "art/chars",                             // optional, relative to the repo root
  "resample": "lanczos"                           // or "nearest"
}
Heights come from tools/sprite-bake/heights.json (per character, key "battle" and "walk", else "default"), and so does the
ONE head multiplier ("head"). Output: <out>/<name>-battle.png, <out>/<name>-walk.png, <out>/<name>.json.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bakelib as B

DEFAULTS = {'battle': {'cols': 6, 'rows': 2, 'cell': [64, 64]}, 'walk': {'cols': 4, 'rows': 3, 'cell': [32, 32]}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec')
    ap.add_argument('--root', default=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    a = ap.parse_args()
    spec = B.load_json(a.spec)
    name = spec['name']
    out_dir = os.path.join(a.root, spec.get('out', 'art/chars'))
    hpath = os.path.join(a.root, 'tools/sprite-bake/heights.json')
    meta = {'name': name}
    for kind in ('battle', 'walk'):
        src = spec.get(kind + '_source')
        if not src:
            continue
        cfg = dict(DEFAULTS[kind]); cfg.update(spec.get(kind, {}))
        height, head, frac = B.heights_for(hpath, name, kind)
        if not height:
            raise SystemExit(f'no {kind} height for {name} and no default in heights.json')
        im, info = B.bake_sheet(src, cfg['cols'], cfg['rows'], cfg['cell'], height, head, frac, spec.get('resample', 'lanczos'))
        B.write_png(im, os.path.join(out_dir, f'{name}-{kind}.png'))
        info['head'] = head
        meta[kind] = info
        print(f'{name} {kind}: {info["cols"]}x{info["rows"]} cells {info["cell"]}, height {height}, scale {info["scale"]}, empty frames {info["empty_frames"]}')
    if len(meta) == 1:
        raise SystemExit('spec has neither battle_source nor walk_source')
    import json
    with open(os.path.join(out_dir, f'{name}.json'), 'w') as f:
        json.dump(meta, f, indent=2); f.write('\n')


if __name__ == '__main__':
    main()
