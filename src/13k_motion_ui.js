(() => {
    'use strict';
    function boot() {
        const el = J.studioElement, tr = J.layerText, root = J.studioSection('motionEditing', 'IN / HOLD / OUT・演出強度', 'IN / HOLD / OUT / intensity'), line = el('select', null, 'studioMotionLine'), preset = el('select', null, 'studioPreset'), fields = {};
        root.append(line, preset);
        for (const name of Object.keys(J.STUDIO_PRESETS)) {
            const o = el('option', name);
            o.value = name;
            preset.append(o);
        }
        for (const [name, table] of [['enter', J.ENTER], ['hold', J.HOLD], ['exit', J.EXIT]]) {
            const label = el('label', name.toUpperCase()), select = el('select', null, 'studioMotion-' + name);
            select.append(el('option', tr('既存のおまかせ', 'Existing auto')));
            for (const [key, d] of Object.entries(table)) {
                const o = el('option', d.name || key);
                o.value = key;
                select.append(o);
            }
            select.options[0].value = '';
            label.append(select);
            fields[name] = select;
            root.append(label);
            select.addEventListener('change', () => save());
        }
        const intensity = el('input', null, 'studioMotionIntensity');
        intensity.type = 'range';
        intensity.min = '0';
        intensity.max = '1';
        intensity.step = '.01';
        const il = el('label', 'Intensity 0–1');
        il.append(intensity);
        root.append(il);
        intensity.addEventListener('change', () => save());
        const labels = ['落ち着き / Calm', 'インパクト / Impact', '切れ味 / Sharpness', 'スピード / Speed', '広がり / Spread', '揺れ / Shake', 'グリッチ / Glitch'];
        const controls = {};
        for (const [i, key] of J.STUDIO_CONTROLS.entries()) {
            const label = el('label', labels[i]), input = el('input', null, 'studioControl-' + key);
            input.type = 'range';
            input.min = '0';
            input.max = '100';
            input.step = '1';
            label.append(input);
            controls[key] = input;
            root.append(label);
            input.addEventListener('change', () => { J.uiApi.pushEdit(); J.ui.project.studio.motion.controls[key] = +input.value; J.studioChanged(); });
        }
        const selected = () => J.ui.plan.lines.find(l => J.studioLineKey(l) === line.value), save = () => {
            if (!selected())
                return;
            J.uiApi.pushEdit();
            J.ui.project.studio.motion.rows[line.value] = J.studioMotionRow({ enter: fields.enter.value, hold: fields.hold.value, exit: fields.exit.value, intensity: +intensity.value });
            J.studioChanged();
        };
        root.append(J.studioButton('studioApplyPreset', '選択行にプリセットを適用', 'Apply preset to selected line', () => {
            if (!selected())
                return;
            J.uiApi.pushEdit();
            J.ui.project.studio.motion.preset = preset.value;
            J.ui.project.studio.motion.rows[line.value] = J.studioPreset(preset.value);
            J.studioChanged();
        }));
        const sync = () => {
            const value = line.value, lines = J.ui.plan.lines.filter(l => l.text);
            line.replaceChildren(...lines.map(l => { const o = el('option', `${l.index + 1}: ${l.text.slice(0, 32)}`); o.value = J.studioLineKey(l); return o; }));
            if (lines.some(l => J.studioLineKey(l) === value))
                line.value = value;
            const m = J.ui.project.studio.motion, row = J.studioMotionRow(m.rows[line.value]);
            for (const k in fields)
                fields[k].value = row[k];
            intensity.value = String(row.intensity);
            for (const k in controls)
                controls[k].value = String(m.controls[k]);
            preset.value = m.preset;
        };
        line.addEventListener('change', () => {
            sync();
            const l = selected();
            if (l)
                J.uiApi.seek(l.start + Math.min(.5, (l.end - l.start) / 2));
        });
        const old = J.syncLayerUI;
        J.syncLayerUI = () => { old(); sync(); };
        sync();
        J.syncLayerUI();
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot);
    else
        boot();
})();
