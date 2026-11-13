"""Shared helpers for the generic bakers (bake_character.py, bake_enemy.py).

Sheet rules: solid magenta (#FF00FF) background, cells of equal size laid out row by row.
Every frame is cut from the magenta, trimmed, scaled by ONE scale per sheet (so a walk cycle does not jitter),
and placed on the bottom centre of its output cell.
"""
import json
import os
from PIL import Image
import numpy as np

MAGENTA = np.array([255, 0, 255], dtype=np.float32)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def cut_magenta(im, tol=110.0, soft=60.0):
    """Returns an RGBA image with the magenta background made transparent. Pixels near the tolerance edge get partial alpha."""
    a = np.array(im.convert('RGBA'), dtype=np.float32)
    dist = np.sqrt(((a[:, :, :3] - MAGENTA) ** 2).sum(axis=2))
    alpha = np.clip((dist - tol) / soft, 0.0, 1.0)
    a[:, :, 3] = np.minimum(a[:, :, 3], alpha * 255.0)
    # remove the pink fringe on the soft edge: pull colour away from magenta
    edge = (alpha > 0) & (alpha < 1)
    a[:, :, 0][edge] = np.minimum(a[:, :, 0][edge], a[:, :, 1][edge] + 60)
    a[:, :, 2][edge] = np.minimum(a[:, :, 2][edge], a[:, :, 1][edge] + 60)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def trim(im):
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(box) if box else None


def scale_head(im, mult, frac):
    """Scales the top `frac` of the figure (the head) by `mult`, keeping it centred on the body. mult 1.0 changes nothing."""
    if abs(mult - 1.0) < 1e-6:
        return im
    w, h = im.size
    hh = max(1, int(round(h * frac)))
    head, body = im.crop((0, 0, w, hh)), im.crop((0, hh, w, h))
    head = head.resize((max(1, round(w * mult)), max(1, round(hh * mult))), Image.LANCZOS)
    out = Image.new('RGBA', (max(head.width, body.width), head.height + body.height), (0, 0, 0, 0))
    out.paste(body, ((out.width - body.width) // 2, head.height), body)
    out.paste(head, ((out.width - head.width) // 2, 0), head)
    return out


def split_cells(sheet, cols, rows):
    cw, ch = sheet.width // cols, sheet.height // rows
    return [sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for r in range(rows) for c in range(cols)]


def bake_sheet(src_path, cols, rows, cell, height, head_mult, head_frac, resample='lanczos'):
    """Bakes one source sheet. Returns (output image, info dict). `height` is the tallest frame's height in output pixels."""
    sheet = Image.open(src_path).convert('RGBA')
    frames = []
    cut_all = cut_magenta(sheet)
    clear = float((np.array(cut_all.getchannel('A')) < 8).mean())
    if clear < 0.05:
        raise SystemExit(f'{src_path}: the background is not magenta (#FF00FF), so nothing could be cut out. Regenerate the sheet on a solid magenta background.')
    for c in split_cells(sheet, cols, rows):
        t = trim(cut_magenta(c))
        frames.append(scale_head(t, head_mult, head_frac) if t else None)
    live = [f for f in frames if f]
    if not live:
        raise SystemExit(f'{src_path}: no figure found (is the background magenta #FF00FF?)')
    cw, ch = cell
    scale = min(height / max(f.height for f in live), cw / max(f.width for f in live))
    flt = Image.NEAREST if resample == 'nearest' else Image.LANCZOS
    out = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
    empty = 0
    for i, f in enumerate(frames):
        if not f:
            empty += 1
            continue
        g = f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), flt)
        x = (i % cols) * cw + (cw - g.width) // 2
        y = (i // cols) * ch + (ch - g.height)
        out.paste(g, (x, y), g)
    return out, {'cols': cols, 'rows': rows, 'cell': [cw, ch], 'height': height, 'scale': round(scale, 4), 'empty_frames': empty}


def heights_for(path, name, key):
    """heights.json: one file for all heights and the ONE head multiplier. Returns (height, head_mult, head_frac)."""
    h = load_json(path)
    entry = h.get('heights', {}).get(name, {})
    return entry.get(key, h.get('default', {}).get(key)), h.get('head', 1.0), h.get('head_frac', 0.3)


def write_png(im, path):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    im.save(path, optimize=True)
