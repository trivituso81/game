#!/usr/bin/env python3
"""Area installer: wires a picture and a walk mask into the game.

Usage:
  python3 tools/install_area.py spec.json [--root REPO_ROOT]     install or replace an area
  python3 tools/install_area.py --remove AREA_ID [--root ROOT]   remove an installed area and purge its picture

spec.json:
{
  "id": "town-a", "name": "TOWN A", "indoor": false,
  "picture": "path/to/picture.png",            // must match the mask's shape (within 2 percent)
  "mask": ["####", "#..#", ...],               // legend: # blocked  . walkable  D door  M mat  E edge  L locked door
  "portals":  [{"x":2,"y":2,"to":"field","spawn":{"x":1,"y":1}}],
  "locks":    [{"x":3,"y":1,"flag":"door-open"}],
  "triggers": [{"x":2,"y":3,"scene":"opening"}],
  "monsters": [{"id":"m1","kind":"monster","x":4,"y":4}],
  "spawn": {"x":1,"y":1}
}
What it does: checks the spec against the same rules as validateWorld() in engine/world.js, saves the picture as art/areas/<id>.png
at 2x the logical size, writes data/areas/<id>.json, and rewrites data/areas/index.json (the list of installed ids and a cache tag) from every
area file. The game fetches that list at boot; the Area editor (areas.html) updates the same list from the phone. A replaced area's old picture
is purged in the same run. index.json is the list, not an area.
"""
import argparse
import glob
import hashlib
import json
import os
import re
import sys

from PIL import Image

T = 16
PORTAL_CHARS = 'DMEL'
LEGEND = '#.DMEL'
ENEMY_KINDS = ('monster', 'boss')


def builtin_ids(root):
    src = open(os.path.join(root, 'engine/world.js')).read()
    return set(re.findall(r"boxedArea\('([a-z0-9-]+)'", src))


def story_scenes(root):
    src = open(os.path.join(root, 'engine/story.js')).read()
    m = re.search(r'const SCENES\s*=\s*\{', src)
    return set(re.findall(r"^\s{2}'?([A-Za-z0-9_-]+)'?\s*:\s*\{\s*steps", src[m.end():], re.M)) if m else set()


def check(spec, root, installed):
    out = []
    if not re.fullmatch(r'[a-z0-9-]+', str(spec.get('id', ''))) or spec.get('id') == 'index':
        out.append('id must be made of a-z, 0-9 and dashes, and cannot be "index"')
    rows = spec.get('mask') or []
    if not rows:
        return out + ['mask is empty']
    w = len(rows[0])
    for i, r in enumerate(rows):
        if len(r) != w:
            out.append(f'mask row {i} has width {len(r)}, expected {w}')
        for c in r:
            if c not in LEGEND:
                out.append(f'mask row {i} has unknown character {c!r}')
    if any(o.startswith('mask') for o in out):
        return out
    h = len(rows)
    ids = builtin_ids(root) | set(installed) | {spec['id']}
    walk = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] != '#'
    portals = {(p['x'], p['y']): p for p in spec.get('portals', [])}
    locks = {(l['x'], l['y']): l['flag'] for l in spec.get('locks', [])}
    for y in range(h):
        for x in range(w):
            c = rows[y][x]
            if c in PORTAL_CHARS and (x, y) not in portals:
                out.append(f'{x},{y} {c} has no portal entry')
            if c == 'L' and (x, y) not in locks:
                out.append(f'{x},{y} locked door has no lock entry')
    for (x, y), p in portals.items():
        if not (0 <= x < w and 0 <= y < h) or rows[y][x] not in PORTAL_CHARS:
            out.append(f'portal at {x},{y} is not on a door, mat, edge or locked door tile')
        if p['to'] not in ids:
            out.append(f'portal at {x},{y} leads to unknown area {p["to"]}')
    for (x, y), f in locks.items():
        if not f:
            out.append(f'lock at {x},{y} has no flag')
    scenes = story_scenes(root)
    for t in spec.get('triggers', []):
        if not walk(t['x'], t['y']):
            out.append(f'trigger at {t["x"]},{t["y"]} is not on a walkable tile')
        if scenes and t['scene'] not in scenes:
            out.append(f'trigger at {t["x"]},{t["y"]} names unknown scene {t["scene"]}')
    s = spec.get('spawn') or {}
    if not walk(s.get('x', -1), s.get('y', -1)):
        out.append('spawn is blocked')
    for m in spec.get('monsters', []):
        if not walk(m['x'], m['y']):
            out.append(f'{m["id"]} stands on a wall')
        if m['kind'] not in ENEMY_KINDS:
            out.append(f'{m["id"]} has unknown kind {m["kind"]}')
    return out


def area_files(root):
    return [f for f in sorted(glob.glob(os.path.join(root, 'data/areas/*.json'))) if os.path.basename(f) != 'index.json']


def regenerate(root):
    """Writes data/areas/index.json: the list of installed ids plus a cache tag. The game fetches this list at boot."""
    areas = [json.load(open(f)) for f in area_files(root)]
    digest = hashlib.sha1(''.join(json.dumps(a, sort_keys=True) for a in areas).encode())
    for a in areas:
        p = os.path.join(root, a['art']) if a.get('art') else None
        if p and os.path.exists(p):
            digest.update(open(p, 'rb').read())
    tag = '0' if not areas else digest.hexdigest()[:6]
    os.makedirs(os.path.join(root, 'data/areas'), exist_ok=True)
    with open(os.path.join(root, 'data/areas/index.json'), 'w') as f:
        json.dump({'tag': tag, 'areas': [a['id'] for a in areas]}, f, indent=1); f.write('\n')
    return tag


def installed_ids(root):
    return {os.path.splitext(os.path.basename(f))[0] for f in area_files(root)}


def purge(root, area_id):
    p = os.path.join(root, 'data/areas', area_id + '.json')
    if os.path.exists(p):
        old = json.load(open(p))
        if old.get('art') and os.path.exists(os.path.join(root, old['art'])):
            os.remove(os.path.join(root, old['art']))
        os.remove(p)
        return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec', nargs='?')
    ap.add_argument('--remove')
    ap.add_argument('--root', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    a = ap.parse_args()
    root = a.root
    if a.remove:
        if not purge(root, a.remove):
            raise SystemExit(f'{a.remove} is not installed')
        print(f'removed {a.remove}; cache tag now {regenerate(root)}')
        return
    if not a.spec:
        ap.error('give a spec file or --remove')
    spec = json.load(open(a.spec))
    probs = check(spec, root, installed_ids(root))
    pic = Image.open(spec['picture']).convert('RGBA')
    h, w = len(spec['mask']), len(spec['mask'][0])
    if abs(pic.width / pic.height - w / h) > 0.02 * (w / h):
        probs.append(f'picture is {pic.width}x{pic.height} but the mask is {w}x{h} tiles (shape differs by more than 2 percent)')
    if probs:
        print('NOT INSTALLED. Problems:')
        for p in probs:
            print(' -', p)
        sys.exit(1)
    purge(root, spec['id'])
    art = f'art/areas/{spec["id"]}.png'
    os.makedirs(os.path.join(root, 'art/areas'), exist_ok=True)
    pic.resize((w * T * 2, h * T * 2), Image.LANCZOS).save(os.path.join(root, art), optimize=True)
    data = {k: spec[k] for k in ('id', 'name', 'mask', 'spawn') }
    for k in ('indoor', 'portals', 'locks', 'triggers', 'monsters'):
        if k in spec:
            data[k] = spec[k]
    data['art'] = art
    os.makedirs(os.path.join(root, 'data/areas'), exist_ok=True)
    with open(os.path.join(root, 'data/areas', spec['id'] + '.json'), 'w') as f:
        json.dump(data, f, indent=1); f.write('\n')
    print(f'installed {spec["id"]} ({w}x{h} tiles) with {art}; cache tag now {regenerate(root)}')


if __name__ == '__main__':
    main()
