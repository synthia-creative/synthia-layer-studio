/* Ballad Motion Engine 1.0.0. Pure, shared source; sync with tools/sync_ballad_core.py. */
(() => {
  'use strict';
  const VERSION = '1.0.0';
  const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
  const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
  const presets = Object.freeze({
    quiet: Object.freeze({ strength: 25, cap: .40, motion: [.20, .35], density: [.20, .32], decor: [.04, .14] }),
    emotional: Object.freeze({ strength: 35, cap: .60, motion: [.35, .55], density: [.26, .42], decor: [.12, .26] }),
    dramatic: Object.freeze({ strength: 55, cap: .78, motion: [.50, .70], density: [.32, .48], decor: [.18, .36] }),
  });
  const allowlists = Object.freeze(Object.fromEntries(Object.entries({
    layout: ['bme_center', 'center'], enter: ['bme_soft_fade', 'blur', 'cut'],
    hold: ['still', 'bme_gentle_float'], exit: ['bme_soft_fade', 'blur', 'cut'],
    decor: ['bme_light_trace', 'bme_emotional_bloom'], treat: ['none'], bg: ['none'],
    cam: ['bme_static', 'bme_gentle_push'], fx: [], trans: [],
  }).map(([k, v]) => [k, Object.freeze(v)])));
  function settings(value = {}) {
    const preset = Object.hasOwn(presets, value?.preset) ? value.preset : 'emotional';
    return { schemaVersion: 1, engineVersion: VERSION, preset,
      strength: Math.round(clamp(finite(value?.strength, presets[preset].strength), 0, 100)),
      followEnergy: value?.followEnergy === true, reduceMotion: value?.reduceMotion === true,
      seed: finite(value?.seed, 20261014) >>> 0 };
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function random(seed) {
    let s = seed >>> 0;
    return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function candidates(group, capabilities) {
    const available = Array.isArray(capabilities?.[group]) ? capabilities[group] : [];
    return allowlists[group].filter(k => available.includes(k));
  }
  function pick(group, caps, rng, weights = {}, fallback = '') {
    const pool = candidates(group, caps).map(k => [k, finite(weights[k], 1)]).filter(([, w]) => w > 0);
    const total = pool.reduce((n, [, w]) => n + w, 0);
    let n = rng() * total;
    for (const [key, weight] of pool) { n -= weight; if (n < 0) return key; }
    return fallback; // a neutral renderer identity is safe even if the registry is unavailable
  }
  function intensity(cue, value) {
    const s = settings(value), p = presets[s.preset];
    let base = s.strength / 100;
    if (s.followEnergy && Number.isFinite(cue.energy)) base += clamp(cue.energy) * .12;
    if (cue.section === 'Chorus') base += .08;
    if (cue.section === 'Verse' || cue.section === 'Intro') base *= .8;
    if (s.strength === 0) base = 0;
    return clamp(base, 0, p.cap);
  }
  function planBallad(cues, value, capabilities = {}) {
    const s = settings(value), result = [], seen = new Set();
    if (!Array.isArray(cues)) return result;
    for (const cue of cues.slice(0, 20000)) {
      if (!cue || cue.locked || typeof cue.stableKey !== 'string' || !cue.stableKey || cue.stableKey.length > 256
        || ['__proto__', 'constructor', 'prototype'].includes(cue.stableKey) || seen.has(cue.stableKey)
        || typeof cue.text !== 'string' || cue.text.length > 20000 || !cue.text.trim()
        || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start) continue;
      seen.add(cue.stableKey);
      const seed = hash(s.seed + ':' + cue.stableKey + ':' + s.preset), rng = random(seed);
      const dur = cue.end - cue.start, n = [...cue.text.replace(/\s/g, '')].length;
      const short = dur < .75, dense = n > 32 || n / dur > 8, amount = intensity(cue, s);
      let inDuration = short ? dur * .15 : .45 + .4 * rng();
      let outDuration = short ? dur * .15 : .35 + .35 * rng();
      const ratio = Math.min(1, dur * .5 / (inDuration + outDuration));
      inDuration *= ratio; outDuration *= ratio;
      const enter = candidates('enter', capabilities).includes('bme_soft_fade') ? 'bme_soft_fade' : pick('enter', capabilities, rng, { blur: 1, cut: .1 }, 'cut');
      const exit = candidates('exit', capabilities).includes('bme_soft_fade') ? 'bme_soft_fade' : pick('exit', capabilities, rng, { blur: 1, cut: .1 }, 'cut');
      const hold = short || dense || s.reduceMotion || !amount ? 'still'
        : pick('hold', capabilities, rng, { still: 1, bme_gentle_float: s.preset === 'quiet' ? 5 : 3 }, 'still');
      const decorations = [];
      if (!short && !dense && !s.reduceMotion && amount > 0) {
        if (candidates('decor', capabilities).includes('bme_light_trace') && rng() < (s.preset === 'quiet' ? .18 : .55)) decorations.push('bme_light_trace');
        const accent = cue.section === 'Chorus' || cue.section === 'Outro' || cue.emphasis === true && n <= 12 && dur >= 1.5;
        if (s.preset !== 'quiet' && accent && candidates('decor', capabilities).includes('bme_emotional_bloom') && rng() < .65) decorations.push('bme_emotional_bloom');
      }
      result.push({ cueKey: cue.stableKey, text: cue.text, start: cue.start, end: cue.end,
        layout: candidates('layout', capabilities).includes('bme_center') ? 'bme_center' : 'center',
        enter, hold, exit, decorations, treat: 'none', bg: 'none',
        cam: s.reduceMotion || short || dense || !amount ? 'bme_static' : pick('cam', capabilities, rng, { bme_static: 4, bme_gentle_push: 1 }, 'bme_static'),
        inDuration: enter === 'cut' ? 0 : inDuration, outDuration: exit === 'cut' ? 0 : outDuration,
        intensity: amount, seed, reduceMotion: s.reduceMotion, source: 'ballad-auto' });
    }
    return result;
  }
  const api = Object.freeze({ VERSION, presets, allowlists, settings, hash, random, candidates, intensity, planBallad });
  if (typeof J !== 'undefined') J.BalladMotionEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
