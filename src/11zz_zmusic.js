(() => {
    'use strict';
    const cache = new WeakMap();
    J.STUDIO_SECTIONS = ['Unknown', 'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge', 'Outro'];
    J.normalizeStudioAnalysis = v => ({ beatSnap: [20, 50, 100, 150].includes(v?.beatSnap) ? v.beatSnap : 0, sections: (Array.isArray(v?.sections) ? v.sections : []).slice(0, 500).filter(s => Number.isFinite(s?.start) && Number.isFinite(s?.end) && s.start >= 0 && s.end > s.start && J.STUDIO_SECTIONS.includes(s.type)).map(s => ({ start: s.start, end: s.end, type: s.type })).sort((a, b) => a.start - b.start) });
    J.studioDensity = lines => lines.map(l => { const count = [...(l.text || '').replace(/\s/g, '')].length, seconds = Math.max(.001, l.end - l.start); return { index: l.index, key: J.studioLineKey(l), count, seconds, cps: count / seconds }; });
    J.studioAnalyze = audio => {
        if (!audio?.buffer)
            throw new Error(J.layerText('音源を先に読み込んでください。', 'Load audio first.'));
        if (cache.has(audio.buffer))
            return cache.get(audio.buffer);
        const rate = audio.energyRate || 50, energy = audio.energy || [], sections = [];
        let start = 0, previous = 0;
        const average = (a, b) => {
            let sum = 0;
            for (let i = a; i < b; i++)
                sum += energy[i] || 0;
            return sum / Math.max(1, b - a);
        };
        for (let i = 0; i < energy.length; i += rate * 5) {
            const mean = average(i, Math.min(energy.length, i + rate * 5));
            if (i > 0 && Math.abs(mean - previous) > .25) {
                sections.push({ start, end: i / rate, type: 'Unknown' });
                start = i / rate;
            }
            previous = mean;
        }
        if (audio.duration > start)
            sections.push({ start, end: audio.duration, type: 'Unknown' });
        const result = { rate, rms: audio.rms || [], peak: audio.framePeaks || [], energy, onset: audio.onset || [], beats: audio.beats || [], bpm: audio.bpm, confidence: (audio.onset || []).some(v => v > .1) ? 'estimated' : 'low', sections };
        cache.set(audio.buffer, result);
        return result;
    };
    J.studioLineEnergy = (analysis, line) => {
        const a = Math.floor(line.start * analysis.rate), b = Math.min(analysis.energy.length, Math.ceil(line.end * analysis.rate));
        let sum = 0;
        for (let i = a; i < b; i++)
            sum += analysis.energy[i] || 0;
        return Math.max(0, Math.min(1, sum / Math.max(1, b - a)));
    };
})();
