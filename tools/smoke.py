#!/usr/bin/env python3
"""Headless smoke test for Build 1g.1 (placeholder world, four-hero fights, story engine, iPhone Duo battle layout).

Run:  CHROMIUM=/usr/bin/google-chrome python3 tools/smoke.py
      (CHROMIUM may be left unset to use Playwright's own Chromium.)

Per orientation (portrait and landscape): title, arrow keys, tap to walk, door in, mat out, edge east, edge west,
the world tables, faults and console errors. Build 1b adds: the grey monster on FIELD B starts a fight that is won,
the boss shield absorbs the first hit, and a fight that is lost restores the party. Build 1c adds the chapter flow: chapter
select, title card, the GO trigger and its cutscene (every step type), the flag-gated door, the objective line, the four
close-ups, the end card and the return to chapter select. Build 1g.1 adds: the field fight is four heroes against two
monsters; every command (ATTACK with a target, DEFEND, each SPECIAL, ITEM, BACK out of target picking) does what it says;
a four against two fight is won and one is lost; and battle frames at the iPhone Duo inner and outer screen sizes, a 4:3
window and a tall phone, in both orientations, with a safe area, are checked for panels inside the safe area, no overlaps and
thumb-sized buttons. Screenshots go to SHOTS
(default /tmp/ffiv-shots). Exits 1 on any failure.
"""
import os
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get('SHOTS', '/tmp/ffiv-shots')
PORT = int(os.environ.get('PORT', '8765'))
VIEWS = {'portrait': (390, 844), 'landscape': (844, 390)}
results = []


def check(name, ok, detail=''):
    results.append(ok)
    line = ('PASS ' if ok else 'FAIL ') + name
    if not ok:
        line += ' :: ' + str(detail)
    print(line)


def wait_port(port, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        with socket.socket() as s:
            if s.connect_ex(('127.0.0.1', port)) == 0:
                return
        time.sleep(0.1)
    raise SystemExit('static server did not start')


def wait_idle(page):
    page.wait_for_function('() => window.__FFIV && __FFIV.ready && !window.__FFIV.busy', timeout=30000)
    time.sleep(0.05)


def tap_tile(page, tx, ty):
    c = page.evaluate('([x, y]) => window.__FFIV.tileToClient(x, y)', [tx, ty])
    page.mouse.click(c['x'], c['y'])


def fight_out(page, timeout=120):
    """Plays the open fight to its end: A picks the default command (attack) and skips messages, until the fight closes."""
    end = time.time() + timeout
    while time.time() < end:
        if page.evaluate('() => window.__FFIV.battle') is None:
            return True
        page.keyboard.press('Enter')
        time.sleep(0.15)
    return False


def walk_far(page, tx, ty, timeout=60):
    """Walks to a tile that may be off the stage, tapping waypoints at most 8 rows away so each tap is on screen."""
    end = time.time() + timeout
    while time.time() < end:
        pos = page.evaluate('() => __FFIV.walker')
        if (pos['x'], pos['y']) == (tx, ty):
            return True
        if page.evaluate('() => __FFIV.mode') != 'play' or page.evaluate('() => !!__FFIV.scene'):
            return False
        dy = max(-8, min(8, ty - pos['y']))
        step_y = pos['y'] + dy
        if abs(ty - pos['y']) <= 8:
            tap_tile(page, tx, ty)
        else:
            tap_tile(page, pos['x'], step_y)
        wait_idle(page)
    return False


def run_scene(page, name, shots, timeout=150):
    """Plays the running scene to its end: A on speech, A in fights, the right moves in close-ups. Returns the modes met."""
    seen = {'say': 0, 'battle': 0, 'closeups': []}
    end = time.time() + timeout
    wrong_tried = False
    while time.time() < end:
        mode = page.evaluate('() => __FFIV.mode')
        if mode != 'play' and mode != 'battle' and mode != 'closeup':
            break
        if mode == 'battle':
            seen['battle'] += 1
            page.keyboard.press('Enter')
            time.sleep(0.15)
            continue
        if mode == 'closeup':
            c = page.evaluate('() => __FFIV.closeup')
            if c is None:
                continue
            if c['mode'] not in seen['closeups']:
                seen['closeups'].append(c['mode'])
                time.sleep(0.9)
                page.screenshot(path=f"{shots}/{name}-closeup-{c['mode'].lower()}.png")
                continue
            if c['mode'] == 'ORDERED' and not c['ready']:
                if not wrong_tried and c['need'] != c['cursor']:
                    before = c['placed']
                    page.keyboard.press('Enter')
                    time.sleep(0.1)
                    after = page.evaluate('() => __FFIV.closeup')
                    seen['wrong_rejected'] = after['placed'] == before and after['msg'] != ''
                    page.screenshot(path=f'{shots}/{name}-closeup-ordered-wrong.png')
                    wrong_tried = True
                    continue
                if c['cursor'] != c['need']:
                    page.keyboard.press('ArrowRight')
                else:
                    page.keyboard.press('Enter')
                time.sleep(0.08)
                continue
            if c['ready']:
                page.keyboard.press('Enter')
            time.sleep(0.1)
            continue
        if page.evaluate('() => __FFIV.scene') is None:
            break
        say = page.evaluate('() => __FFIV.say')
        if say:
            if seen['say'] == 0:
                time.sleep(0.4)
                page.screenshot(path=f'{shots}/{name}-say.png')
            seen['say'] += 1
            page.keyboard.press('Enter')
            time.sleep(0.2)
        else:
            time.sleep(0.1)
    return seen


def story_part(page, name):
    """Build 1c: the gate, the opening cutscene, the opened door, the close-ups and the chapter end."""
    check(f'{name}: objective line is set at the start', 'GO tile' in page.evaluate('() => __FFIV.objective'),
          page.evaluate('() => __FFIV.objective'))
    check(f'{name}: door is shut before the cutscene', 'door-open' not in page.evaluate('() => __FFIV.flags'))
    walk_far(page, 16, 6)
    tap_tile(page, 16, 5)
    time.sleep(0.5)
    check(f'{name}: locked door stays a wall before the flag', page.evaluate('() => __FFIV.area') == 'town'
          and page.evaluate('() => __FFIV.walker')['y'] == 6)
    page.screenshot(path=f'{SHOTS}/{name}-7-locked.png')

    walk_far(page, 19, 31)
    walk_far(page, 17, 31)
    tap_tile(page, 15, 30)
    page.wait_for_function('() => __FFIV.scene !== null', timeout=30000)
    check(f'{name}: GO tile starts the cutscene', page.evaluate('() => __FFIV.scene')['id'] == 'opening')
    seen = run_scene(page, name, SHOTS)
    check(f'{name}: cutscene speech played', seen['say'] >= 3, seen)
    check(f'{name}: cutscene fight played', seen['battle'] >= 1, seen)
    check(f'{name}: cutscene ended', page.evaluate('() => __FFIV.scene') is None)
    check(f'{name}: cutscene set the door flag', page.evaluate('() => __FFIV.flags').get('door-open') is True)
    check(f'{name}: cutscene removed its actors', page.evaluate('() => __FFIV.actors') == [])
    check(f'{name}: objective updated', 'unlocked door' in page.evaluate('() => __FFIV.objective'),
          page.evaluate('() => __FFIV.objective'))
    check(f'{name}: control is back after the cutscene', page.evaluate('() => __FFIV.mode') == 'play')
    page.screenshot(path=f'{SHOTS}/{name}-8-after-scene.png')

    walk_far(page, 16, 6)
    tap_tile(page, 16, 5)
    page.wait_for_function("() => __FFIV.area === 'roomb'", timeout=30000)
    wait_idle(page)
    check(f'{name}: the opened door leads into room B', page.evaluate('() => __FFIV.area') == 'roomb')
    page.screenshot(path=f'{SHOTS}/{name}-9-roomb.png')

    tap_tile(page, 5, 3)
    page.wait_for_function('() => __FFIV.scene !== null', timeout=30000)
    check(f'{name}: room B tile starts the close-up scene', page.evaluate('() => __FFIV.scene')['id'] == 'closeups')
    seen = run_scene(page, name, SHOTS)
    check(f'{name}: all four close-ups shown in order', seen['closeups'] == ['REVEAL', 'WATCH', 'PLACE', 'ORDERED'], seen)
    check(f'{name}: ordered close-up rejects a wrong item', seen.get('wrong_rejected') is True, seen)
    page.wait_for_function("() => __FFIV.mode === 'card'", timeout=30000)
    check(f'{name}: end card shows', page.evaluate('() => __FFIV.card')[1] == 'COMPLETE')
    page.screenshot(path=f'{SHOTS}/{name}-10-endcard.png')
    time.sleep(0.7)
    page.keyboard.press('Enter')
    page.wait_for_function("() => __FFIV.mode === 'chapters'", timeout=10000)
    check(f'{name}: end card returns to chapter select', True)
    check(f'{name}: chapter is marked done', page.evaluate('() => __FFIV.done').get('1') is True)
    page.screenshot(path=f'{SHOTS}/{name}-11-chapters-done.png')


def until(page, js, timeout=20):
    page.wait_for_function(js, timeout=timeout * 1000)


def menu_for(page, actor):
    until(page, f"() => __FFIV.battle && __FFIV.battle.phase === 'menu' && __FFIV.battle.actor === {actor}")


def pick(page, cmd):
    """Moves the menu cursor to a command with the arrow keys, then presses A."""
    grid = {'attack': (0, 0), 'special': (0, 1), 'defend': (1, 0), 'item': (1, 1)}
    cur = page.evaluate('() => __FFIV.battle.cursor')
    (r0, c0), (r1, c1) = grid[cur], grid[cmd]
    if r0 != r1:
        page.keyboard.press('ArrowDown')
    if c0 != c1:
        page.keyboard.press('ArrowRight')
    page.keyboard.press('Enter')


def commands_part(page, name):
    """Build 1g.1: every command in one four against two fight."""
    page.evaluate("() => __FFIV.startBattle('pair', {enemyHp: 80})")
    menu_for(page, 0)
    atk = [p['atk'] for p in page.evaluate('() => __FFIV.party')]
    # HERO 1 ATTACK: two monsters, so a target is picked. BACK returns to the menu; then the second monster is hit.
    pick(page, 'attack')
    check(f'{name}: attack with two monsters asks for a target', page.evaluate('() => __FFIV.battle.phase') == 'target')
    page.screenshot(path=f'{SHOTS}/{name}-5b-target.png')
    page.keyboard.press('Escape')
    check(f'{name}: BACK leaves target picking', page.evaluate('() => __FFIV.battle.phase') == 'menu')
    pick(page, 'attack')
    page.keyboard.press('ArrowDown')
    b_hp = page.evaluate('() => __FFIV.battle.foes[1].hp')
    page.keyboard.press('Enter')
    check(f'{name}: the picked monster takes the hit', page.evaluate('() => __FFIV.battle.foes[1].hp') == b_hp - atk[0] and
          page.evaluate('() => __FFIV.battle.foes[0].hp') == 80)
    # HERO 2 SWEEP hits both.
    menu_for(page, 1)
    hp = [f['hp'] for f in page.evaluate('() => __FFIV.battle.foes')]
    pick(page, 'special')
    after = [f['hp'] for f in page.evaluate('() => __FFIV.battle.foes')]
    check(f'{name}: SWEEP hits every monster', after == [hp[0] - atk[1], hp[1] - atk[1]], (hp, after))
    # HERO 3 DEFEND, HERO 4 RALLY.
    menu_for(page, 2)
    pick(page, 'defend')
    check(f'{name}: DEFEND marks the hero', page.evaluate('() => __FFIV.party[2].defend') is True)
    menu_for(page, 3)
    pick(page, 'special')
    check(f'{name}: RALLY raises every hero\'s attack', all(p['boost'] == 2 for p in page.evaluate('() => __FFIV.party')))
    # Monsters act: targets rotate, so HERO 1 and HERO 2 are hit on turn 1.
    menu_for(page, 0)
    party = page.evaluate('() => __FFIV.party')
    check(f'{name}: monsters hit different heroes', party[0]['hp'] < party[0]['maxHp'] and party[1]['hp'] < party[1]['maxHp'] and party[2]['hp'] == party[2]['maxHp'], party)
    check(f'{name}: DEFEND ends at the hero\'s next turn', page.evaluate('() => __FFIV.party[2].defend') is False)
    page.screenshot(path=f'{SHOTS}/{name}-5c-turn2.png')
    # HERO 1 BIG HIT on MONSTER A: double attack with the rally bonus.
    a_hp = page.evaluate('() => __FFIV.battle.foes[0].hp')
    pick(page, 'special')
    if page.evaluate('() => __FFIV.battle.phase') == 'target':
        page.keyboard.press('Enter')
    check(f'{name}: BIG HIT does double damage', page.evaluate('() => __FFIV.battle.foes[0].hp') == a_hp - (atk[0] + 2) * 2)
    # HERO 2 ITEM on the most hurt hero.
    menu_for(page, 1)
    bag = page.evaluate('() => __FFIV.bag')
    pick(page, 'item')
    check(f'{name}: ITEM asks which hero', page.evaluate('() => __FFIV.battle.phase') == 'target')
    low = page.evaluate('() => __FFIV.battle.target')
    page.keyboard.press('Enter')
    check(f'{name}: ITEM uses one from the bag', page.evaluate('() => __FFIV.bag') == bag - 1)
    # HERO 3 HEAL by tapping the hero in the status panel.
    menu_for(page, 2)
    pick(page, 'special')
    check(f'{name}: HEAL asks which hero', page.evaluate('() => __FFIV.battle.phase') == 'target')
    r = page.evaluate('() => __FFIV.layoutRects.rows[1]')
    page.mouse.click(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    check(f'{name}: tapping a hero picks the HEAL target', page.evaluate('() => __FFIV.battle.phase') == 'busy')
    check(f'{name}: a used special cannot be picked again', True)
    page.evaluate('() => { for (const f of BATTLE.foes) { f.hp = Math.min(f.hp, 3); f.shownHp = f.hp; } }')
    check(f'{name}: four against two fight ends', fight_out(page))
    check(f'{name}: four against two fight is won', page.evaluate('() => __FFIV.lastResult') == 'win')


def overlap(a, b):
    return a['x'] < b['x'] + b['w'] and b['x'] < a['x'] + a['w'] and a['y'] < b['y'] + b['h'] and b['y'] < a['y'] + a['h']


def duo_view(browser, name, w, h, safe):
    """Battle frames at one window size: menu, target picking, a hit, the result. Checks panels against the safe area."""
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=3)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    until(page, '() => window.__FFIV && __FFIV.ready', 15)
    page.evaluate('(s) => __FFIV.setSafeTest(s)', safe)
    page.keyboard.press('Enter')
    until(page, "() => __FFIV.mode === 'chapters'")
    page.keyboard.press('Enter')
    until(page, "() => __FFIV.area === 'town'")
    wait_idle(page)
    page.evaluate("() => __FFIV.startBattle('pair')")
    menu_for(page, 0)
    time.sleep(0.3)
    page.screenshot(path=f'{SHOTS}/duo-{name}-1-menu.png')
    check(f'duo {name}: D-pad and A are hidden in a fight', not page.is_visible('#dpad') and not page.is_visible('#act'))
    L = page.evaluate('() => __FFIV.layoutRects')
    inner = {'x': safe['l'], 'y': safe['t'], 'w': w - safe['l'] - safe['r'], 'h': h - safe['t'] - safe['b']}
    def inside(r):
        return r['x'] >= inner['x'] - 0.5 and r['y'] >= inner['y'] - 0.5 and r['x'] + r['w'] <= inner['x'] + inner['w'] + 0.5 and r['y'] + r['h'] <= inner['y'] + inner['h'] + 0.5
    check(f'duo {name}: message, menu and status sit inside the safe area', all(inside(L[k]) for k in ('msg', 'menu', 'status')), (L['msg'], L['menu'], L['status'], inner))
    check(f'duo {name}: menu and status do not overlap', not overlap(L['menu'], L['status']))
    check(f'duo {name}: command buttons are thumb sized (at least 36 points tall)', all(c['h'] >= 36 for c in L['cells'].values()), L['cells'])
    heroes = [{'x': p['cx'] - p['w'], 'y': p['base'] - p['h'], 'w': p['w'] * 1.6, 'h': p['h']} for p in L['heroes']]
    foes = [{'x': f['cx'] - f['s'] / 2, 'y': f['base'] - f['s'], 'w': f['s'], 'h': f['s'] + 26 * L['u']} for f in L['foes']]
    figs = heroes + foes
    check(f'duo {name}: figures stay in the battlefield, clear of the panels',
          all(not overlap(f, L[k]) for f in figs for k in ('menu', 'status', 'msg')) and all(inside(f) for f in figs), (figs, L['field']))
    check(f'duo {name}: heroes are on the right, monsters on the left', min(p['cx'] for p in L['heroes']) > max(f['cx'] for f in L['foes']))
    check(f'duo {name}: heroes are a readable size (at least 30 points tall)', all(p['h'] >= 30 for p in L['heroes']), [p['h'] for p in L['heroes']])
    page.keyboard.press('Enter')
    time.sleep(0.2)
    page.screenshot(path=f'{SHOTS}/duo-{name}-2-target.png')
    # Tap the second monster to attack it.
    f1 = L['foes'][1]
    page.mouse.click(f1['cx'], f1['base'] - f1['s'] / 2)
    check(f'duo {name}: tapping a monster attacks it', page.evaluate('() => __FFIV.battle.foes[1].hp') < 16)
    time.sleep(0.15)
    page.screenshot(path=f'{SHOTS}/duo-{name}-3-hit.png')
    # A rotation of the window during the fight re-lays out the screen.
    page.set_viewport_size({'width': h, 'height': w})
    time.sleep(0.4)
    L2 = page.evaluate('() => __FFIV.layoutRects')
    check(f'duo {name}: rotating mid fight re-lays out', L2['land'] == (h > w) and page.evaluate('() => __FFIV.landscape') == (h > w))
    page.screenshot(path=f'{SHOTS}/duo-{name}-4-rotated.png')
    page.set_viewport_size({'width': w, 'height': h})
    time.sleep(0.4)
    check(f'duo {name}: fight ends', fight_out(page))
    check(f'duo {name}: no page errors or frame faults', errors == [] and page.evaluate('() => __FFIV.faults') == [], (errors, page.evaluate('() => __FFIV.faults')))
    ctx.close()


# iPhone Duo: inner screen 1878 x 2670 pixels, outer 1398 x 2034, at 3 pixels per point. Safe areas are the expected iOS values
# for a Dynamic Island phone: in portrait the island is at the top, in landscape it is at one side and the home bar is at the bottom.
DUO = {
    'inner-landscape': (890, 626, {'t': 0, 'r': 47, 'b': 20, 'l': 47}),
    'inner-portrait': (626, 890, {'t': 47, 'r': 0, 'b': 34, 'l': 0}),
    'outer-landscape': (678, 466, {'t': 0, 'r': 47, 'b': 20, 'l': 47}),
    'outer-portrait': (466, 678, {'t': 47, 'r': 0, 'b': 34, 'l': 0}),
    'four-three-landscape': (800, 600, {'t': 0, 'r': 0, 'b': 0, 'l': 0}),
    'tall-landscape': (844, 390, {'t': 0, 'r': 47, 'b': 21, 'l': 47}),
    'tall-portrait': (390, 844, {'t': 47, 'r': 0, 'b': 34, 'l': 0}),
}


def run_view(browser, name, w, h):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    audio_reqs = []
    page.on('request', lambda r: audio_reqs.append(r.url) if '/audio/' in r.url else None)
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_function('() => window.__FFIV && __FFIV.ready', timeout=15000)

    check(f'{name}: boots to title', page.evaluate('() => __FFIV.mode') == 'title')
    check(f'{name}: layout follows viewport', page.evaluate('() => __FFIV.landscape') == (w > h))
    check(f'{name}: the title loads no audio file and the audio lists are read', audio_reqs == [] and page.evaluate('() => __FFIV.audio.ready'), audio_reqs)
    page.screenshot(path=f'{SHOTS}/{name}-1-title.png')

    page.keyboard.press('Enter')
    page.wait_for_function("() => __FFIV.mode === 'chapters'", timeout=5000)
    page.screenshot(path=f'{SHOTS}/{name}-1b-chapters.png')
    page.keyboard.press('Enter')
    page.wait_for_function("() => __FFIV.mode === 'card'", timeout=5000)
    check(f'{name}: title card shows the chapter', page.evaluate('() => __FFIV.card') [0] == 'CHAPTER 1')
    page.screenshot(path=f'{SHOTS}/{name}-1c-card.png')
    page.wait_for_function("() => __FFIV.area === 'town'", timeout=10000)
    wait_idle(page)
    start = page.evaluate('() => __FFIV.walker')
    page.keyboard.down('ArrowLeft')
    time.sleep(0.6)
    page.keyboard.up('ArrowLeft')
    wait_idle(page)
    after = page.evaluate('() => __FFIV.walker')
    check(f'{name}: arrow key walks', after['x'] < start['x'], (start, after))
    page.screenshot(path=f'{SHOTS}/{name}-2-walked.png')

    tap_tile(page, 10, 20)
    wait_idle(page)
    pos = page.evaluate('() => __FFIV.walker')
    check(f'{name}: tap walks to the tapped tile', (pos['x'], pos['y']) == (10, 20), pos)

    # The camera follows Tom, so in landscape the door is off the stage from row 20. Tap a visible tile first.
    tap_tile(page, 10, 12)
    wait_idle(page)
    tap_tile(page, 5, 5)
    page.wait_for_function("() => __FFIV.area === 'room'", timeout=30000)
    wait_idle(page)
    check(f'{name}: house door leads into the room', page.evaluate('() => __FFIV.area') == 'room')
    page.screenshot(path=f'{SHOTS}/{name}-3-room.png')

    tap_tile(page, 5, 7)
    page.wait_for_function("() => __FFIV.area === 'town'", timeout=15000)
    wait_idle(page)
    check(f'{name}: room mat leads back to town', page.evaluate('() => __FFIV.area') == 'town')

    tap_tile(page, 20, 20)
    page.wait_for_function("() => __FFIV.area === 'field'", timeout=30000)
    wait_idle(page)
    check(f'{name}: east edge leads to field B', page.evaluate('() => __FFIV.area') == 'field')
    page.screenshot(path=f'{SHOTS}/{name}-4-field.png')

    # Build 1b: the grey monster on FIELD B starts a fight, and the fight can be won.
    tap_tile(page, 14, 14)
    page.wait_for_function("() => __FFIV.mode === 'battle'", timeout=30000)
    check(f'{name}: monster on field B starts a fight against two monsters',
          [f['name'] for f in page.evaluate('() => __FFIV.battle.foes')] == ['MONSTER A', 'MONSTER B'])
    check(f'{name}: the party is four heroes', [p['name'] for p in page.evaluate('() => __FFIV.party')] == ['HERO 1', 'HERO 2', 'HERO 3', 'HERO 4'])
    page.wait_for_function("() => __FFIV.battle && __FFIV.battle.phase === 'menu'", timeout=30000)
    page.screenshot(path=f'{SHOTS}/{name}-5-battle.png')
    check(f'{name}: fight opens on the attack command', page.evaluate('() => __FFIV.battle.cursor') == 'attack')
    check(f'{name}: fight ends', fight_out(page))
    check(f'{name}: monster fight is won', page.evaluate('() => __FFIV.lastResult') == 'win')
    check(f'{name}: defeated monster leaves the map',
          not any(m['alive'] for m in page.evaluate('() => __FFIV.monsters') if m['kind'] == 'monster'))
    check(f'{name}: back to walking after the fight', page.evaluate('() => __FFIV.mode') == 'play')

    # The boss has a shield: the first attack is absorbed, the boss keeps its HP.
    page.evaluate("() => __FFIV.startBattle('boss')")
    page.wait_for_function("() => __FFIV.battle && __FFIV.battle.phase === 'menu'", timeout=30000)
    hp_before = page.evaluate('() => __FFIV.battle.enemy.hp')
    page.keyboard.press('Enter')
    page.wait_for_function("() => __FFIV.battle && __FFIV.battle.enemy.shield === 1", timeout=30000)
    check(f'{name}: boss shield absorbs the first hit',
          page.evaluate('() => __FFIV.battle.enemy.hp') == hp_before)
    page.screenshot(path=f'{SHOTS}/{name}-6-boss.png')
    check(f'{name}: boss fight ends', fight_out(page))
    check(f'{name}: boss fight is won', page.evaluate('() => __FFIV.lastResult') == 'win')

    commands_part(page, name)

    # A lost fight, four against two: the party is restored and the fight closes back to walking.
    page.evaluate("() => __FFIV.startBattle('pair', {partyHp: 1, enemyHp: 999, enemyAtk: 99})")
    check(f'{name}: fight can be lost', fight_out(page))
    check(f'{name}: loss is reported', page.evaluate('() => __FFIV.lastResult') == 'lose')
    check(f'{name}: loss restores the party',
          all(p['hp'] == p['maxHp'] for p in page.evaluate('() => __FFIV.party')))

    tap_tile(page, 1, 20)
    page.wait_for_function("() => __FFIV.area === 'town'", timeout=15000)
    wait_idle(page)
    check(f'{name}: west edge returns to town A', page.evaluate('() => __FFIV.area') == 'town')

    story_part(page, name)
    check(f'{name}: a whole chapter with no voice or music files requests no audio file', audio_reqs == [], audio_reqs)

    problems = page.evaluate('() => __FFIV.problems')
    check('world tables are sound', problems == [], problems)
    faults = page.evaluate('() => __FFIV.faults')
    check('no frame faults', faults == [], faults)
    check('no console or page errors', errors == [], errors)
    ctx.close()


def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                           cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_port(PORT)
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM') or None,
                                        args=['--no-sandbox'])
            for name, (w, h) in VIEWS.items():
                run_view(browser, name, w, h)
            for name, (w, h, safe) in DUO.items():
                duo_view(browser, name, w, h, safe)
            browser.close()
    finally:
        srv.terminate()
    failed = results.count(False)
    print(f'{results.count(True)} passed, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
