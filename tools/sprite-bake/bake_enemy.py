#!/usr/bin/env python3
"""Generic enemy baker. One spec file per enemy.

Usage: python3 tools/sprite-bake/bake_enemy.py spec.json [--root REPO_ROOT]

spec.json:
{
  "name": "grey-monster",
  "source": "path/to/sheet.png",          // magenta background, cells laid out row by row
  "cols": 4, "rows": 1,                   // default 4 x 1 (idle frames)
  "cell": [96, 96],                       // output cell size
  "out": "art/enemies",                   // optional
  "resample": "lanczos"
}
Height comes from heights.json (per enemy key "battle", else "default"); the head multiplier is NOT applied to enemies.
Output: <out>/<name>.png and <out>/<name>.json.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bakelib as B


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec')
    ap.add_argument('--root', default=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    a = ap.parse_args()
    spec = B.load_json(a.spec)
    name = spec['name']
    height, _head, frac = B.heights_for(os.path.join(a.root, 'tools/sprite-bake/heights.json'), name, 'battle')
    if not height:
        raise SystemExit(f'no battle height for {name} and no default in heights.json')
    im, info = B.bake_sheet(spec['source'], spec.get('cols', 4), spec.get('rows', 1), spec.get('cell', [96, 96]),
                            height, 1.0, frac, spec.get('resample', 'lanczos'))
    out_dir = os.path.join(a.root, spec.get('out', 'art/enemies'))
    B.write_png(im, os.path.join(out_dir, f'{name}.png'))
    with open(os.path.join(out_dir, f'{name}.json'), 'w') as f:
        json.dump({'name': name, **info}, f, indent=2); f.write('\n')
    print(f'{name}: {info["cols"]}x{info["rows"]} cells {info["cell"]}, height {height}, scale {info["scale"]}, empty frames {info["empty_frames"]}')


if __name__ == '__main__':
    main()
