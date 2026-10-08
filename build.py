"""Build the single-file browser editions from src/, app/ and vendor/: Japanese and English.
usage: python3 build.py            -> index.html, en/index.html (GitHub Pages)
       python3 build.py --dev      -> also dev/www/jizura.js + dev/www/test.html for the test tools"""
import glob, os, sys
from html import escape
from app.english import localize_body, localize_js
from app import i18n
from app import publication
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
read = lambda p: open(p, encoding='utf-8').read()
VERSION = read('VERSION').strip()
SITE_URL = os.environ.get('SYNTHIA_SITE_URL', os.environ.get('JIZURA_SITE_URL', publication.SITE_URL)).strip().rstrip('/')
if SITE_URL and not SITE_URL.startswith('https://'):
    raise ValueError('SYNTHIA_SITE_URL must start with https://')
sources = sorted(glob.glob('src/*.js'))
js = '\n'.join(read(f) for f in sources)
mux = '/*! mp4-muxer v5.2.2 | MIT License | (c) 2023 Vanilagy | see THIRD_PARTY_NOTICES.md */\n' + read('vendor/mp4-muxer.min.js')
demux = read('vendor/mediabunny.min.js')

def build(lang):
    english = lang == 'en'
    title = publication.NAME
    description = ('字幕演出・リリックビデオ・字幕レイヤー制作をブラウザ上で行えるWebアプリ。SRT、タイムライン、背景・音源、MP4出力に対応。' if lang == 'ja' else 'Create subtitle animations, lyric videos and subtitle layers in your browser. Supports SRT, timeline editing, backgrounds, audio and MP4 exports.')
    folder = dict((c, f) for c, f, _, _ in i18n.EDITIONS)[lang]
    canonical = SITE_URL + '/' + (folder + '/' if folder else '') if SITE_URL else ''
    language_nav = i18n.nav(lang)
    body = read('app/body.html').replace('@VERSION@', VERSION).replace('    <div class="acts">', '    ' + language_nav + '\n    <div class="acts">', 1)
    if english: body = localize_body(body)
    body = publication.body(body, lang, VERSION)
    if english: script = '\n'.join(localize_js(read(f), f) for f in sources)
    else: script = js
    script = script.replace('@VERSION@', VERSION)
    if english:
        marker = '/* ============================================================\n   JIZURA — editor UI'
        if marker not in script: raise ValueError('Could not find browser UI entry point')
        inject = read('app/english.js')
        script = script.replace(marker, inject + '\n' + marker, 1)
    site_meta = ''
    if SITE_URL:
        alternates = '\n'.join(f'<link rel="alternate" hreflang="{hl}" href="{escape(SITE_URL)}/{f + "/" if f else ""}">' for c, f, hl, _ in i18n.EDITIONS)
        site_meta = f'<link rel="canonical" href="{escape(canonical)}">\n<meta property="og:url" content="{escape(canonical)}">\n{alternates}'
    html_lang = dict((c, hl) for c, _, hl, _ in i18n.EDITIONS)[lang]
    html = f'''<!doctype html>
<html lang="{html_lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{description}">
{site_meta}
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%231b1b1b'/%3E%3Ctext x='32' y='46' text-anchor='middle' font-family='sans-serif' font-size='44' font-weight='bold' fill='%23ffffff'%3ES%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>
{read('app/style.css')}
</style>
</head>
<body>
{body}
<script>
{mux}
</script>
<script>
{demux}
</script>
<script>
{script}
</script>
</body>
</html>
'''
    target = (folder + '/' if folder else '') + 'index.html'
    os.makedirs(os.path.dirname(target) or '.', exist_ok=True)
    open(target, 'w', encoding='utf-8').write(html)
    print(target, len(html), 'bytes')
for code, _, _, _ in i18n.EDITIONS:
    build(code)
if '--dev' in sys.argv:
    os.makedirs('dev/www', exist_ok=True)
    open('dev/www/jizura.js', 'w', encoding='utf-8').write(js)
    if os.path.isfile('dev/test.html'):
        open('dev/www/test.html', 'w', encoding='utf-8').write(read('dev/test.html'))
        print('dev/www ready: cd dev/www && python3 -m http.server 8765')
    else:
        print('dev/www/jizura.js ready; optional dev/test.html is not included in this edition')
