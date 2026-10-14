/* Ballad adapters and Canvas recipes. No generation, analysis or media access on load. */
(() => {
  'use strict';
  const B = J.BalladMotionEngine, clone = v => JSON.parse(JSON.stringify(v));
  const layer = typeof J.normalizeStudio === 'function';
  const dataOf = p => layer ? p.studio?.balladMotion : p.balladMotion;
  const write = (p, data) => { if (layer) p.studio = { ...(p.studio || J.normalizeStudio()), balladMotion: data }; else p.balladMotion = data; };
  const themeOf = p => layer ? p.theme : p.themeId;
  const defaults = J.defaultProject;
  J.defaultProject = () => {
    const p = defaults();
    for (const g of J.GROUP_KEYS) for (const k of J.order(g)) if (k.startsWith('bme_')) p.enabled[g][k] = false;
    return p;
  };
  // Registration does not add candidates to old projects or unrelated genres.
  const randomOk = J.randomOk;
  J.randomOk = (p, g, k) => k.startsWith('bme_') ? false : randomOk(p, g, k);
  const smooth = p => { p = J.clamp(p); return p * p * (3 - 2 * p); };
  const amount = env => env.cut?.ballad?.intensity ?? .35;
  const scale = env => Math.min(env.W / 1920, env.H / 1080);
  const fade = (env, it, p, out) => {
    const q = smooth(p), a = out ? 1 - q : q;
    it.alpha = (it.alpha ?? 1) * a;
    it.blur = (it.blur || 0) + (out ? q * 3 : (1 - q) * (6 + 6 * amount(env))) * scale(env);
  };
  J.register('enter', 'bme_soft_fade', { name: 'Soft Fade', apply: (env, it, p) => fade(env, it, p, false), inDur: dur => Math.min(.7, dur * .25) }, 'ballad');
  J.register('exit', 'bme_soft_fade', { name: 'Soft Fade', apply: (env, it, p) => fade(env, it, p, true), outDur: dur => Math.min(.6, dur * .25) }, 'ballad');
  J.register('hold', 'bme_gentle_float', { name: 'Gentle Float', apply(env, it, holdAmount = 1) {
    if (env.cut?.ballad?.reduceMotion) return;
    const a = (4 + 4 * amount(env)) * scale(env) * smooth(holdAmount), phase = B.hash(String(env.cut?.ballad?.seed ?? it.seed)) / 4294967296 * Math.PI * 2;
    // Continuous local time, independent of frame count, seeking direction and FPS.
    it.x += a * .65 * Math.sin(env.lt * .65 + phase); it.y += a * Math.sin(env.lt * .48 + phase);
  } }, 'ballad');
  J.register('cam', 'bme_static', { name: 'Still camera', get: () => ({ s: 1 }) }, 'ballad');
  J.register('cam', 'bme_gentle_push', { name: 'Gentle camera', get: env => ({ s: 1 + (env.cut?.ballad?.reduceMotion ? 0 : .015 * amount(env) * smooth(env.lt / Math.max(.01, env.cut.dur))) }) }, 'ballad');
  const envelope = env => smooth(env.pIn) * (1 - smooth(env.pOut));
  // A restrained layout avoids the auxiliary copies, rapid underlines and annotations in legacy layouts.
  J.register('layout', 'bme_center', { name: 'Ballad Center', fits: () => true,
    plan: (rng, cut, st) => ({ font: (st.fonts.serif || st.fonts.display || ['sans'])[0] }),
    render(env) {
      const text = J.splitLines(env.cut.text, env.W < env.H ? 8 : 18), font = J.FONTS[env.cut.params.font] ? env.cut.params.font : env.st.fonts.display[0];
      const size = Math.min(J.fitSize(text, font, env.W * .82, env.H * .48, { track: .08, lead: 1.4 }), env.H * .15);
      return J.mainDraw(env, { text, font, size, x: env.W / 2, y: env.H / 2, track: .08, lead: 1.4, color: env.sc.fg });
    }
  }, 'ballad');
  J.register('decor', 'bme_light_trace', { name: 'Light Trace', layer: 'front', subtle: true, draw(env, bb, p) {
    if (!bb || env.pass !== 'main') return;
    const w = Math.min(bb.x1 - bb.x0, env.W * .55), progress = smooth(env.lt / (1.5 - .8 * (p.intensity ?? amount(env))));
    const direction = (p.seed >>> 0) % 2 ? 1 : -1, x = direction > 0 ? bb.x0 : bb.x1;
    const y = Math.min(env.H * .93, bb.y1 + 9 * scale(env));
    env.line([[x, y], [x + direction * w * progress, y]], env.sc.accent, Math.max(.5, 1.4 * scale(env)), (.12 + .18 * (p.intensity ?? amount(env))) * envelope(env), false);
  } }, 'ballad');
  J.register('decor', 'bme_emotional_bloom', { name: 'Emotional Bloom', layer: 'front', subtle: true, draw(env, bb, p) {
    if (!bb || env.pass !== 'main') return;
    const a = p.intensity ?? amount(env), q = smooth(env.lt / 1.5), ctx = env.ctx;
    const r = Math.min(env.H * .075, (24 + 48 * a) * scale(env)) * (.7 + .3 * q);
    if (r <= 0) return;
    const x = (bb.x0 + bb.x1) / 2, y = bb.y1 + 5 * scale(env), g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, env.sc.accent); g.addColorStop(1, 'transparent');
    ctx.save(); ctx.globalAlpha = (.06 + .10 * a) * envelope(env); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  } }, 'ballad');
  function normalize(v) {
    if (!v || v.schemaVersion !== 1 || v.engineVersion !== B.VERSION) return undefined;
    const recipes = {};
    for (const r of Object.values(v.recipes || {}).slice(0, 20000)) {
      if (!r || r.source !== 'ballad-auto') continue;
      const fresh = B.planBallad([{ stableKey: r.cueKey, text: r.text, start: r.start, end: r.end }], v, B.allowlists)[0];
      if (!fresh) continue;
      // Persist the selected result, rather than rerolling on import or playback.
      for (const g of ['layout', 'enter', 'hold', 'exit', 'cam', 'treat', 'bg']) if (B.allowlists[g].includes(r[g])) fresh[g] = r[g];
      fresh.decorations = (Array.isArray(r.decorations) ? r.decorations : []).filter(k => B.allowlists.decor.includes(k)).slice(0, 2);
      fresh.inDuration = Number.isFinite(r.inDuration) ? Math.max(0, Math.min(r.inDuration, (r.end - r.start) * .5)) : fresh.inDuration;
      fresh.outDuration = Number.isFinite(r.outDuration) ? Math.max(0, r.outDuration) : fresh.outDuration;
      if (fresh.inDuration + fresh.outDuration > (r.end - r.start) * .5 + 1e-10) fresh.outDuration = Math.max(0, (r.end - r.start) * .5 - fresh.inDuration);
      fresh.intensity = Number.isFinite(r.intensity) ? Math.max(0, Math.min(.78, r.intensity)) : fresh.intensity;
      fresh.reduceMotion = r.reduceMotion === true;
      fresh.seed = Number.isFinite(r.seed) ? r.seed >>> 0 : fresh.seed;
      recipes[fresh.cueKey] = fresh;
    }
    const units = {};
    for (const [key, unit] of Object.entries(v.units || {}).slice(0, 20000)) {
      if (!/^cue-.{1,100}$|^line-\d+$/.test(key) || typeof unit?.text !== 'string' || unit.text.length > 20000 || !Array.isArray(unit.cuts)) continue;
      const cuts = unit.cuts.slice(0, 24).filter(c => typeof c?.text === 'string' && c.text.length <= 20000 && Number.isFinite(c.w) && c.w > 0).map(c => ({ text: c.text, w: c.w, recap: c.recap === true }));
      if (cuts.length === unit.cuts.length) units[key] = { text: unit.text, signature: String(unit.signature || '').slice(0, 2000), cuts };
    }
    const preserved = {};
    for (const [key, groups] of Object.entries(v.preserved || {}).slice(0, 20000)) if (key.length <= 256 && key !== '__proto__') {
      preserved[key] = {};
      for (const g of J.GROUP_KEYS) if (groups?.[g]) preserved[key][g] = clone(groups[g]);
    }
    const timingAudio = Number.isFinite(v.timingAudio?.duration) ? { duration: Math.max(0, v.timingAudio.duration), bpm: Number.isFinite(v.timingAudio.bpm) ? v.timingAudio.bpm : 0, beats: (v.timingAudio.beats || []).filter(Number.isFinite).slice(0, 100000) } : undefined;
    const lockedFx = {};
    for (const [key, fx] of Object.entries(v.lockedFx || {}).slice(0, 20000)) if (/^\d+$/.test(key) && fx && typeof fx === 'object') lockedFx[key] = clone(fx);
    return { ...B.settings(v), recipes, units, preserved, lockedFx, ...(timingAudio ? { timingAudio } : {}) };
  }
  if (layer) {
    const normal = J.normalizeStudio;
    J.normalizeStudio = v => ({ ...normal(v), ...(normalize(v?.balladMotion) ? { balladMotion: normalize(v.balladMotion) } : {}) });
  }
  function keyOf(plan, c) {
    const line = plan.lines.find(l => l.index === c.line);
    const id = line?.cueId ?? ('line-' + c.line), k = plan.cuts.filter(x => x.line === c.line && x.utext != null).indexOf(c);
    return id + ':' + k + ':' + B.hash(c.utext ?? c.text);
  }
  const capsOf = p => Object.fromEntries(J.GROUP_KEYS.map(g => [g, J.order(g).filter(k => !J.registry(g)[k]?.special && (k.startsWith('bme_') || J.randomOk(p, g, k)) && p.enabled?.[g]?.[k] !== false)]));
  const motionManual = (p, line) => {
    const row = layer && p.studio?.motion?.rows[J.studioLineKey(line)];
    return J.studioOn?.(p, 'motionEditing') && row && row.source !== 'ballad-auto';
  };
  const manual = (p, plan, c, g) => {
    const ov = p.overrides?.[c.line] || {}, line = plan.lines.find(l => l.index === c.line), k = plan.cuts.filter(x => x.line === c.line && x.utext != null).indexOf(c);
    return !!(ov.lock || ov.cueLook && ov.cueLook.source !== 'ballad-auto' || ov.randomDraw || p.locks?.tech?.[g] || ov[g] != null || ov.cutTech?.[k]?.[g] != null || g === 'layout' && ov.cutLayouts?.[k]
      || ['enter', 'hold', 'exit'].includes(g) && line && motionManual(p, line));
  };
  function cueOf(plan, c, p, analysis) {
    const line = plan.lines.find(l => l.index === c.line), sections = p.studio?.analysis?.sections || [];
    return { stableKey: keyOf(plan, c), text: c.text, start: c.start, end: c.end,
      locked: !!p.overrides?.[c.line]?.lock,
      section: sections.find(s => c.start >= s.start && c.start < s.end)?.type ?? 'Unknown',
      emphasis: !!c.emph, energy: analysis && line ? J.studioLineEnergy(analysis, line) : undefined };
  }
  const planner = J.plan;
  function apply(plan, p) {
    const data = dataOf(p), generated = data?.schemaVersion === 1 && data.engineVersion === B.VERSION;
    if (!generated && !layer) return plan;
    const titleRecipe = generated && Object.values(data.recipes || {})[0];
    if (titleRecipe) for (const c of plan.cuts.filter(c => c.line < 0)) {
      if (!p.locks?.tech?.enter) { c.enter = 'bme_soft_fade'; c.inDur = Math.min(.7, c.dur * .25); }
      if (!p.locks?.tech?.exit) { c.exit = 'bme_soft_fade'; c.outDur = Math.min(.6, c.dur * .25); }
      if (!p.locks?.tech?.hold) c.hold = 'still';
      if (!p.locks?.tech?.cam) c.cam = 'bme_static';
      c.ballad = titleRecipe;
    }
    for (const c of plan.cuts) {
      const line = plan.lines.find(l => l.index === c.line);
      if (p.overrides?.[c.line]?.lock) { if (data?.lockedFx?.[c.line]) c.balladProtectedFx = data.lockedFx[c.line]; continue; }
      if (!line || c.layout === 'interlude') continue;
      const row = layer && J.studioOn(p, 'motionEditing') && p.studio?.motion?.rows[J.studioLineKey(line)];
      const r = generated && data.recipes?.[keyOf(plan, c)];
      const matches = r && r.text === c.text && r.start === c.start && r.end === c.end;
      const music = row?.source === 'ballad-auto' ? row : null;
      if (!matches && !music) continue;
      if (matches) {
        for (const g of ['layout', 'enter', 'hold', 'exit', 'treat', 'bg', 'cam']) {
          if (manual(p, plan, c, g)) continue;
          if (!J.registry(g)[r[g]]) continue;
          if (g === 'layout') {
            const L = J.LAYOUTS[r.layout]; if (L.fits && !L.fits([...c.text].length)) continue;
            c.layout = r.layout; c.params = L.plan(J.rng(r.seed), { text: c.text, n: [...c.text].length, W: c.zone?.w || plan.W, H: c.zone?.h || plan.H, dur: c.dur }, plan.style) || {};
          } else { c[g] = r[g]; if (['treat', 'bg', 'cam'].includes(g)) c[g + 'P'] = {}; }
        }
        if (!manual(p, plan, c, 'decor')) c.decor = r.decorations.map(id => ({ id, seed: r.seed, intensity: r.intensity }));
        if (!manual(p, plan, c, 'trans')) { c.trans = null; c.transDur = 0; delete c.morph; }
        if (!manual(p, plan, c, 'enter')) c.inDur = Math.min(c.dur * .25, r.inDuration);
        if (!manual(p, plan, c, 'exit')) c.outDur = Math.min(c.dur * .5 - c.inDur, r.outDuration);
        c.ballad = r;
        c.balladFx = { ...p.fx };
        if (!manual(p, plan, c, 'fx')) for (const [k, value] of Object.entries({ glitch: 0, chroma: 0, flash: false, koma: 0, onTwos: false, texture: 0, hud: 'off' })) if (!p.locks?.params?.[k]) c.balladFx[k] = value;
        if (c.renderLook) c.renderLook = { ...c.renderLook, fx: c.balladFx };
        delete c.kime; delete c.weightGrow;
        if (!manual(p, plan, c, 'fx')) plan.events = plan.events.filter(e => plan.evOwner?.get(e) !== c && !(e.line === c.line && e.cut === plan.cuts.filter(x => x.line === c.line && x.utext != null).indexOf(c)));
        if (c.companion) Object.assign(c.companion, { enter: c.enter, hold: c.hold, exit: c.exit, inDur: c.inDur, outDur: c.outDur, ballad: r, decor: [] });
      }
      if (music) {
        for (const g of ['enter', 'hold', 'exit']) if (!manual(p, plan, c, g) && J.registry(g)[music[g]]) c[g] = music[g];
        if (!manual(p, plan, c, 'enter')) c.inDur = Math.min(c.dur * .25, music.inDuration);
        if (!manual(p, plan, c, 'exit')) c.outDur = Math.min(c.dur * .5 - c.inDur, music.outDuration);
        c.ballad = music;
      }
      for (const [g, values] of Object.entries(data?.preserved?.[keyOf(plan, c)] || {})) {
        if (p.locks?.tech?.[g]) Object.assign(c, clone(values));
      }
    }
    // LayerRenderer renders the original group plans, whose cut indices are local.
    // Propagate only generated ballad fields into those cuts, keeping their local indices.
    for (const group of plan.layerGroups || []) {
      const generated = new Set();
      for (const c of group.plan.cuts) {
        const localLine = c.line, localIndex = c.index, globalLine = group.indices[localLine];
        const final = plan.cuts.find(x => x.line === globalLine && x.start === c.start && x.end === c.end && x.text === c.text);
        if (final?.ballad || final?.balladProtectedFx) { Object.assign(c, final, { line: localLine, index: localIndex }); if (!manual(p, plan, final, 'fx')) generated.add(c); }
      }
      group.plan.events = group.plan.events.filter(e => !generated.has(group.plan.evOwner?.get(e)));
    }
    return plan;
  }
  J.plan = (p, audio) => apply(planner(p, audio || dataOf(p)?.timingAudio || null), p);
  const unitKey = line => line.cueId != null ? 'cue-' + line.cueId : 'line-' + line.index;
  const unitSignature = ov => JSON.stringify([ov?.cuts ?? null, ov?.single ?? null, ov?.cutTime ?? null]);
  function unitsOf(plan, p) {
    return Object.fromEntries(plan.lines.map(line => [unitKey(line), { text: line.text, signature: unitSignature(p.overrides?.[line.index]), cuts: plan.cuts.filter(c => c.line === line.index && c.utext != null).map(c => ({ text: c.utext, w: c.dur, recap: !!c.recap })) }]));
  }
  function generate(p, value, mode = 'design', current, targetKey, audio) {
    const next = clone(p), previous = current || J.plan(p, null), s = B.settings(value);
    if (!layer) s.followEnergy = false;
    const old = normalize(dataOf(p));
    if (mode === 'design') {
      const rng = B.random(s.seed), styles = ['noir', 'specimen', 'mono'].filter(k => J.STYLES[k] && J.randomOk(p, 'style', k));
      if (!Object.values(p.overrides || {}).some(o => o.lock) && !p.locks?.params?.style && styles.length) next.style = styles[Math.floor(rng() * styles.length)];
      next.mood = s.preset === 'quiet' ? 'calm' : 'emotional';
      next.seed = p.locks?.params?.seed ? p.seed : s.seed;
      const pr = B.presets[s.preset], motion = pr.motion[0] + (pr.motion[1] - pr.motion[0]) * s.strength / 100;
      const fx = { motion, density: pr.density[0], decor: pr.decor[0], texture: 0, bgSwitch: 0, flash: false, onTwos: false, koma: 0, glitch: 0, chroma: 0, hud: 'off' };
      for (const [k, v] of Object.entries(fx)) if (!p.locks?.params?.[k]) next.fx[k] = v;
      for (const g of J.GROUP_KEYS) if (!p.locks?.tech?.[g]) next.enabled[g] = Object.fromEntries(J.order(g).map(k => [k, B.allowlists[g].includes(k) && (k.startsWith('bme_') || J.randomOk(p, g, k))]));
      // Manual overrides and their timing are deliberately retained, including manual FX and character data.
      delete next.localLooks;
      if (layer) next.lookTheme = 'ballad';
    }
    const hasGroupLocks = Object.values(p.locks?.tech || {}).some(Boolean);
    const data = { ...s, recipes: mode === 'cut' ? { ...(old?.recipes || {}) } : {}, units: mode === 'cut' || hasGroupLocks ? unitsOf(previous, p) : {}, preserved: mode === 'cut' ? { ...(old?.preserved || {}) } : {}, lockedFx: { ...(old?.lockedFx || {}) }, ...(old?.timingAudio ? { timingAudio: old.timingAudio } : {}) };
    if (audio?.duration) data.timingAudio = { duration: audio.duration, bpm: audio.bpm || 0, beats: audio.beats || [] };
    write(next, data);
    const plan = mode === 'cut' ? previous : J.plan(next, audio || null);
    data.units = unitsOf(plan, next);
    const analysis = layer && s.followEnergy && current?.energy ? { energy: current.energy, rate: current.energyRate || 50 } : null;
    const cuts = plan.cuts.filter(c => c.utext != null && c.layout !== 'interlude' && (!targetKey || keyOf(plan, c) === targetKey));
    const recipes = B.planBallad(cuts.map(c => cueOf(plan, c, next, analysis)), s, mode === 'cut' ? Object.fromEntries(J.GROUP_KEYS.map(g => [g, [...capsOf(next)[g], ...B.allowlists[g].filter(k => k.startsWith('bme_'))]])) : capsOf(next));
    for (const r of recipes) data.recipes[r.cueKey] = r;
    if (hasGroupLocks) for (const c of previous.cuts.filter(c => c.utext != null)) {
      const values = {};
      for (const g of J.GROUP_KEYS) if (p.locks.tech[g]) {
        const keys = { layout: ['layout', 'params', 'zone'], enter: ['enter', 'inDur'], hold: ['hold'], exit: ['exit', 'outDur'], decor: ['decor'], treat: ['treat', 'treatP'], bg: ['bg', 'bgP'], cam: ['cam', 'camP'], trans: ['trans', 'transP', 'transDur', 'morph'], fx: [] }[g];
        values[g] = Object.fromEntries(keys.filter(k => c[k] !== undefined).map(k => [k, clone(c[k])]));
      }
      data.preserved[keyOf(previous, c)] = values;
    }
    write(next, data);
    // Pin the prior draw of locked lines and groups so a changed style/seed cannot alter them.
    for (const line of previous.lines) {
      const ov = p.overrides?.[line.index], protectedLine = ov?.lock;
      if (!protectedLine) continue;
      next.overrides[line.index] = { ...clone(ov), lockedCuts: J.lineSnapshot(previous, line.index) };
      data.lockedFx[line.index] = clone(previous.cuts.find(c => c.line === line.index)?.renderLook?.fx || previous.fx);
    }
    return next;
  }
  const omakase = J.omakase;
  J.omakase = (p, rnd = Math.random, option) => {
    const theme = layer ? option?.theme ?? themeOf(p) : option ?? themeOf(p);
    if (theme !== 'ballad') {
      const result = omakase(p, rnd, layer ? option || {} : option);
      if (dataOf(p)) { const next = { ...p, ...result }; write(next, { ...B.settings(dataOf(p)), recipes: {} }); if (layer) result.studio = next.studio; else result.balladMotion = next.balladMotion; }
      return result;
    }
    const s = { ...B.settings(dataOf(p)), seed: Math.floor(rnd() * 4294967296) };
    if (!dataOf(p) && typeof matchMedia === 'function') s.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const live = J.ui?.project === p;
    return generate(p, s, 'design', live ? J.ui.plan : undefined, undefined, live ? J.uiApi.audioLike() : null);
  };
  if (layer) {
    const auto = J.studioAutoRecipes;
    J.studioAutoRecipes = (plan, analysis, sections, project) => {
      if (!project || themeOf(project) !== 'ballad') return auto(plan, analysis, sections);
      const s = B.settings(dataOf(project)), caps = Object.fromEntries(J.GROUP_KEYS.map(g => [g, J.order(g).filter(k => B.allowlists[g].includes(k) && (k.startsWith('bme_') || J.randomOk(project, g, k)))]));
      const rows = {};
      for (const line of plan.lines) {
        if (!line.text || line.interlude || project.overrides?.[line.index]?.lock || motionManual(project, line)) continue;
        const r = B.planBallad([{ stableKey: J.studioLineKey(line), text: line.text, start: line.start, end: line.end,
          section: (project.studio.analysis.sections || []).find(s => line.start >= s.start && line.start < s.end)?.type || 'Unknown',
          energy: s.followEnergy ? J.studioLineEnergy(analysis, line) : undefined }], s, caps)[0];
        if (r) rows[J.studioLineKey(line)] = r;
      }
      return rows;
    };
  }
  // Every output uses the same environment, including fixed reduction and per-cut intensity.
  const makeEnv = J.Renderer.prototype.makeEnv;
  J.Renderer.prototype.makeEnv = function(ctx, plan, cut, sc, opt) {
    const env = makeEnv.call(this, ctx, plan, cut, sc, opt);
    if (cut?.ballad) env.fx = { ...env.fx, motion: cut.ballad.intensity };
    return env;
  };
  const frame = J.Renderer.prototype.frame;
  J.Renderer.prototype.frame = function(ctx, plan, t, opt) {
    const c = J.cutAt(plan, t), fx = c?.balladProtectedFx || c?.balladFx;
    return frame.call(this, ctx, fx ? { ...plan, fx } : plan, t, opt);
  };
  if (layer) {
    const cueReroll = J.prepareCueReroll;
    J.prepareCueReroll = (p, plan, index, audio, mode = 'fine') => {
      if (themeOf(p) !== 'ballad' || ['color', 'font', 'global'].includes(mode)) return cueReroll(p, plan, index, audio, mode);
      if (p.overrides?.[index]?.lock) throw new Error(J.layerText('この字幕はロック中です。', 'This subtitle is locked.'));
      let next = p;
      for (const c of plan.cuts.filter(c => c.line === index && c.utext != null)) next = generate(next, { ...B.settings(dataOf(next)), seed: (B.settings(dataOf(next)).seed + 1) >>> 0 }, 'cut', plan, keyOf(plan, c), audio);
      if (!p.overrides?.[index]?.cueLook && !p.overrides?.[index]?.randomDraw && ['all', 'style', 'mood'].includes(mode)) {
        const rule = J.cueAppearanceRule(p, plan.cuts.find(c => c.line === index)?.renderLook?.style || plan.style);
        rule.source = 'ballad-auto'; rule.lookTheme = 'ballad'; rule.mood = B.settings(dataOf(next)).preset === 'quiet' ? 'calm' : 'emotional';
        next.overrides[index] = { ...next.overrides[index], cueLook: rule };
      }
      return next;
    };
  }
  J.ballad = { layer, dataOf, write, themeOf, normalize, generate, keyOf, apply, capsOf, unitKey, unitSignature };
})();
