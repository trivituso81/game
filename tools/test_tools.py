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
    before = open(f'{tmp}/data/areas/index.json').read()
    r = run([sys.executable, ia, f'{work}/area-bad.json', '--root', tmp], tmp)
    check('installer rejects a portal to an unknown area', r.returncode == 1 and 'unknown area' in r.stdout, r.stdout)
    check('a rejected spec writes nothing', open(f'{tmp}/data/areas/index.json').read() == before and not os.path.exists(f'{tmp}/art/areas'))
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
    idx1 = json.load(open(f'{tmp}/data/areas/index.json'))
    check('index.json lists the area and carries a cache tag', idx1['areas'] == ['test-room'] and idx1['tag'] not in ('', '0'), idx1)
    d1 = json.load(open(f'{tmp}/data/areas/test-room.json'))
    check('area file keeps the mask and the picture path', d1['art'] == 'art/areas/test-room.png' and len(d1['mask']) == 10)
    check('index.html no longer loads a generated areas-data.js', 'areas-data' not in open(f'{tmp}/index.html').read() and not os.path.exists(f'{tmp}/engine/areas-data.js'))

    json.dump(area_spec(work, f'{work}/pic2.png', color=(200, 80, 80)), open(f'{work}/area-good2.json', 'w'))
    r = run([sys.executable, ia, f'{work}/area-good2.json', '--root', tmp], tmp)
    tag2 = json.load(open(f'{tmp}/data/areas/index.json'))['tag']
    check('replacing a picture changes the cache tag', r.returncode == 0 and idx1['tag'] != tag2, (idx1['tag'], tag2))
    check('replacing leaves one picture file only', os.listdir(f'{tmp}/art/areas') == ['test-room.png'], os.listdir(f'{tmp}/art/areas'))
    return area_spec  # unused


def game_part(tmp, browser):
    page = browser.new_context(viewport={'width': 390, 'height': 844}).new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_function('() => window.__FFIV && __FFIV.ready', timeout=15000)
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


def fake_github(repo, calls):
    """Stubbed GitHub contents API. repo: path -> {'content': b64, 'sha': str}. Supports GET (file or directory listing), PUT and DELETE."""
    from urllib.parse import unquote

    def handler(route):
        req = route.request
        if '/contents/' not in req.url:
            route.fulfill(status=200, content_type='application/json', body=json.dumps({'permissions': {'push': True}})); return
        path = unquote(req.url.split('/contents/')[-1].split('?')[0])
        if req.method == 'GET':
            if path in repo:
                route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': repo[path]['sha'], 'content': repo[path]['content']})); return
            kids = sorted({k[len(path) + 1:].split('/')[0] for k in repo if k.startswith(path + '/')})
            if kids:
                route.fulfill(status=200, content_type='application/json', body=json.dumps([{'name': k, 'type': 'file'} for k in kids])); return
            route.fulfill(status=404, content_type='application/json', body='{}'); return
        b = json.loads(req.post_data)
        if req.method == 'DELETE':
            if path not in repo or b.get('sha') != repo[path]['sha']:
                route.fulfill(status=409, content_type='application/json', body='{"message":"sha mismatch"}'); return
            del repo[path]; calls['deletes'].append(path)
            route.fulfill(status=200, content_type='application/json', body='{}'); return
        if path in repo and b.get('sha') != repo[path]['sha']:
            route.fulfill(status=409, content_type='application/json', body='{"message":"sha mismatch"}'); return
        repo[path] = {'content': b['content'], 'sha': str(len(calls['puts']) + 100)}
        calls['puts'].append(path)
        route.fulfill(status=200, content_type='application/json', body='{"content":{}}')
    return handler


def seed(repo, tmp, *paths):
    for p in paths:
        repo[p] = {'content': base64.b64encode(open(f'{tmp}/{p}', 'rb').read()).decode(), 'sha': 's0'}


def jget(repo, path):
    return json.loads(base64.b64decode(repo[path]['content']))


def admin_page(browser, size, repo, calls, url):
    ctx = browser.new_context(viewport={'width': size[0], 'height': size[1]}, device_scale_factor=2)
    ctx.add_init_script("() => {}")
    ctx.add_init_script("try{localStorage.setItem('ffiv-gh-token','ghp-test');localStorage.setItem('ffiv-repo','trivituso81/game');}catch(e){}")
    ctx.route('https://api.github.com/**', fake_github(repo, calls))
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(f'http://127.0.0.1:{PORT}/{url}')
    return ctx, page, errors


def parity_part(tmp):
    """The JavaScript area check (engine/areacheck.js) must say the same as the Python one (tools/install_area.py) on the same specs."""
    sys.path.insert(0, f'{tmp}/tools')
    import importlib
    ia = importlib.import_module('install_area')
    good = {'id': 'x', 'name': 'X', 'mask': ['#####', '#...#', '#.D.#', '#####'], 'portals': [{'x': 2, 'y': 2, 'to': 'town', 'spawn': {'x': 1, 'y': 1}}], 'spawn': {'x': 1, 'y': 1}}
    def v(**kw):
        d = json.loads(json.dumps(good)); d.update(kw); return d
    cases = {
        'sound': v(),
        'ragged mask': v(mask=['####', '###']),
        'unknown character': v(mask=['#####', '#.Q.#', '#.D.#', '#####']),
        'door without portal': v(portals=[]),
        'portal not on a door': v(portals=[{'x': 1, 'y': 1, 'to': 'town', 'spawn': {'x': 1, 'y': 1}}] + good['portals']),
        'unknown target': v(portals=[{'x': 2, 'y': 2, 'to': 'nowhere', 'spawn': {'x': 1, 'y': 1}}]),
        'trigger on a wall': v(triggers=[{'x': 0, 'y': 0, 'scene': 'opening'}]),
        'unknown scene': v(triggers=[{'x': 1, 'y': 1, 'scene': 'nope'}]),
        'spawn blocked': v(spawn={'x': 0, 'y': 0}),
        'monster on a wall': v(monsters=[{'id': 'm1', 'kind': 'monster', 'x': 0, 'y': 0}]),
        'bad monster kind': v(monsters=[{'id': 'm1', 'kind': 'dragon', 'x': 1, 'y': 1}]),
        'locked door without a lock': v(mask=['#####', '#...#', '#.L.#', '#####']),
        'lock without a flag': v(mask=['#####', '#...#', '#.L.#', '#####'], locks=[{'x': 2, 'y': 2, 'flag': ''}]),
        'bad id': v(id='Bad Id'),
        'index id': v(id='index'),
        'empty mask': v(mask=[]),
    }
    ids = sorted(ia.builtin_ids(tmp)); scenes = sorted(ia.story_scenes(tmp))
    js = ("const fs=require('fs');eval(fs.readFileSync(process.argv[1],'utf8')+';globalThis.__c=checkAreaSpec;');"
          "const [cases,env]=JSON.parse(fs.readFileSync(0,'utf8'));const out={};for(const k in cases)out[k]=__c(cases[k],env);console.log(JSON.stringify(out));")
    env = {'ids': ids, 'scenes': scenes, 'kinds': list(ia.ENEMY_KINDS)}
    r = subprocess.run(['node', '-e', js, f'{tmp}/engine/areacheck.js'], input=json.dumps([cases, env]), capture_output=True, text=True)
    if r.returncode != 0:
        check('JS area check runs under node', False, r.stderr); return
    jsout = json.loads(r.stdout)
    norm = lambda msgs: sorted(m.replace("'", '"') for m in msgs)
    for name, spec in cases.items():
        py = ia.check(spec, tmp, set())
        check(f'area check parity (JS = Python): {name}', norm(py) == norm(jsout[name]), (py, jsout[name]))
    check('area check: the sound spec has no problems in either', not jsout['sound'] and not ia.check(cases['sound'], tmp, set()))


def heads_part(tmp, browser):
    for name, size in {'portrait': (390, 844), 'landscape': (844, 390)}.items():
        repo, calls = {}, {'puts': [], 'deletes': []}
        seed(repo, tmp, 'tools/sprite-bake/heights.json', 'art/chars/grey-battle.png', 'art/chars/grey-walk.png', 'art/chars/grey.json')
        saved0 = jget(repo, 'tools/sprite-bake/heights.json')
        ctx, page, errors = admin_page(browser, size, repo, calls, 'heads.html')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Loaded')", timeout=10000)
        check(f'heads {name}: loads the saved multiplier', abs(float(page.input_value('#head')) - saved0['head']) < 1e-6, page.input_value('#head'))
        check(f'heads {name}: lists the baked character', 'grey' in page.eval_on_selector_all('#who option', 'els => els.map(e => e.value)'))
        page.select_option('#who', 'grey')
        time.sleep(0.4)
        page.screenshot(path=f'{SHOTS}/heads-{name}-1.png')
        check(f'heads {name}: the preview finds the baked sheet', 'Baked sheet shown' in page.inner_text('#pvnote'), page.inner_text('#pvnote'))
        drawn = page.evaluate("() => { const c=document.getElementById('pv'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n; }")
        check(f'heads {name}: the preview draws something', drawn > 500, drawn)
        page.evaluate("() => { const e=document.getElementById('head'); e.value='0.8'; e.dispatchEvent(new Event('input')); }")
        page.fill('#dbattle', '60')
        page.fill('#newid', 'hero'); page.click('#add')
        page.locator('#rows .pair[data-name="hero"] input[data-k="battle"]').fill('80')
        check(f'heads {name}: the multiplier label follows the slider', page.inner_text('#headval') == '0.80')
        page.click('#save')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Saved')", timeout=10000)
        h = jget(repo, 'tools/sprite-bake/heights.json')
        check(f'heads {name}: Save writes the new multiplier and defaults', abs(h['head'] - 0.8) < 1e-6 and h['default']['battle'] == 60 and h['default']['walk'] == saved0['default']['walk'], h)
        check(f'heads {name}: Save keeps other characters and adds the new one', h['heights'].get('hero', {}).get('battle') == 80 and h['heights'].get('grey') == saved0['heights'].get('grey'), h['heights'])
        check(f'heads {name}: Save keeps head_frac', h['head_frac'] == saved0['head_frac'])
        n = len(calls['puts'])
        page.evaluate("() => { __HEADS.st.data.head=9; }")
        page.click('#save')
        check(f'heads {name}: an out-of-range multiplier is refused and nothing is written', 'between' in page.inner_text('#status') and len(calls['puts']) == n, page.inner_text('#status'))
        page.evaluate("() => { __HEADS.st.data.head=0.8; }")
        page.click('#reload')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Loaded')", timeout=10000)
        check(f'heads {name}: Reload shows the saved values', abs(float(page.input_value('#head')) - 0.8) < 1e-6 and page.input_value('#dbattle') == '60')
        page.screenshot(path=f'{SHOTS}/heads-{name}-2.png')
        check(f'heads {name}: no console errors', not [e for e in errors if 'status of 404' not in e], errors)
        ctx.close()


def portraits_part(tmp, browser):
    # a two-colour source picture on the site: left half red, right half blue
    im = Image.new('RGB', (200, 100), (200, 30, 30)); ImageDraw.Draw(im).rectangle((100, 0, 199, 99), fill=(30, 30, 200)); im.save(f'{tmp}/art/test-grey-figure.png')
    for name, size in {'portrait': (390, 844), 'landscape': (844, 390)}.items():
        repo, calls = {}, {'puts': [], 'deletes': []}
        repo['data/art-ingame.json'] = {'content': base64.b64encode(json.dumps({'installed': {'test-grey-figure': {'path': 'art/test-grey-figure.png'}}}).encode()).decode(), 'sha': 's0'}
        ctx, page, errors = admin_page(browser, size, repo, calls, 'portraits.html')
        page.wait_for_selector('.item')
        page.click('.item')
        page.wait_for_selector('#work:not([hidden])')
        time.sleep(0.3)
        px = lambda x, y: page.evaluate(f"() => Array.from(document.getElementById('out').getContext('2d').getImageData({x},{y},1,1).data)")
        l, r = px(10, 128), px(245, 128)
        check(f'portraits {name}: full-height square at the middle shows red on the left and blue on the right', l[0] > 150 and r[2] > 150, (l, r))
        page.screenshot(path=f'{SHOTS}/portraits-{name}-1.png')
        page.evaluate("() => { const z=document.getElementById('zoom'); z.value='3'; z.dispatchEvent(new Event('input')); }")
        page.locator('#crop').scroll_into_view_if_needed()
        box = page.locator('#crop').bounding_box()
        cx0 = page.evaluate('() => __PORTRAITS.st.cx')
        y = box['y'] + box['height'] / 2
        page.mouse.move(box['x'] + box['width'] / 2, y); page.mouse.down(); page.mouse.move(box['x'] + box['width'] / 2 - 120, y, steps=6); page.mouse.up()
        cx1 = page.evaluate('() => __PORTRAITS.st.cx')
        check(f'portraits {name}: dragging moves the square', cx1 < cx0 - 0.1, (cx0, cx1))
        c = px(128, 128)
        check(f'portraits {name}: zoomed in on the left half the result is red', c[0] > 150 and c[2] < 80, c)
        page.screenshot(path=f'{SHOTS}/portraits-{name}-2.png')
        page.fill('#pname', 'hero')
        page.click('#save')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Saved')", timeout=10000)
        png = Image.open(io.BytesIO(base64.b64decode(repo['art/portraits/hero.png']['content'])))
        check(f'portraits {name}: Save commits a 256 x 256 PNG', png.size == (256, 256) and png.format == 'PNG', (png.size, png.format))
        check(f'portraits {name}: the saved crop is the red part', png.convert('RGB').getpixel((128, 128))[0] > 150)
        lst = jget(repo, 'data/portraits.json')
        check(f'portraits {name}: Save lists the portrait with its source and crop', lst['portraits']['hero']['source'] == 'art/test-grey-figure.png' and lst['portraits']['hero']['crop']['zoom'] == 3, lst)
        check(f'portraits {name}: the saved list shows it', page.locator('#saved .item').count() == 1)
        page.click('#remove')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Removed')", timeout=10000)
        check(f'portraits {name}: Remove deletes the file and the list entry', 'art/portraits/hero.png' not in repo and 'hero' not in jget(repo, 'data/portraits.json')['portraits'] and calls['deletes'] == ['art/portraits/hero.png'], calls)
        page.fill('#pname', 'Bad Name!')
        n = len(calls['puts']); page.click('#save')
        check(f'portraits {name}: a bad name is refused', 'letters' in page.inner_text('#status') and len(calls['puts']) == n)
        check(f'portraits {name}: no console errors', not [e for e in errors if 'status of 404' not in e], errors)
        ctx.close()
    os.remove(f'{tmp}/art/test-grey-figure.png')


def areas_part(tmp, browser):
    """Area editor against stubbed GitHub. Edits an installed area with a picture, a built-in grey area and a new area; the saved files are then
    copied into the served copy (as a deploy would) and the game must walk the new masks."""
    saved_files = {}
    for name, size in {'portrait': (390, 844), 'landscape': (844, 390)}.items():
        repo, calls = {}, {'puts': [], 'deletes': []}
        seed(repo, tmp, 'data/areas/index.json', 'data/areas/test-room.json')
        ctx, page, errors = admin_page(browser, size, repo, calls, 'areas.html')
        page.wait_for_function("() => document.querySelectorAll('#area option').length > 4", timeout=10000)
        opts = page.eval_on_selector_all('#area option', 'els => els.map(e => e.value)')
        check(f'areas {name}: lists built-in and installed areas', {'town', 'field', 'room', 'roomb', 'test-room'} <= set(opts), opts)
        page.select_option('#area', 'test-room')
        page.wait_for_selector('#editor:not([hidden])')
        time.sleep(0.4)
        page.screenshot(path=f'{SHOTS}/areas-{name}-1-open.png')
        check(f'areas {name}: opening an installed area shows no problems', 'No problems' in page.inner_text('#problems'), page.inner_text('#problems'))
        # paint one wall tile with a real tap, one with the API, then a drag across three floor tiles
        def tile(x, y):
            page.locator('#cv').scroll_into_view_if_needed()
            page.evaluate("() => document.getElementById('cv').scrollIntoView({block:'center'})")
            b, ts = page.locator('#cv').bounding_box(), page.evaluate('() => __AREAS.st.ts')
            return b['x'] + (x + .5) * ts, b['y'] + (y + .5) * ts
        page.click('#tools [data-tool="#"]')
        tx, ty = tile(3, 3); page.mouse.click(tx, ty)
        check(f'areas {name}: a tap with WALL paints a wall tile', page.evaluate("() => __AREAS.st.spec.mask[3][3]") == '#' and page.evaluate("() => __AREAS.st.sel.x") == 3)
        a, b = tile(7, 6), tile(9, 6)
        page.mouse.move(*a); page.mouse.down(); page.mouse.move(*b, steps=8); page.mouse.up()
        row = page.evaluate("() => __AREAS.st.spec.mask[6]")
        check(f'areas {name}: dragging paints a row of walls', row[7:10] == '###', row)
        page.screenshot(path=f'{SHOTS}/areas-{name}-2-painted.png')
        # a door with a target
        page.click('#tools [data-tool="D"]'); page.mouse.click(*tile(8, 2))
        check(f'areas {name}: a DOOR tile gets a portal entry and the panel shows where it leads', page.locator('#panel select[data-f="to"]').count() == 1 and page.evaluate("() => __AREAS.st.spec.portals.length") == 2)
        page.select_option('#panel select[data-f="to"]', 'room')
        sp = page.evaluate("() => __AREAS.st.spec.portals.find(p=>p.x===8&&p.y===2)")
        check(f'areas {name}: choosing the target takes that area\'s spawn point', sp['to'] == 'room' and sp['spawn'] == {'x': 5, 'y': 6}, sp)
        # a locked door needs a flag
        page.click('#tools [data-tool="L"]'); page.mouse.click(*tile(10, 2))
        page.locator('#panel select[data-f="to"]').select_option('roomb')
        check(f'areas {name}: a LOCKED tile starts with a known flag', page.input_value('#panel input[data-f="flag"]') == 'door-open')
        page.fill('#panel input[data-f="flag"]', '')
        check(f'areas {name}: a LOCKED tile with no flag is a problem', 'has no flag' in page.inner_text('#problems'), page.inner_text('#problems'))
        page.fill('#panel input[data-f="flag"]', 'door-open')
        # a spawn on a wall must stop the save
        page.click('#tools [data-tool="spawn"]'); page.mouse.click(*tile(3, 3))
        n = len(calls['puts']); page.click('#save')
        check(f'areas {name}: a blocked spawn refuses the save and writes nothing', 'spawn is blocked' in page.inner_text('#status') and len(calls['puts']) == n, page.inner_text('#status'))
        page.click('#tools [data-tool="spawn"]'); page.mouse.click(*tile(5, 6))
        check(f'areas {name}: with the spawn fixed there are no problems', 'No problems' in page.inner_text('#problems'), page.inner_text('#problems'))
        page.click('#save')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Saved')", timeout=10000)
        d = jget(repo, 'data/areas/test-room.json')
        check(f'areas {name}: Save writes the painted mask', d['mask'][3][3] == '#' and d['mask'][6][7:10] == '###' and d['mask'][2][8] == 'D' and d['mask'][2][10] == 'L', d['mask'])
        check(f'areas {name}: Save keeps the picture path and writes portals and locks', d['art'] == 'art/areas/test-room.png' and {(p['x'], p['y'], p['to']) for p in d['portals']} >= {(8, 2, 'room'), (10, 2, 'roomb')} and d['locks'] == [{'x': 10, 'y': 2, 'flag': 'door-open'}], d)
        idx = jget(repo, 'data/areas/index.json')
        check(f'areas {name}: Save updates the list with a fresh cache tag', idx['areas'] == ['test-room'] and idx['tag'] not in ('0', json.loads(base64.b64decode(base64.b64encode(open(f"{tmp}/data/areas/index.json", "rb").read())))['tag']), idx)
        # undo restores the saved state
        page.click('#tools [data-tool="#"]'); page.mouse.click(*tile(4, 4)); page.click('#revert')
        check(f'areas {name}: UNDO ALL CHANGES goes back to the last saved state', page.evaluate("() => __AREAS.st.spec.mask[4][4]") == '.')
        # a built-in grey area can be opened and saved as an override
        page.select_option('#area', 'room')
        page.wait_for_function("() => __AREAS.st.spec.id === 'room'")
        check(f'areas {name}: a built-in area opens with its mask, portals and spawn', page.evaluate("() => __AREAS.st.spec.portals.length") == 1 and page.evaluate("() => __AREAS.st.spec.mask[7][5]") == 'M')
        page.click('#tools [data-tool="#"]'); page.mouse.click(*tile(7, 3))
        page.click('#save')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Saved')", timeout=10000)
        check(f'areas {name}: saving a built-in area writes data/areas/room.json and lists it', jget(repo, 'data/areas/room.json')['mask'][3][7] == '#' and 'room' in jget(repo, 'data/areas/index.json')['areas'])
        # a new area
        page.evaluate("() => { document.querySelector('details').open = true; }")
        page.fill('#nid', 'new-hall'); page.fill('#nname', 'NEW HALL'); page.fill('#nw', '9'); page.fill('#nh', '7')
        page.click('#mk')
        page.wait_for_function("() => __AREAS.st.spec.id === 'new-hall'")
        check(f'areas {name}: CREATE makes a walled area with a valid spawn', page.evaluate("() => __AREAS.st.spec.mask.length") == 7 and 'No problems' in page.inner_text('#problems'))
        page.fill('#nid', 'index'); page.click('#mk')
        check(f'areas {name}: the id index is refused and no area is made', 'cannot be' in page.inner_text('#status') and page.evaluate("() => __AREAS.st.spec.id") == 'new-hall' and page.evaluate("() => !('index' in AREAS)"), page.inner_text('#status'))
        page.click('#save')
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Saved')", timeout=10000)
        check(f'areas {name}: the new area is saved and listed', 'data/areas/new-hall.json' in repo and set(jget(repo, 'data/areas/index.json')['areas']) == {'test-room', 'room', 'new-hall'})
        page.screenshot(path=f'{SHOTS}/areas-{name}-3-new.png')
        check(f'areas {name}: no console errors', not [e for e in errors if 'status of 404' not in e], errors)
        saved_files = {p: base64.b64decode(v['content']) for p, v in repo.items() if p.startswith('data/areas/')}
        ctx.close()
    # deploy: put the saved files where the game is served from, then play them
    for p, content in saved_files.items():
        open(f'{tmp}/{p}', 'wb').write(content)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_function('() => window.__FFIV && __FFIV.ready', timeout=15000)
    check('game: an area saved by the editor is read at boot (new wall is not walkable)', page.evaluate("() => walkable(AREAS['test-room'],3,3)") is False and page.evaluate("() => walkable(AREAS['test-room'],3,4)") is True)
    page.evaluate("() => { game.mode='play'; setArea('test-room',{x:3,y:4}); }")
    page.evaluate("() => tryStep('up')"); time.sleep(0.4)
    check('game: the hero cannot step onto the painted wall', page.evaluate("() => __FFIV.walker.y") == 4)
    page.evaluate("() => tryStep('left')"); time.sleep(0.4)
    check('game: the hero can still walk on floor beside it', page.evaluate("() => __FFIV.walker.x") == 2)
    check('game: the saved built-in override replaced the grey area', page.evaluate("() => AREAS['room'].grid[3][7]") == '#')
    check('game: the new area exists with its name', page.evaluate("() => AREAS['new-hall'] && AREAS['new-hall'].name") == 'NEW HALL')
    check('game: the edited world passes validateWorld()', page.evaluate('() => validateWorld()') == [], page.evaluate('() => validateWorld()'))
    page.evaluate("() => { game.mode='play'; setArea('test-room',{x:5,y:6}); }")
    page.evaluate("() => { game.camX=0; game.camY=0; }")
    time.sleep(0.4)
    page.screenshot(path=f'{SHOTS}/areas-game-after-edit.png')
    check('game: no console errors', not errors, errors)
    ctx.close()
    # no index.json: the game still starts, with the built-in areas
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    ctx.route('**/data/areas/index.json*', lambda route: route.fulfill(status=404, body='nope'))
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_function('() => window.__FFIV && __FFIV.ready', timeout=15000)
    check('game: a missing list does not stop it, built-in areas only', page.evaluate("() => !!AREAS['town'] && !AREAS['test-room']") and page.evaluate('() => __FFIV.areasNote') != '' and page.evaluate('() => __FFIV.mode') == 'title' and not errors, (page.evaluate('() => __FFIV.areasNote'), errors))
    ctx.close()
    # clean up the served copy so the final removal check starts from the installer's own files
    for f in ('room.json', 'new-hall.json'):
        os.remove(f'{tmp}/data/areas/{f}')


def main():
    os.makedirs(SHOTS, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='ffiv-tools-')
    work = tempfile.mkdtemp(prefix='ffiv-work-')
    shutil.copytree(ROOT, tmp, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.git', '__pycache__'))
    tools_part(tmp, work)
    installer_part(tmp, work)
    parity_part(tmp)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=tmp, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_port(PORT)
        with sync_playwright() as p:
            kw = {'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}
            browser = p.chromium.launch(args=['--no-sandbox'], **kw)
            game_part(tmp, browser)
            art_part(tmp, browser)
            heads_part(tmp, browser)
            portraits_part(tmp, browser)
            areas_part(tmp, browser)
            browser.close()
        # remove purges everything
        r = run([sys.executable, 'tools/install_area.py', '--remove', 'test-room', '--root', tmp], tmp)
        check('installer --remove purges the picture and the data', r.returncode == 0 and not os.listdir(f'{tmp}/art/areas') and not os.path.exists(f'{tmp}/data/areas/test-room.json'), r.stdout + r.stderr)
        idx = json.load(open(f'{tmp}/data/areas/index.json'))
        check('index.json is empty again after removal', idx['areas'] == [] and idx['tag'] == '0', idx)
    finally:
        srv.terminate()
        shutil.rmtree(tmp, ignore_errors=True); shutil.rmtree(work, ignore_errors=True)
    fails = results.count(False)
    print(f'\n{len(results) - fails}/{len(results)} passed')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
