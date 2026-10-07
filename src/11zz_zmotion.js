(() => {
    'use strict';
    const clamp = (v, d, lo = 0, hi = 1) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
    J.STUDIO_PRESETS = { Minimal: ['blur', 'still', 'blur', .2], Pop: ['pop', 'breathe', 'shrink', .65], Rock: ['drop', 'jitter', 'scatter', .8], Cyber: ['type', 'glitchtick', 'blur', .65], Emotional: ['blur', 'drift', 'blur', .35], Elegant: ['wipe', 'still', 'blur', .25], Dark: ['blur', 'breathe', 'blur', .35], Impact: ['pop', 'jitter', 'scatter', .95], Glitch: ['scramble', 'glitchtick', 'flicker', .8], Cinematic: ['zoom', 'drift', 'shrink', .5] };
    J.STUDIO_CONTROLS = ['calm', 'impact', 'sharpness', 'speed', 'spread', 'shake', 'glitch'];
    J.studioMotionRow = v => ({ enter: J.ENTER[v?.enter] ? v.enter : '', hold: J.HOLD[v?.hold] ? v.hold : '', exit: J.EXIT[v?.exit] ? v.exit : '', intensity: clamp(v?.intensity, .5) });
    J.normalizeStudioMotion = v => {
        const controls = {};
        for (const key of J.STUDIO_CONTROLS)
            controls[key] = clamp(v?.controls?.[key], key === 'speed' ? 50 : 0, 0, 100);
        const rows = {};
        for (const [key, row] of Object.entries(v?.rows || {}).slice(0, 20000))
            if (/^line-\d+$|^cue-.{1,100}$/.test(key))
                rows[key] = J.studioMotionRow(row);
        return { preset: Object.hasOwn(J.STUDIO_PRESETS, v?.preset) ? v.preset : 'Minimal', controls, rows };
    };
    J.studioPreset = (name) => { const recipe = J.STUDIO_PRESETS[name] || J.STUDIO_PRESETS.Minimal; return J.studioMotionRow({ enter: recipe[0], hold: recipe[1], exit: recipe[2], intensity: recipe[3] }); };
    const planner = J.plan;
    J.plan = (project, audio) => {
        const plan = planner(project, audio);
        if (!J.studioOn(project, 'motionEditing'))
            return plan;
        for (const cut of plan.cuts) {
            const line = plan.lines.find(l => l.index === cut.line);
            if (!line || line.interlude)
                continue;
            const row = plan.studio.motion.rows[J.studioLineKey(line)];
            if (!row)
                continue;
            for (const [stage, table] of [['enter', J.ENTER], ['hold', J.HOLD], ['exit', J.EXIT]]) {
                const def = table[row[stage]];
                if (def && (!def.maxChars || [...cut.text].length <= def.maxChars) && (!def.minDur || cut.dur >= def.minDur))
                    cut[stage] = row[stage];
            }
            const speed = .5 + plan.studio.motion.controls.speed / 100;
            cut.inDur = Math.min(cut.dur / 2, cut.inDur / speed);
            cut.outDur = Math.min(cut.dur / 2, cut.outDur / speed);
            cut.studioMotion = row;
        }
        return plan;
    };
    const make = J.Renderer.prototype.makeEnv;
    J.Renderer.prototype.makeEnv = function (ctx, plan, cut, sc, opt) {
        const env = make.call(this, ctx, plan, cut, sc, opt);
        if (plan.studio?.flags.motionEditing && cut?.studioMotion) {
            const row = cut.studioMotion, c = plan.studio.motion.controls, amt = row.intensity * (1 - c.calm / 125);
            env.fx = { ...env.fx, motion: amt * (.5 + c.impact / 100), glitch: (env.fx.glitch || 0) * c.glitch / 100 };
            env.studioAmount = amt;
        }
        return env;
    };
    const draw = J.drawItem;
    J.drawItem = (env, it) => {
        if (!env.cut?.studioMotion || !env.plan.studio?.flags.motionEditing || env.inLayer || it._studioMotion || !env.cut.text.includes(it.text))
            return draw(env, it);
        const c = env.plan.studio.motion.controls, a = env.studioAmount || 0, old = it.charFn, phase = Math.sin(env.t * (2 + c.speed / 10)), pulse = 1 + .035 * a * phase * c.impact / 100;
        return draw(env, { ...it, _studioMotion: true, sx: (it.sx || 1) * pulse, sy: (it.sy || 1) * pulse, blur: (it.blur || 0) * (1 - c.sharpness / 100), charFn: (i, g, n) => { const t = old?.(i, g, n) || {}; return { ...t, dx: (t.dx || 0) + (i - (n - 1) / 2) * a * c.spread / 10, dy: (t.dy || 0) + Math.sin(env.t * 14 + i) * a * c.shake / 10, rot: (t.rot || 0) + phase * a * c.impact / 30 }; } });
    };
})();
