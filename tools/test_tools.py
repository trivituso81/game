#!/usr/bin/env python3
"""Test for the Build 1d.1 tools, run on grey placeholders in a temporary copy of the repo (the real repo is never touched).

Run:  CHROMIUM=/usr/bin/google-chrome python3 tools/test_tools.py

Covers: the generic character and enemy bakers (sheet geometry, magenta cut, bottom alignment, height from heights.json, the head multiplier),
the area installer (rejects a bad spec without writing, installs, replaces with purge, removes), the installed area drawing its picture in the
game, and art.html end to end against stubbed xAI and GitHub APIs (Generate, reference pictures, Upload, Approve, Reject, spend counter) in
portrait and landscape. Exits 1 on any failure.
"""
import base64
import io
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time

import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get('SHOTS', '/tmp/ffiv-shots')
PORT = int(os.environ.get('PORT', '8766'))
results = []


def check(name, ok, detail=''):
    results.append(ok)
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else ' :: ' + str(detail)))


def run(cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)


def grey_sheet(path, cols, rows, cell=200, head_r=26):
    """A magenta sheet with a grey figure (round head, body) in every cell; the body shifts a little per frame."""
    im = Image.new('RGB', (cols * cell, rows * cell), (255, 0, 255))
    d = ImageDraw.Draw(im)
    for i in range(cols * rows):
        cx, cy = (i % cols) * cell + cell // 2 + (i % 3) * 3, (i // cols) * cell
        d.ellipse((cx - head_r, cy + 30, cx + head_r, cy + 30 + 2 * head_r), fill=(150, 150, 150))
        d.rectangle((cx - 22, cy + 30 + 2 * head_r, cx + 22, cy + cell - 20), fill=(110, 110, 110))
    im.save(path)


def bbox_alpha(im):
    return im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()


def wait_port(port, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        with socket.socket() as s:
            if s.connect_ex(('127.0.0.1', port)) == 0:
                return
        time.sleep(0.1)
    raise SystemExit('static server did not start')


def png_b64(color, size=(64, 64)):
    b = io.BytesIO(); Image.new('RGB', size, color).save(b, 'PNG'); return base64.b64encode(b.getvalue()).decode()


def tools_part(tmp, work):
    # ---- character baker
    grey_sheet(f'{work}/battle.png', 6, 2); grey_sheet(f'{work}/walk.png', 4, 3)
    spec = {'name': 'grey', 'battle_source': f'{work}/battle.png', 'walk_source': f'{work}/walk.png'}
    json.dump(spec, open(f'{work}/char.json', 'w'))
    r = run([sys.executable, 'tools/sprite-bake/bake_character.py', f'{work}/char.json', '--root', tmp], tmp)
    check('character baker runs', r.returncode == 0, r.stderr + r.stdout)
    b = Image.open(f'{tmp}/art/chars/grey-battle.png'); w = Image.open(f'{tmp}/art/chars/grey-walk.png')
    check('battle sheet is 6x2 cells of 64', b.size == (384, 128), b.size)
    check('walk sheet is 4x3 cells of 32', w.size == (128, 96), w.size)
    check('magenta is cut to transparent', b.getpixel((0, 0))[3] == 0 and w.getpixel((0, 0))[3] == 0)
    cell0 = b.crop((0, 0, 64, 64)); bb = bbox_alpha(cell0)
    check('battle figure height comes from heights.json default (56)', abs((bb[3] - bb[1]) - 56) <= 1, bb)
    check('figure stands on the bottom of its cell', bb[3] == 64, bb)
    check('figure is centred in its cell', abs((bb[0] + bb[2]) / 2 - 32) <= 2, bb)
    wb = bbox_alpha(w.crop((0, 0, 32, 32)))
    check('walk figure height from heights.json default (28)', abs((wb[3] - wb[1]) - 28) <= 1, wb)
    meta = json.load(open(f'{tmp}/art/chars/grey.json'))
    check('meta file records both sheets', 'battle' in meta and 'walk' in meta)
    pink = np.array(b)[:, :, :3].astype(int); a = np.array(b)[:, :, 3]
    check('no pink fringe left on visible pixels', not ((pink[:, :, 0] > 200) & (pink[:, :, 2] > 200) & (pink[:, :, 1] < 80) & (a > 0)).any())
    # head multiplier and a per-character height, both from the one file
    hp = f'{tmp}/tools/sprite-bake/heights.json'
    h = json.load(open(hp)); h['head'] = 1.4; h['heights']['grey'] = {'battle': 40}; json.dump(h, open(hp, 'w'))
    r = run([sys.executable, 'tools/sprite-bake/bake_character.py', f'{work}/char.json', '--root', tmp], tmp)
    b2 = Image.open(f'{tmp}/art/chars/grey-battle.png'); bb2 = bbox_alpha(b2.crop((0, 0, 64, 64)))
    check('per-character height overrides the default (40)', abs((bb2[3] - bb2[1]) - 40) <= 1, bb2)
    def head_ratio(cell):
        bx = bbox_alpha(cell); hgt = bx[3] - bx[1]
        hd = bbox_alpha(cell.crop((0, bx[1], 64, bx[1] + hgt // 5))); bd = bbox_alpha(cell.crop((0, bx[3] - hgt // 3, 64, bx[3])))
        return (hd[2] - hd[0]) / (bd[2] - bd[0])
    check('head multiplier makes the head wider relative to the body', head_ratio(b2.crop((0, 0, 64, 64))) > head_ratio(cell0) * 1.2,
          (head_ratio(b2.crop((0, 0, 64, 64))), head_ratio(cell0)))
    # ---- enemy baker
    grey_sheet(f'{work}/enemy.png', 4, 1)
    json.dump({'name': 'grey-monster', 'source': f'{work}/enemy.png'}, open(f'{work}/enemy.json', 'w'))
    r = run([sys.executable, 'tools/sprite-bake/bake_enemy.py', f'{work}/enemy.json', '--root', tmp], tmp)
    check('enemy baker runs', r.returncode == 0, r.stderr + r.stdout)
    e = Image.open(f'{tmp}/art/enemies/grey-monster.png')
    check('enemy strip is 4 cells of 96', e.size == (384, 96), e.size)
    eb = bbox_alpha(e.crop((0, 0, 96, 96)))
    check('enemy height from heights.json default (56) and on the floor', abs((eb[3] - eb[1]) - 56) <= 1 and eb[3] == 96, eb)
    # no magenta sheet -> clear failure
    Image.new('RGB', (200, 200), (0, 255, 0)).save(f'{work}/notmagenta.png')
    json.dump({'name': 'x', 'source': f'{work}/notmagenta.png', 'cols': 1}, open(f'{work}/bad.json', 'w'))
    r = run([sys.executable, 'tools/sprite-bake/bake_enemy.py', f'{work}/bad.json', '--root', tmp], tmp)
    check('a sheet that is not on magenta fails clearly', r.returncode != 0 and 'magenta' in (r.stderr + r.stdout))


def area_spec(work, pic, to='town', color=(60, 140, 90)):
    mask = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#....M.....#', '############']
    Image.new('RGB', (600, 500), color).save(pic)   # 12 x 10 tiles, same shape
    return {'id': 'test-room', 'name': 'TEST ROOM', 'indoor': True, 'picture': pic, 'mask': mask,
            'portals': [{'x': 5, 'y': 8, 'to': to, 'spawn': {'x': 5, 'y': 6}}], 'spawn': {'x': 5, 'y': 6}}


def installer_part(tmp, work):
    ia = 'tools/install_area.py'
    bad = area_spec(work, f'{work}/pic.png', to='nowhere')
    json.dump(bad, open(f'{work}/area-bad.json', 'w'))
    before = open(f'{tmp}/engine/areas-data.js').read()
    r = run([sys.executable, ia, f'{work}/area-bad.json', '--root', tmp], tmp)
    check('installer rejects a portal to an unknown area', r.returncode == 1 and 'unknown area' in r.stdout, r.stdout)
    check('a rejected spec writes nothing', open(f'{tmp}/engine/areas-data.js').read() == before and not os.path.exists(f'{tmp}/art/areas'))
    ragged = dict(bad, mask=['####', '###'])
    json.dump(ragged, open(f'{work}/area-ragged.json', 'w'))
    r = run([sys.executable, ia, f'{work}/area-ragged.json', '--root', tmp], tmp)
    check('installer rejects a ragged mask', r.returncode == 1 and 'width' in r.stdout, r.stdout)
    wrongshape = dict(area_spec(work, f'{work}/pic.png'), picture=f'{work}/wide.png')
    Image.new('RGB', (1200, 300), (0, 0, 0)).save(f'{work}/wide.png')
    json.dump(wrongshape, open(f'{work}/area-shape.json', 'w'))
    r = run([sys.executable, ia, f'{work}/area-shape.json', '--root', tmp], tmp)
    check('installer rejects a picture of the wrong shape', r.returncode == 1 and 'shape' in r.stdout, r.stdout)

    good = area_spec(work, f'{work}/pic.png')
    json.dump(good, open(f'{work}/area-good.json', 'w'))
    r = run([sys.executable, ia, f'{work}/area-good.json', '--root', tmp], tmp)
    check('installer installs a sound spec', r.returncode == 0, r.stdout + r.stderr)
    pic = Image.open(f'{tmp}/art/areas/test-room.png')
    check('picture saved at 2x the logical size (12x10 tiles -> 384x320)', pic.size == (384, 320), pic.size)
    data = open(f'{tmp}/engine/areas-data.js').read()
    check('areas-data.js lists the area', '"test-room"' in data and 'art/areas/test-room.png' in data)
    tag1 = [l for l in data.splitlines() if l.startswith('const ART_TAG')][0]
    idx = open(f'{tmp}/index.html').read()
    check('index.html tag for areas-data.js follows ART_TAG', tag1.split("'")[1] in idx and 'areas-data.js?v=1d1"' not in idx, tag1)

    json.dump(area_spec(work, f'{work}/pic2.png', color=(200, 80, 80)), open(f'{work}/area-good2.json', 'w'))
    r = run([sys.executable, ia, f'{work}/area-good2.json', '--root', tmp], tmp)
    tag2 = [l for l in open(f'{tmp}/engine/areas-data.js').read().splitlines() if l.startswith('const ART_TAG')][0]
    check('replacing a picture changes the cache tag', r.returncode == 0 and tag1 != tag2, (tag1, tag2))
    check('replacing leaves one picture file only', os.listdir(f'{tmp}/art/areas') == ['test-room.png'], os.listdir(f'{tmp}/art/areas'))
    return area_spec  # unused


def game_part(tmp, browser):
    page = browser.new_context(viewport={'width': 390, 'height': 844}).new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_function('() => window.__FFIV !== undefined', timeout=15000)
    check('installed world passes validateWorld()', page.evaluate('() => validateWorld()') == [], page.evaluate('() => validateWorld()'))
    check('installed area is in AREAS with its picture path', page.evaluate("() => AREAS['test-room'] && AREAS['test-room'].art") == 'art/areas/test-room.png')
    page.evaluate("() => { game.mode='play'; setArea('test-room',{x:5,y:6}); }")
    page.wait_for_function("() => artImage('art/areas/test-room.png') !== null", timeout=10000)
    time.sleep(0.3)
    px = page.evaluate("""() => { const d=ctx.getImageData(Math.round(view.width/2), Math.round(view.height/2)-60, 1, 1).data; return [d[0],d[1],d[2]]; }""")
    check('the game draws the installed picture (red) instead of grey tiles', px[0] > 150 and px[1] < 120, px)
    page.screenshot(path=f'{SHOTS}/tools-installed-area.png')
    check('no console errors in the game', not errors, errors)
    page.close()


def art_part(tmp, browser):
    repo = {}        # fake GitHub: path -> {'content': b64, 'sha': n}
    calls = {'gen': [], 'edit': [], 'puts': []}

    def xai(route):
        body = json.loads(route.request.post_data)
        (calls['edit'] if route.request.url.endswith('/edits') else calls['gen']).append(body)
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'data': [{'b64_json': png_b64((120, 160, 200))}]}))

    def gh(route):
        req = route.request
        path = req.url.split('/contents/')[-1].split('?')[0] if '/contents/' in req.url else None
        if path is None:
            route.fulfill(status=200, content_type='application/json', body=json.dumps({'permissions': {'push': True}})); return
        from urllib.parse import unquote
        path = unquote(path)
        if req.method == 'GET':
            if path in repo:
                route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': repo[path]['sha'], 'content': repo[path]['content']}))
            else:
                route.fulfill(status=404, content_type='application/json', body='{}')
        else:
            b = json.loads(req.post_data)
            if path in repo and b.get('sha') != repo[path]['sha']:
                route.fulfill(status=409, content_type='application/json', body='{"message":"sha mismatch"}'); return
            repo[path] = {'content': b['content'], 'sha': str(len(calls['puts']) + 1)}
            calls['puts'].append(path)
            route.fulfill(status=200, content_type='application/json', body='{"content":{}}')

    for name, (w, h) in {'portrait': (390, 844), 'landscape': (844, 390)}.items():
        ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2)
        ctx.route('https://api.x.ai/**', xai); ctx.route('https://api.github.com/**', gh)
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto(f'http://127.0.0.1:{PORT}/art.html')
        page.fill('#xkey', 'xai-test'); page.fill('#ghtoken', 'ghp-test'); page.click('#save')
        page.reload()
        check(f'art {name}: setup survives a reload', page.input_value('#xkey') == 'xai-test' and page.input_value('#repo') == 'trivituso81/game')
        page.click('#testgh')
        page.wait_for_function("() => document.getElementById('status').textContent.includes('Push access: yes')", timeout=5000)
        check(f'art {name}: GitHub test reports push access', True)
        page.wait_for_selector('.item')
        check(f'art {name}: prompt list shows the test prompt', page.locator('.item').count() == 1)
        page.click('.item')
        page.screenshot(path=f'{SHOTS}/art-{name}-1-picked.png')
        # generate
        page.click('#gen')
        page.wait_for_selector('.shot', timeout=10000)
        check(f'art {name}: Generate shows a result', page.locator('.shot').count() >= 1)
        body = calls['gen'][-1]
        check(f'art {name}: request uses b64_json, the model and the aspect ratio', body['response_format'] == 'b64_json' and body['model'] == 'grok-imagine-image' and body['aspect_ratio'] == '1:1' and 'magenta' in body['prompt'], body)
        # reference picture goes to the edits endpoint
        Image.new('RGB', (32, 32), (9, 9, 9)).save(f'{tmp}/ref.png')
        page.set_input_files('#refs', f'{tmp}/ref.png')
        n_gen = page.locator('.shot').count()
        page.click('#gen')
        page.wait_for_function(f'() => document.querySelectorAll(".shot").length > {n_gen}', timeout=10000)
        check(f'art {name}: a reference picture uses the edits endpoint with the picture attached', len(calls['edit']) >= 1 and calls['edit'][-1]['images'][0]['url'].startswith('data:image/'), calls['edit'][-1:] )
        page.set_input_files('#refs', [])
        # upload
        n_up = page.locator('.shot').count(); api_before = len(calls['gen']) + len(calls['edit'])
        Image.new('RGB', (48, 48), (200, 200, 20)).save(f'{tmp}/mine.png')
        page.set_input_files('#upfile', f'{tmp}/mine.png')
        page.wait_for_function(f'() => document.querySelectorAll(".shot").length > {n_up}', timeout=10000)
        check(f'art {name}: UPLOAD MY OWN adds a result without calling xAI', len(calls['gen']) + len(calls['edit']) == api_before)
        page.screenshot(path=f'{SHOTS}/art-{name}-2-results.png')
        # keep at most 5 results
        for _ in range(5):
            c = page.locator('.shot').count()
            page.click('#gen'); page.wait_for_function(f'() => document.querySelectorAll(".shot").length !== {c} || {c} >= 5', timeout=10000); time.sleep(0.3)
        check(f'art {name}: only the last 5 results are kept', page.locator('.shot').count() == 5, page.locator('.shot').count())
        spend = page.inner_text('#spend')
        check(f'art {name}: spend counter counts pictures and references', spend.startswith('$') and float(spend[1:]) >= 0.2, spend)
        # approve the first (newest) result
        page.locator('.shot').first.click()
        page.fill('#prompt', 'EDITED PROMPT on solid magenta')
        page.click('#approve')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Approved')", timeout=10000)
        check(f'art {name}: Approve commits the picture', 'art/test-grey-figure.png' in repo and base64.b64decode(repo['art/test-grey-figure.png']['content'])[:4] == b'\x89PNG')
        check(f'art {name}: Approve commits the edited prompt', base64.b64decode(repo['art/test-grey-figure.prompt.txt']['content']).decode().strip() == 'EDITED PROMPT on solid magenta')
        ing = json.loads(base64.b64decode(repo['data/art-ingame.json']['content']))
        check(f'art {name}: Approve lists the picture as in game', ing['installed']['test-grey-figure']['path'] == 'art/test-grey-figure.png', ing)
        check(f'art {name}: list shows IN GAME', page.locator('.tag.ok').count() == 1)
        # approving again over the same path works (sha handling)
        page.click('#approve')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Approved')", timeout=10000)
        check(f'art {name}: a second Approve replaces the file without a conflict', not page.evaluate("() => document.getElementById('status').className"))
        # reject needs a note
        page.click('#reject')
        check(f'art {name}: Reject without a note is refused', 'note' in page.inner_text('#status').lower() and 'data/art-notes.json' not in repo)
        page.fill('#note', 'head too big')
        n_before = page.locator('.shot').count()
        page.click('#reject')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Rejected')", timeout=10000)
        notes = json.loads(base64.b64decode(repo['data/art-notes.json']['content']))
        check(f'art {name}: Reject commits the note and drops the picture', notes['notes'][-1]['note'] == 'head too big' and page.locator('.shot').count() == n_before - 1, notes)
        page.screenshot(path=f'{SHOTS}/art-{name}-3-done.png')
        # no key is ever written to the repo
        alltext = ''.join(base64.b64decode(v['content']).decode('latin1') for v in repo.values())
        check(f'art {name}: keys never reach the repo', 'xai-test' not in alltext and 'ghp-test' not in alltext)
        errors = [e for e in errors if 'status of 404' not in e]   # a new file in the repo answers 404 on purpose
        check(f'art {name}: no console errors', not errors, errors)
        ctx.close()
        repo.clear()


def main():
    os.makedirs(SHOTS, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='ffiv-tools-')
    work = tempfile.mkdtemp(prefix='ffiv-work-')
    shutil.copytree(ROOT, tmp, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.git', '__pycache__'))
    tools_part(tmp, work)
    installer_part(tmp, work)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=tmp, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_port(PORT)
        with sync_playwright() as p:
            kw = {'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}
            browser = p.chromium.launch(args=['--no-sandbox'], **kw)
            game_part(tmp, browser)
            art_part(tmp, browser)
            browser.close()
        # remove purges everything
        r = run([sys.executable, 'tools/install_area.py', '--remove', 'test-room', '--root', tmp], tmp)
        check('installer --remove purges the picture and the data', r.returncode == 0 and not os.listdir(f'{tmp}/art/areas') and not os.path.exists(f'{tmp}/data/areas/test-room.json'), r.stdout + r.stderr)
        check('areas-data.js is empty again after removal', 'INSTALLED_AREAS=[]' in open(f'{tmp}/engine/areas-data.js').read().replace(' ', ''))
    finally:
        srv.terminate()
        shutil.rmtree(tmp, ignore_errors=True); shutil.rmtree(work, ignore_errors=True)
    fails = results.count(False)
    print(f'\n{len(results) - fails}/{len(results)} passed')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
