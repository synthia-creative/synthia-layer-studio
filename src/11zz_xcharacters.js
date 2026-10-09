/* Manual transforms compose with existing animation; no alternate render engine. */
(() => {
    'use strict';
    const num = (v, d, lo, hi) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
    J.studioTransform = v => ({ x: num(v?.x, 0, -10000, 10000), y: num(v?.y, 0, -10000, 10000), scale: num(v?.scale, 1, .05, 10), rotation: num(v?.rotation, 0, -360, 360), opacity: num(v?.opacity, 1, 0, 1), kerning: num(v?.kerning, 0, -500, 500) });
    J.normalizeStudioCharacters = value => {
        const out = {};
        if (!value || typeof value !== 'object')
            return out;
        for (const [key, row] of Object.entries(value).slice(0, 20000)) {
            if (!row || typeof row !== 'object' || !/^line-\d+$|^cue-.{1,100}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))
                continue;
            const glyphs = {};
            for (const [i, t] of Object.entries(row.glyphs || {}).slice(0, 2000))
                if (/^\d{1,5}$/.test(i))
                    glyphs[i] = J.studioTransform(t);
            out[key] = { line: J.studioTransform(row.line), glyphs };
        }
        return out;
    };
    J.studioLineKey = line => line?.cueId ? 'cue-' + line.cueId : 'line-' + line.index;
    J.studioGlyphHits = [];
    // Glyph indices count Unicode code points and spaces, but not line-break separators.
    J.studioGlyphMap = (full, part, start = 0) => {
        const source = [...String(full).replace(/\r?\n/g, '')], chars = [...String(part).replace(/\r?\n/g, '')], visible = source.map((ch, index) => ({ ch, index })).filter(g => !/\s/.test(g.ch)), needle = chars.filter(ch => !/\s/.test(ch));
        let found = -1;
        for (let i = start; i <= visible.length - needle.length; i++)
            if (needle.every((ch, j) => visible[i + j].ch === ch)) {
                found = i;
                break;
            }
        if (found < 0 || !needle.length)
            return { map: [], end: start, found: false };
        let j = 0;
        return { map: chars.map(ch => /\s/.test(ch) ? null : visible[found + j++].index), end: found + needle.length, found: true };
    };
    const planner = J.plan;
    J.plan = (project, audio) => {
        const plan = planner(project, audio);
        if (!J.studioOn(project, 'characterEditing'))
            return plan;
        for (const line of plan.lines) {
            let cursor = 0;
            for (const cut of plan.cuts.filter(c => c.line === line.index && c.text)) {
                let match = J.studioGlyphMap(line.text, cut.text, cut.recap ? 0 : cursor);
                if (!match.found)
                    match = J.studioGlyphMap(line.text, cut.text);
                cut.studioCharacterMap = match.map;
                if (!cut.recap && match.found)
                    cursor = match.end;
            }
        }
        return plan;
    };
    const draw = J.drawItem;
    J.drawItem = (env, it) => {
        const studio = env.plan?.studio, line = env.plan?.lines?.find(l => l.index === env.cut?.line);
        if (!studio?.flags?.characterEditing || !line || env.bgOnly || env.inLayer || it._studioApplied || !it.text)
            return draw(env, it);
        const match = J.studioGlyphMap(env.cut.text, it.text, env._studioGlyphStart || 0);
        if (!match.found)
            return draw(env, it);
        const indices = match.map.map(i => env.cut.studioCharacterMap?.[i] ?? i), key = J.studioLineKey(line), row = studio.characters[key], base = J.studioTransform(row?.line), old = it.charFn;
        const changed = { ...it, _studioApplied: true, x: it.x + base.x, y: it.y + base.y, rot: (it.rot || 0) + base.rotation, sx: (it.sx || 1) * base.scale, sy: (it.sy || 1) * base.scale, alpha: (it.alpha ?? 1) * base.opacity, charFn: (i, g, n) => { const a = old?.(i, g, n) || {}, b = J.studioTransform(row?.glyphs[indices[i]]); return { ...a, dx: (a.dx || 0) + b.x + base.kerning * i + b.kerning, dy: (a.dy || 0) + b.y, s: (a.s ?? 1) * b.scale, rot: (a.rot || 0) + b.rotation, a: (a.a ?? 1) * b.opacity }; } };
        return draw({ ...env, studioGlyph: (g, m, bases) => {
                env.studioGlyph?.(g, m, bases);
                if (J.studioCapturing && !env._groupMeasuring && env.pass === 'main')
                    J.studioGlyphHits.push({ key, index: indices[g.i], ch: g.ch, x: m.e, y: m.f, w: Math.max(12, Math.abs(m.a) * g.w + Math.abs(m.c) * g.h), h: Math.max(12, Math.abs(m.b) * g.w + Math.abs(m.d) * g.h), lineBasis: bases.line, characterBasis: bases.character });
            } }, changed);
    };
})();
