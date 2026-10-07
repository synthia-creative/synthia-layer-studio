(() => {
    'use strict';
    J.studioSnapCues = (cues, beats, maxMs) => {
        const limit = [20, 50, 100, 150].includes(maxMs) ? maxMs / 1000 : 0, valid = J.validateCues(cues), grid = beats.filter(Number.isFinite).sort((a, b) => a - b);
        if (!limit || !grid.length)
            return valid;
        let cursor = 0;
        const next = valid.map(c => {
            while (cursor + 1 < grid.length && grid[cursor + 1] < c.start)
                cursor++;
            const options = [grid[cursor], grid[cursor + 1]].filter(Number.isFinite), nearest = options.reduce((a, b) => Math.abs(b - c.start) < Math.abs(a - c.start) ? b : a, options[0]), delta = nearest - c.start;
            if (Math.abs(delta) > limit + 1e-9 || nearest < 0)
                return c;
            return { ...c, start: nearest, end: c.end + delta };
        });
        for (let i = 1; i < next.length; i++)
            if (next[i].start < next[i - 1].start)
                return valid;
        return J.validateCues(next);
    };
    J.studioAutoRecipes = (plan, analysis, sections) => {
        const rows = {};
        for (const d of J.studioDensity(plan.lines)) {
            const line = plan.lines.find(l => l.index === d.index);
            if (!d.count)
                continue;
            const energy = J.studioLineEnergy(analysis, line), section = sections.find(s => line.start >= s.start && line.start < s.end)?.type;
            let intensity = Math.max(.15, Math.min(1, .15 + energy * .75));
            if (section === 'Chorus')
                intensity = Math.max(.8, intensity);
            if (section === 'Verse' || section === 'Intro')
                intensity = Math.min(.5, intensity);
            if (d.cps > 8)
                intensity = Math.min(.45, intensity);
            const preset = d.cps > 8 ? 'Minimal' : intensity > .75 ? 'Impact' : intensity > .5 ? 'Pop' : 'Elegant';
            rows[d.key] = { ...J.studioPreset(preset), intensity };
        }
        return rows;
    };
})();
