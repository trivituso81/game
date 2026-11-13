#!/usr/bin/env python3
"""Headless smoke test for Build 1a (placeholder world).

Run:  CHROMIUM=/usr/bin/google-chrome python3 tools/smoke.py
      (CHROMIUM may be left unset to use Playwright's own Chromium.)

Per orientation (portrait and landscape): title, arrow keys, tap to walk, door in, mat out, edge east, edge west,
the world tables, faults and console errors. Screenshots go to SHOTS (default /tmp/ffiv-shots). Exits 1 on any failure.
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
    page.wait_for_function('() => window.__FFIV && !window.__FFIV.busy', timeout=30000)
    time.sleep(0.05)


def tap_tile(page, tx, ty):
    c = page.evaluate('([x, y]) => window.__FFIV.tileToClient(x, y)', [tx, ty])
    page.mouse.click(c['x'], c['y'])


def run_view(browser, name, w, h):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_function('() => window.__FFIV !== undefined', timeout=15000)

    check(f'{name}: boots to title', page.evaluate('() => __FFIV.mode') == 'title')
    check(f'{name}: layout follows viewport', page.evaluate('() => __FFIV.landscape') == (w > h))
    page.screenshot(path=f'{SHOTS}/{name}-1-title.png')

    page.keyboard.press('Enter')
    page.wait_for_function("() => __FFIV.area === 'town'", timeout=5000)
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

    tap_tile(page, 1, 20)
    page.wait_for_function("() => __FFIV.area === 'town'", timeout=15000)
    wait_idle(page)
    check(f'{name}: west edge returns to town A', page.evaluate('() => __FFIV.area') == 'town')

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
            browser.close()
    finally:
        srv.terminate()
    failed = results.count(False)
    print(f'{results.count(True)} passed, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
