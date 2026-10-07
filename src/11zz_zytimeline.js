(() => {
    'use strict';
    J.STUDIO_LAYER_TYPES = ['Lyrics', 'Text', 'Image', 'Video', 'Overlay', 'Effect', 'Background'];
    J.STUDIO_BLENDS = ['source-over', 'multiply', 'screen', 'overlay', 'lighter'];
    J.studioMedia = new Map();
    J.normalizeStudioLayers = value => {
        const used = new Set(), out = [];
        for (const layer of (Array.isArray(value) ? value : []).slice(0, 64)) {
            if (!layer || !J.STUDIO_LAYER_TYPES.includes(layer.type) || typeof layer.id !== 'string' || !/^[-a-zA-Z0-9_]{1,100}$/.test(layer.id) || used.has(layer.id) || layer.type === 'Lyrics' && out.some(l => l.type === 'Lyrics'))
                continue;
            used.add(layer.id);
            const start = Number.isFinite(layer.start) ? Math.max(0, layer.start) : 0, end = Number.isFinite(layer.end) ? Math.max(start + .001, layer.end) : 86400;
            out.push({ id: layer.id, type: layer.type, name: String(layer.name || layer.type).slice(0, 100), start, end, blend: J.STUDIO_BLENDS.includes(layer.blend) ? layer.blend : 'source-over', transform: J.studioTransform(layer.transform), text: String(layer.text || '').slice(0, 10000), color: /^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : '#ffffff', fileName: String(layer.fileName || '').slice(0, 200), font: J.FONTS[layer.font] ? layer.font : 'gothic_bold' });
        }
        if (!out.some(l => l.type === 'Lyrics'))
            out.unshift({ id: 'lyrics', type: 'Lyrics', name: 'Lyrics', start: 0, end: 86400, blend: 'source-over', transform: J.studioTransform(), text: '', color: '#ffffff', fileName: '', font: 'gothic_bold' });
        return out;
    };
    J.studioEnsureCues = project => {
        if (Array.isArray(project.subtitleCues))
            return project.subtitleCues;
        const plan = J.plan(project, J.ui.audio), cues = J.studioPlanCues(plan);
        for (let i = 0; i < cues.length; i++) {
            const from = J.studioLineKey(plan.lines[i]), to = 'cue-' + cues[i].id;
            for (const map of [project.studio.characters, project.studio.motion.rows])
                if (map[from])
                    map[to] = structuredClone(map[from]);
        }
        project.subtitleCues = cues;
        project.lyrics = cues.map(c => c.text).join('\n\n');
        project.timing.lineTimes = {};
        return cues;
    };
    J.studioDuplicateCue = (project, index) => {
        const cue = project.subtitleCues[index];
        if (!cue)
            throw new Error('Cue not found');
        const id = 'copy-' + crypto.randomUUID(), entries = project.subtitleCues.map((cue, i) => ({ cue, override: project.overrides?.[i] }));
        entries.push({ cue: { ...cue, id, start: cue.end, end: cue.end + (cue.end - cue.start) }, override: structuredClone(project.overrides?.[index] || {}) });
        entries.sort((a, b) => a.cue.start - b.cue.start);
        project.subtitleCues = J.validateCues(entries.map(e => e.cue));
        project.overrides = Object.fromEntries(entries.map((e, i) => [i, e.override || {}]));
        for (const map of [project.studio.characters, project.studio.motion.rows])
            if (map['cue-' + cue.id])
                map['cue-' + id] = structuredClone(map['cue-' + cue.id]);
        project.lyrics = project.subtitleCues.map(c => c.text).join('\n\n');
        project.exportRange = null;
        return id;
    };
    J.composeStudioLayers = (ctx, project, t, lyrics, assets = J.studioMedia) => {
        const w = ctx.canvas.width, h = ctx.canvas.height, design = J.designSize(project.aspect), k = w / design[0];
        for (const layer of project.studio.layers) {
            const m = assets.get(layer.id);
            if (m?.video && assets === J.studioMedia) {
                const local = Math.max(0, Math.min(t - layer.start, m.duration - .001));
                if (!m.el.seeking && Math.abs(m.el.currentTime - local) > .03)
                    m.el.currentTime = local;
                if (J.ui.playing && t >= layer.start && t < layer.end && local < m.duration - .01)
                    m.el.play().catch(() => { });
                else
                    m.el.pause();
            }
            if (t < layer.start || t >= layer.end)
                continue;
            const p = layer.transform;
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.globalCompositeOperation = layer.blend;
            ctx.translate(w / 2 + p.x * k, h / 2 + p.y * k);
            ctx.rotate(p.rotation * J.DEG);
            ctx.scale(p.scale, p.scale);
            if (layer.type === 'Lyrics')
                ctx.drawImage(lyrics, -w / 2, -h / 2);
            else if (layer.type === 'Text') {
                ctx.font = J.fontCSS(layer.font, Math.max(12, h / 10));
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = layer.color;
                const rows = layer.text.split('\n');
                rows.forEach((row, i) => ctx.fillText(row, 0, (i - (rows.length - 1) / 2) * h / 8));
            }
            else if (['Background', 'Overlay', 'Effect'].includes(layer.type)) {
                ctx.fillStyle = layer.color;
                if (layer.type === 'Effect')
                    ctx.globalAlpha *= .5 + .5 * Math.sin(t * J.TAU);
                ctx.fillRect(-w / 2, -h / 2, w, h);
            }
            else if (m) {
                const ratio = Math.min(w / m.width, h / m.height);
                ctx.drawImage(m.el, -m.width * ratio / 2, -m.height * ratio / 2, m.width * ratio, m.height * ratio);
            }
            ctx.restore();
        }
    };
    const reset = J.resetLayerProjectSession;
    J.clearStudioMedia = () => {
        for (const m of J.studioMedia.values())
            m.dispose();
        J.studioMedia.clear();
    };
    if (reset)
        J.resetLayerProjectSession = () => { reset(); J.clearStudioMedia(); };
})();
