(() => {
    'use strict';
    J.createStudioExportAssets = async (project, span, fps, signal) => {
        if (!J.studioOn(project, 'timeline'))
            return null;
        const assets = new Map(), readers = [];
        const close = async () => { await Promise.allSettled(readers.map(r => r.reader.close())); };
        try {
            for (const l of project.studio.layers.filter(l => ['Image', 'Video'].includes(l.type) && l.start < span.t0 + span.duration && l.end > span.t0 && l.transform.opacity > 0)) {
                const m = J.studioMedia.get(l.id);
                if (!m)
                    throw new Error(J.layerText('レイヤー素材を再読込してください: ', 'Reload layer media: ') + l.name + ' / ' + l.fileName);
                if (l.type === 'Image') {
                    assets.set(l.id, m);
                    continue;
                }
                const reader = await J.VideoBackgroundReader.open(m, signal);
                readers.push({ reader, layer: l, ctx: null });
                const ratio = Math.min(1, ...J.outputSize(project).map((n, i) => n / (i ? m.height : m.width))), cv = J.layerCanvas(Math.max(1, Math.round(m.width * ratio)), Math.max(1, Math.round(m.height * ratio)));
                readers[readers.length - 1].ctx = cv.getContext('2d');
                function* times() {
                    for (let i = 0; i < span.frames; i++) {
                        const t = span.t0 + i / fps;
                        if (t < l.start || t >= l.end)
                            continue;
                        const local = t - l.start + .000001;
                        yield local;
                        if (local >= reader.lastTimestamp)
                            break;
                    }
                }
                reader.iterator = new Mediabunny.VideoSampleSink(reader.track).samplesAtTimestamps(times());
                assets.set(l.id, { el: cv, width: cv.width, height: cv.height, video: false });
            }
            return { assets, frame: async (t) => {
                    for (const r of readers)
                        if (t >= r.layer.start && t < r.layer.end)
                            await r.reader.drawNext(r.ctx);
                }, close };
        }
        catch (e) {
            await close();
            throw e;
        }
    };
    J.studioOutputName = project => project.studio.output.filename || ((project.title || 'project').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 100) || 'project');
    J.exportStudioPNG = async ({ project, plan, range, signal, onProgress }) => {
        const span = J.simpleExportSpan(project.simpleExport.duration, plan.fps, range), [w, h] = J.outputSize(project);
        if (span.frames > 18000)
            throw new Error('PNG sequence limit: 18,000 frames; select a shorter range.');
        await J.ensureFonts(project.lyrics, J.fontsOfPlan(plan));
        const render = new J.LayerRenderer(w, h, 'alpha', 0, project.hideDecorativeText), cv = J.layerCanvas(w, h), ctx = cv.getContext('2d'), zip = new J.ZipWriter(), name = J.studioOutputName(project), lyricProject = { ...project, studio: { ...project.studio, layers: project.studio.layers.filter(l => l.type === 'Lyrics') } };
        for (let i = 0; i < span.frames; i++) {
            if (signal?.aborted)
                throw new DOMException('Cancelled', 'AbortError');
            const t = span.t0 + i / plan.fps;
            render.draw(plan, t);
            ctx.clearRect(0, 0, w, h);
            if (J.studioOn(project, 'timeline'))
                J.composeStudioLayers(ctx, lyricProject, t, render.layer, new Map());
            else
                ctx.drawImage(render.layer, 0, 0);
            const blob = await new Promise(resolve => cv.toBlob(resolve, 'image/png'));
            if (!blob)
                throw new Error('PNG encoding failed');
            zip.add(`${name}_${String(i).padStart(6, '0')}.png`, new Uint8Array(await blob.arrayBuffer()));
            onProgress?.((i + 1) / span.frames, `${i + 1} / ${span.frames}`);
            if (i % 3 === 0)
                await new Promise(resolve => setTimeout(resolve, 0));
        }
        return zip.finish();
    };
})();
