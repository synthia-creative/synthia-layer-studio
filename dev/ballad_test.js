const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const sandbox = { window: {}, document: { documentElement: { lang: 'ja' }, createElement: () => ({ getContext: () => ({ measureText: t => ({ width: String(t).length * 20 }) }) }) }, console };
vm.createContext(sandbox);
for (const n of fs.readdirSync(path.join(__dirname, '../src')).filter(n => n.endsWith('.js') && n < '12').sort()) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', n), 'utf8'), sandbox, { filename: n });
const J = sandbox.window.J, B = J.BalladMotionEngine, json = v => JSON.parse(JSON.stringify(v));
const project = () => {
  const p = J.defaultProject(); p.lyrics = '[00:00.000]静かな朝\n[00:02.000]君の声を覚えてる\n[00:04.000]遠い空へ!';
  p.timing = { ...p.timing, offset: 0, snap: false, lineTimes: { 0: 0, 1: 2, 2: 4 }, lineEnds: { 0: 1.6, 1: 3.8, 2: 6 }, source: 'srt' };
  if (J.ballad.layer) p.theme = 'ballad'; else p.themeId = 'ballad';
  return p;
};
test('pure core is deterministic, order-independent, immutable and rejects malformed cues', () => {
  const cues = [{ stableKey: 'a', text: '声', start: 0, end: .4 }, { stableKey: 'b', text: '遠い空', start: 1, end: 4 }], before = json(cues), s = B.settings({ seed: 42 });
  const a = json(B.planBallad(cues, s, B.allowlists)); assert.deepEqual(a, json(B.planBallad(cues, s, B.allowlists)));
  assert.deepEqual(a, json(B.planBallad([...cues].reverse(), s, B.allowlists)).reverse()); assert.deepEqual(cues, before);
  assert.equal(B.planBallad([{ ...cues[0], start: NaN }, { ...cues[0], stableKey: '__proto__' }, { ...cues[0], locked: true }], s, {}).length, 0);
});
test('all presets and 100 seeds enforce duration, density, capabilities, caps and no off-genre filling', () => {
  for (const preset of Object.keys(B.presets)) for (let seed = 0; seed < 100; seed++) {
    const s = B.settings({ preset, seed, strength: 100, followEnergy: true });
    for (const r of B.planBallad([{ stableKey: 'tiny', text: '声', start: 0, end: .4, energy: 1 }, { stableKey: 'dense', text: '長い歌詞'.repeat(20), start: 1, end: 2 }, { stableKey: 'chorus', text: '声よ', start: 2, end: 6, section: 'Chorus', energy: 1 }], s, B.allowlists)) {
      assert(r.inDuration + r.outDuration <= (r.end - r.start) * .5 + 1e-10); assert(r.intensity <= B.presets[preset].cap);
      for (const g of ['layout', 'enter', 'hold', 'exit', 'cam', 'treat', 'bg']) assert(B.allowlists[g].includes(r[g]));
      if (r.cueKey !== 'chorus') { assert.equal(r.hold, 'still'); assert.equal(r.decorations.length, 0); }
    }
    const r = B.planBallad([{ stableKey: 'zero', text: '声', start: 0, end: 2 }], s, { enter: ['glitch'], hold: ['jitter'] })[0];
    assert.equal(r.enter, 'cut'); assert.equal(r.hold, 'still'); assert.equal(r.decorations.length, 0);
  }
});
test('app adapter: 3 presets x 100 seeds stay in the whitelist including emphasis and unify', () => {
  for (const preset of Object.keys(B.presets)) for (let seed = 0; seed < 100; seed++) {
    const p = project(); p.unify = true; J.ballad.write(p, { ...B.settings({ preset, seed }), recipes: {} });
    const next = J.omakase(p, B.random(seed), J.ballad.layer ? {} : 'ballad'), plan = J.plan(next, null);
    const cuts = plan.cuts.filter(c => c.utext != null);
    assert(cuts.length); assert(cuts.every(c => c.ballad), 'persisted recipe must match every generated cut');
    for (const c of cuts) {
      for (const g of ['layout', 'enter', 'hold', 'exit', 'cam', 'treat', 'bg']) assert(B.allowlists[g].includes(c[g]), g + ':' + c[g]);
      assert(c.decor.every(d => B.allowlists.decor.includes(d.id))); assert.equal(c.trans, null);
      assert(c.inDur + c.outDur <= c.dur * .5 + 1e-10);
    }
    assert.equal(plan.events.length, 0); assert.equal(next.fx.flash, false); assert.equal(next.fx.koma, 0); assert.equal(next.fx.glitch, 0);
  }
});
test('theme and pending settings alone leave existing plans unchanged', () => {
  const p = project(); if (J.ballad.layer) p.theme = ''; else p.themeId = null;
  const before = json(J.plan(p, null));
  if (J.ballad.layer) p.theme = 'ballad'; else p.themeId = 'ballad';
  assert.deepEqual(json(J.plan(p, null)), before);
  J.ballad.write(p, { ...B.settings({ preset: 'dramatic', strength: 100 }), recipes: {} });
  const after = json(J.plan(p, null)); delete after.studio?.balladMotion;
  assert.deepEqual(after, before);
});
test('saved recipes roundtrip without regeneration or audio; pending settings do not alter saved recipes', () => {
  const p = J.ballad.generate(project(), B.settings({ seed: 61 })), before = json(J.plan(p, null));
  const restored = json(p); const data = J.ballad.normalize(J.ballad.dataOf(restored)); J.ballad.write(restored, data);
  assert.deepEqual(json(J.plan(restored, null)), before);
  J.ballad.write(restored, { ...data, preset: 'quiet', strength: 100, reduceMotion: true });
  const loaded = json(restored); J.ballad.write(loaded, J.ballad.normalize(J.ballad.dataOf(loaded)));
  assert.deepEqual(json(J.ballad.dataOf(loaded).recipes), json(data.recipes));
});
test('manual overrides, group locks, locked lines and subtitle timestamps are preserved', () => {
  const p = project(); p.overrides = { 0: { enter: 'scramble', decor: ['sparks'], single: true, cutTech: { 0: { hold: 'jitter' } } }, 1: { lock: true, single: true } };
  const before = J.plan(p, null); p.overrides[1].lockedCuts = J.lineSnapshot(before, 1);
  p.locks.tech.cam = true; p.locks.params.motion = true;
  const original = json(p), next = J.ballad.generate(p, B.settings({ seed: 17 })), plan = J.plan(next, null);
  assert.deepEqual(json(p), original); assert.deepEqual(json(next.timing), original.timing); assert.equal(next.fx.motion, p.fx.motion);
  const cut = plan.cuts.find(c => c.line === 0); assert.equal(cut.enter, 'scramble'); assert.equal(cut.hold, 'jitter'); assert.equal(cut.decor[0].id, 'sparks');
  assert.deepEqual(json(plan.cuts.filter(c => c.line === 1)).map(c => { delete c.balladProtectedFx; return c; }), json(before.cuts.filter(c => c.line === 1)));
  assert.equal(cut.cam, before.cuts.find(c => c.line === 0).cam);
  assert.deepEqual(json(next.overrides[0]), original.overrides[0]);
});
test('single-cut reroll leaves every other recipe and cut unchanged', () => {
  const p = J.ballad.generate(project(), B.settings({ seed: 1 })), plan = J.plan(p, null), cut = plan.cuts.find(c => c.utext != null), key = J.ballad.keyOf(plan, cut);
  const next = J.ballad.generate(p, { ...J.ballad.dataOf(p), seed: 97 }, 'cut', plan, key), after = J.plan(next, null);
  for (const [k, r] of Object.entries(J.ballad.dataOf(p).recipes)) if (k !== key) assert.deepEqual(json(J.ballad.dataOf(next).recipes[k]), json(r));
  assert.deepEqual(json(plan.cuts.filter(c => J.ballad.keyOf(plan, c) !== key)), json(after.cuts.filter(c => J.ballad.keyOf(after, c) !== key)));
});
test('float/fade are bounded pure functions at a fixed timestamp', () => {
  const env = { W: 1920, H: 1080, lt: 5, cut: { ballad: { intensity: .78, seed: 4 } } }, make = () => ({ x: 500, y: 300, alpha: 1, seed: 7 });
  const a = make(), b = make(); J.HOLD.bme_gentle_float.apply(env, a); J.HOLD.bme_gentle_float.apply(env, b); assert.deepEqual(a, b); assert(Math.abs(a.y - 300) <= 8); assert(Math.abs(a.x - 500) <= 8);
  env.cut.ballad.reduceMotion = true; const still = make(); J.HOLD.bme_gentle_float.apply(env, still); assert.deepEqual(still, make());
  const fade = make(); J.ENTER.bme_soft_fade.apply(env, fade, .5); assert(fade.blur <= 12); assert.equal(fade.alpha, .5);
});
test('audio-independent restore keeps inferred timing and generated units', () => {
  const p = J.defaultProject(); p.lyrics = '静かな夜に\nこの声はまだ消えない';
  if (J.ballad.layer) p.theme = 'ballad'; else p.themeId = 'ballad';
  const audio = { duration: 12, bpm: 80, beats: [0, 1, 2, 3, 4, 5, 6], energy: [.1, .7, .3], energyRate: 1 }, plan = J.plan(p, audio);
  const next = J.ballad.generate(p, B.settings({ seed: 41 }), 'design', plan, undefined, audio);
  const generated = J.plan(next, audio), restored = J.plan(json(next), null);
  assert.deepEqual(json(restored.cuts), json(generated.cuts)); assert.deepEqual(json(next.timing), json(p.timing));
});
if (J.ballad.layer) test('Layer grouped normal/filler plans carry the final ballad recipes into the actual renderer', () => {
  const p = project(); p.subtitleCues = [{ id: 'a', text: '静かな声', start: 0, end: 2 }, { id: 'b', text: '遠い空へ', start: 2, end: 4, filler: true }];
  const next = J.ballad.generate(p, B.settings({ seed: 71 })), plan = J.plan(next, null);
  for (const g of plan.layerGroups || []) for (const c of g.plan.cuts.filter(c => c.utext != null)) {
    assert(c.ballad); assert(B.allowlists.layout.includes(c.layout)); assert(B.allowlists.hold.includes(c.hold));
  }
});
if (J.ballad.layer) test('Layer music fallback, manual Chorus/energy caps, manual rows and FX OFF', () => {
  const p = project(); p.studio.analysis.sections = [{ start: 0, end: 6, type: 'Chorus' }];
  J.ballad.write(p, { ...B.settings({ followEnergy: true, strength: 100, preset: 'quiet' }), recipes: {} });
  const plan = J.plan(p, null), rows = J.studioAutoRecipes(plan, { rate: 1, energy: [1, 1, 1, 1, 1, 1] }, [], p);
  assert(Object.values(rows).every(r => r.source === 'ballad-auto' && r.intensity <= .4 && r.hold !== 'jitter'));
  p.studio.motion.rows = rows; p.studio.flags.motionEditing = true;
  const normal = J.normalizeStudio(p.studio); assert(Object.values(normal.motion.rows).every(r => r.source === 'ballad-auto'));
  assert(J.plan(p, null).cuts.filter(c => c.utext != null).every(c => c.ballad));
  const first = J.studioLineKey(plan.lines[0]); p.studio.motion.rows[first] = J.studioPreset('Rock');
  const auto = J.studioAutoRecipes(plan, { rate: 1, energy: [] }, [], p); assert.equal(auto[first], undefined);
  const next = J.ballad.generate(p, B.settings({ seed: 77 })); assert.deepEqual(json(next.studio.instrumentalFx), json(p.studio.instrumentalFx)); assert.equal(next.studio.flags.musicAnalysis, false);
});
