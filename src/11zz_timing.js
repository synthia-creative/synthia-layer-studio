/* Timing interchange reuses the legacy lyric/SRT parsers and cue validator. */
(() => {
    'use strict';
    J.studioPlanCues = plan => J.validateCues(plan.lines.map((line, index) => ({ id: String(line.cueId || 'line-' + index), start: line.start, end: line.end, text: line.text })));
    J.studioSRT = cues => {
        const clock = t => { const ms = Math.round(t * 1000); return [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60].map(v => String(v).padStart(2, '0')).join(':') + ',' + String(ms % 1000).padStart(3, '0'); };
        return J.validateCues(cues).filter(c => c.text.length).map((c, i) => `${i + 1}\n${clock(c.start)} --> ${clock(c.end)}\n${c.text}`).join('\n\n') + '\n';
    };
    J.studioLRC = cues => J.validateCues(cues).map(c => { const ms = Math.round(c.start * 1000), minutes = Math.floor(ms / 60000), seconds = Math.floor(ms / 1000) % 60; return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}]${c.text.replace(/\r?\n/g, ' ')}`; }).join('\n') + '\n';
    J.studioParseLRC = (raw, duration = 0, gap = 0) => {
        const parsed = J.parseLyrics(String(raw).replace(/^\uFEFF/, '')), offset = Number(parsed.meta.offset || 0) / 1000;
        if (!parsed.lines.length || parsed.lines.some(l => !Number.isFinite(l.lrc)))
            throw new Error(J.layerText('各行にLRCタイムスタンプを付けてください。', 'Every lyric line needs an LRC timestamp.'));
        const lines = parsed.lines.map(l => ({ ...l, start: Math.max(0, l.lrc + offset) })).sort((a, b) => a.start - b.start);
        return J.validateCues(lines.map((l, i) => ({ id: 'lrc-' + i, start: l.start, end: i + 1 < lines.length ? Math.max(l.start + .001, lines[i + 1].start - gap / 1000) : Math.max(l.start + 3, duration), text: l.text })));
    };
    J.studioPasteLyrics = (raw, keep) => String(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').map(line => !line.trim() && keep ? '[間奏]' : line).join('\n');
})();
