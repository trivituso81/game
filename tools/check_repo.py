#!/usr/bin/env python3
"""Repo check, run before every push:  python3 tools/check_repo.py

1. Cache tags: every engine script tag in index.html carries the same ?v= tag, sw.js SW_TAG equals it, and the ENGINE list in sw.js names
   the same files in the same order as index.html.
2. No text file names a cast member, place or story item of the first game. The list below comes from the engine starter kit,
   not from reading the first game's repo. The first game may be mentioned as "the first game" and by its repo name only.
3. No text file contains a long dash (U+2014). Game text and docs use plain punctuation.
4. The docs this repo promises exist.
Exits 1 on any failure.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_EXT = ('.md', '.html', '.js', '.json', '.py', '.txt', '.css')
# Whole words. The second value says whether case matters ("Rose" the name, not "rose" the verb).
BANNED = [('Nara', False), ('Ellie', False), ('Deedee', False), ('Rose', True), ('Nine Scoops', False), ('Warmth', False),
          ('Adventures of Tom', False), ('cribbage', False)]
DOCS = ['CLAUDE.md', 'README.md', 'docs/ARCHITECTURE.md', 'docs/BATTLE_SYSTEM.md', 'docs/ART_PIPELINE.md', 'docs/VOICE_PIPELINE.md',
        'docs/MUSIC_PIPELINE.md', 'docs/WORKFLOW.md', 'docs/CANON.md', 'docs/CHANGES.md']
LONG_DASH = '—'
results = []


def check(name, ok, detail=''):
    results.append(ok)
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else ' :: ' + str(detail)))


def text_files(root):
    try:
        out = subprocess.run(['git', 'ls-files', '-co', '--exclude-standard'], cwd=root, capture_output=True, text=True, check=True).stdout.split('\n')
    except Exception:
        out = [os.path.relpath(os.path.join(d, f), root) for d, _, fs in os.walk(root) if '.git' not in d for f in fs]
    return sorted(f for f in out if f.endswith(TEXT_EXT) and os.path.isfile(os.path.join(root, f)))


def tags(root):
    html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
    sw = open(os.path.join(root, 'sw.js'), encoding='utf-8').read()
    scripts = re.findall(r'<script src="engine/([a-z-]+)\.js\?v=([^"]+)"', html)
    untagged = re.findall(r'<script src="(engine/[^"?]+)"', html)
    found = sorted(set(t for _, t in scripts))
    check('index.html: every engine script has a ?v= tag', scripts and not untagged, untagged)
    check('index.html: one tag on all engine scripts', len(found) == 1, found)
    m = re.search(r"const SW_TAG='([^']+)'", sw)
    check('sw.js: SW_TAG equals the tag in index.html', bool(m) and found == [m.group(1)], (m.group(1) if m else None, found))
    m = re.search(r'const ENGINE=\[([^\]]*)\]', sw)
    listed = re.findall(r"'([^']+)'", m.group(1)) if m else []
    check('sw.js: ENGINE lists the same scripts in the same order as index.html', listed == [n for n, _ in scripts], (listed, [n for n, _ in scripts]))
    missing = [n for n, _ in scripts if not os.path.isfile(os.path.join(root, 'engine', n + '.js'))]
    check('every listed engine script exists', not missing, missing)


def words(root):
    me = os.path.join('tools', 'check_repo.py')
    bad, dashes = [], []
    for f in text_files(root):
        if f == me:
            continue
        s = open(os.path.join(root, f), encoding='utf-8', errors='replace').read()
        if LONG_DASH in s:
            dashes.append(f)
        for word, cased in BANNED:
            if re.search(r'(?<![A-Za-z])' + re.escape(word) + r'(?![A-Za-z])', s, 0 if cased else re.I):
                bad.append(f + ': ' + word)
    check('no file names a first-game cast member, place or story item', not bad, bad)
    check('no file contains a long dash', not dashes, dashes)


def main(root=ROOT):
    tags(root)
    words(root)
    missing = [d for d in DOCS if not os.path.isfile(os.path.join(root, d))]
    check('the promised docs exist', not missing, missing)
    fails = results.count(False)
    print(f'\n{len(results) - fails}/{len(results)} passed')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else ROOT))
