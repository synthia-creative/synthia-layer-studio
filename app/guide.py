"""Render the local Markdown guides as UTF-8 HTML without runtime dependencies."""
import re
from html import escape


def inline(text):
    text = escape(text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # Only ordinary relative and HTTP(S) documentation links are allowed.
    def link(match):
        label, url = match.groups()
        if not re.match(r'^(https?://|\.{0,2}/|[A-Za-z0-9_])[A-Za-z0-9_./:%?=&amp;#()~-]*$', url):
            return label
        return f'<a href="{url}">{label}</a>'
    return re.sub(r'\[([^\]]+)\]\(([^\s]+)\)', link, text)


def render(source, lang):
    lines = source.splitlines()
    blocks, paragraph, listing = [], [], None
    def flush():
        if paragraph:
            blocks.append('<p>' + inline(' '.join(paragraph)) + '</p>')
            paragraph.clear()
    def close_list():
        nonlocal listing
        if listing:
            blocks.append('</' + listing + '>')
            listing = None
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('```'):
            flush(); close_list(); code = []; i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i]); i += 1
            blocks.append('<pre><code>' + escape('\n'.join(code)) + '</code></pre>')
        elif line.startswith('|'):
            flush(); close_list(); rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = lines[i].strip().strip('|').split('|')
                if not all(re.fullmatch(r'\s*:?-+:?\s*', c) for c in cells):
                    tag = 'th' if not rows else 'td'
                    rows.append('<tr>' + ''.join(f'<{tag}>' + inline(c.strip()) + f'</{tag}>' for c in cells) + '</tr>')
                i += 1
            blocks.append('<div class="table"><table>' + ''.join(rows) + '</table></div>'); continue
        elif re.match(r'^#{1,6} ', line):
            flush(); close_list(); level = len(line.split(' ', 1)[0])
            blocks.append(f'<h{level}>' + inline(line[level + 1:]) + f'</h{level}>')
        elif re.match(r'^(- |\d+\. )', line):
            flush(); kind = 'ul' if line.startswith('- ') else 'ol'
            if listing != kind:
                close_list(); listing = kind; blocks.append('<' + kind + '>')
            blocks.append('<li>' + inline(re.sub(r'^(- |\d+\. )', '', line)) + '</li>')
        elif not line.strip():
            flush(); close_list()
        else:
            close_list(); paragraph.append(line)
        i += 1
    flush(); close_list()
    title = source.splitlines()[0].lstrip('# ')
    home, back = ('../en/', 'Back to editor') if lang == 'en' else ('../', '編集画面へ')
    return f'''<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} | SYNTHIA Layer Studio</title>
<style>body{{margin:0;background:#f5f5f3;color:#222;font:16px/1.8 system-ui,sans-serif}}main{{max-width:900px;margin:auto;padding:28px 24px 64px}}h1{{font-size:1.7rem;line-height:1.4}}h2{{margin-top:2.5rem;border-bottom:1px solid #ccc;padding-bottom:.4rem}}li{{margin:.45rem 0}}a{{color:#165999}}pre{{background:#e8e8e5;padding:16px;overflow:auto}}code{{font-size:.92em;overflow-wrap:anywhere}}.table{{overflow:auto}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #bbb;text-align:left;padding:8px;min-width:90px}}p,li{{overflow-wrap:anywhere}}</style>
</head><body><main><nav><a href="{home}">{back}</a></nav>{''.join(blocks)}</main></body></html>
'''
