(() => {
    'use strict';
    const jobs = new Map();
    J.normalizeStudioFonts = files => {
        let total = 0;
        return (Array.isArray(files) ? files : []).slice(0, 8).filter(f => {
            if (!f || !/^local_import_[a-z0-9_]{1,70}$/.test(f.key) || typeof f.data !== 'string' || f.data.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(f.data))
                return false;
            total += f.data.length;
            return total <= 24 * 1024 * 1024;
        }).map(f => ({ key: f.key, label: String(f.label || f.key).slice(0, 80), data: f.data }));
    };
    J.studioFontBytes = data => {
        const binary = atob(data), bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
        if (bytes.length < 12)
            throw new Error('Invalid font');
        const sig = String.fromCharCode(...bytes.subarray(0, 4));
        if (!['OTTO', 'wOFF', 'wOF2', 'true', '\x00\x01\x00\x00'].includes(sig))
            throw new Error('Expected TTF, OTF, WOFF or WOFF2');
        return bytes.buffer;
    };
    const register = f => { J.addUserFont(f.key, f.label, 'Synthia_' + f.key, 400); };
    J.restoreStudioFonts = async (files) => {
        for (const f of J.normalizeStudioFonts(files)) {
            let job = jobs.get(f.key);
            if (!job || job.data !== f.data) {
                const face = new FontFace('Synthia_' + f.key, J.studioFontBytes(f.data));
                const promise = face.load().then(loaded => { document.fonts.add(loaded); return loaded; });
                job = { data: f.data, promise };
                jobs.set(f.key, job);
            }
            await job.promise;
            register(f);
        }
        J.metrics.clear();
        J.glyphs.clear();
    };
    const plan = J.plan;
    J.plan = (project, audio) => {
        for (const f of J.normalizeStudioFonts(project.studio?.fontFiles))
            register(f);
        return plan(project, audio);
    };
    const ensure = J.ensureFonts;
    J.ensureFonts = async (text, keys) => { await J.restoreStudioFonts(J.ui?.project?.studio?.fontFiles); return ensure(text, keys); };
    J.importStudioFont = async (file, project) => {
        if (!/\.(ttf|otf|woff2?)$/i.test(file.name) || file.size > 8 * 1024 * 1024)
            throw new Error(J.layerText('TTF/OTF/WOFF/WOFF2（8MB以下）を選択してください。', 'Choose TTF/OTF/WOFF/WOFF2 (up to 8 MB).'));
        const epoch = J.projectSessionEpoch, bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const f = { key: 'local_import_' + crypto.randomUUID().replace(/-/g, '_'), label: file.name, data: btoa(binary) };
        J.studioFontBytes(f.data);
        if (project.studio.fontFiles.length >= 8)
            throw new Error('Maximum 8 imported fonts');
        if (J.normalizeStudioFonts([...project.studio.fontFiles, f]).length !== project.studio.fontFiles.length + 1)
            throw new Error('Font data limit reached');
        await J.restoreStudioFonts([f]);
        if (epoch !== J.projectSessionEpoch || project !== J.ui.project || J.ui.exporting || J.layerSession.busy)
            return null;
        J.uiApi.pushEdit();
        project.studio.fontFiles.push(f);
        project.userFonts.push({ key: f.key, label: f.label, family: 'Synthia_' + f.key, weight: 400 });
        for (const role of Object.keys(J.ui.plan.style.fonts))
            project.fonts[role] = f.key;
        J.studioChanged();
        return f;
    };
})();
