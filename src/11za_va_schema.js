/* Video analysis is optional project data; master switches are session-only. */
(() => {
'use strict';
const V = J.VideoAnalysis = { version: '1.0.0', schema: 1, maxSamples: 1200, maxBytes: 16 * 1024 * 1024 };
V.finite = (n, fallback, min = 0, max = 86400) => Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
V.round = n => Math.round(n * 10000) / 10000;
V.abort = signal => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
V.options = value => ({
  quality: ['fast', 'standard', 'high'].includes(value?.quality) ? value.quality : 'standard',
  start: V.finite(value?.start, 0), end: V.finite(value?.end, 0),
  maxFrames: Math.round(V.finite(value?.maxFrames, 600, 2, V.maxSamples)),
  faceMargin: V.finite(value?.faceMargin, .15, 0, .8),
  features: Object.fromEntries(['motion', 'scene', 'brightness', 'face', 'person', 'safe'].map(k => [k, value?.features?.[k] !== false]))
});
V.quality = { fast: { width: 160, visionWidth: 320, fps: 1, visionEvery: 3 }, standard: { width: 240, visionWidth: 512, fps: 2, visionEvery: 2 }, high: { width: 320, visionWidth: 640, fps: 4, visionEvery: 1 } };
V.rect = value => {
  if (!value || !['x', 'y', 'w', 'h'].every(k => Number.isFinite(value[k]))) throw new Error('Invalid analysis rectangle');
  const x = V.finite(value.x, 0, 0, 1), y = V.finite(value.y, 0, 0, 1);
  return { x, y, w: V.finite(value.w, 0, 0, 1 - x), h: V.finite(value.h, 0, 0, 1 - y) };
};
V.regions = value => (Array.isArray(value) ? value : []).slice(0, 100).flatMap((r, i) => {
  try { const rect = V.rect(r), start = V.finite(r.start, 0), end = V.finite(r.end, 86400); if (rect.w <= 0 || rect.h <= 0 || end <= start) return [];
    return [{ ...rect, id: String(r.id || 'region-' + i).slice(0, 100), start, end, sourceHash: String(r.sourceHash || '').slice(0, 64) }];
  } catch (_) { return []; }
});
V.source = value => {
  if (!value || !Number.isFinite(value.size) || value.size < 1 || !Number.isFinite(value.width) || !Number.isFinite(value.height) || value.width < 1 || value.height < 1 || !/^[a-f0-9]{64}$/.test(value.hash || '')) throw new Error('Invalid analysis source');
  if (value.kind !== 'image' && value.kind !== 'video') throw new Error('Invalid media kind');
  if (value.kind === 'video' && (!Number.isFinite(value.duration) || value.duration <= 0)) throw new Error('Invalid video duration');
  return { name: String(value.name || '').slice(0, 256), size: value.size, width: value.width, height: value.height, duration: value.kind === 'video' ? value.duration : null, fps: null, kind: value.kind, hash: value.hash, hashMode: value.hashMode === 'full' ? 'full' : 'sampled-3x1MiB' };
};
V.sameSource = (a, b) => !!a && !!b && a.hash === b.hash && a.size === b.size && a.width === b.width && a.height === b.height && a.kind === b.kind && (a.kind === 'image' || Math.abs(a.duration - b.duration) < .01);
V.numberArray = (a, length) => { if (!Array.isArray(a) || a.length !== length || !a.every(Number.isFinite)) throw new Error('Invalid analysis grid'); return a.map(n => V.round(V.finite(n, 0, 0, 1))); };
V.validateResult = value => {
  if (value?.format !== 'synthia-video-analysis' || value.schemaVersion !== V.schema) throw new Error('Unsupported analysis schema');
  if (!Array.isArray(value.samples) || !value.samples.length || value.samples.length > V.maxSamples) throw new Error('Invalid analysis sample count');
  const source = V.source(value.source), options = V.options(value.options), range = { start: V.finite(value.range?.start, NaN), end: V.finite(value.range?.end, NaN) };
  if (!(range.end > range.start)) throw new Error('Invalid analysis range');
  let last = -Infinity;
  const samples = value.samples.map(s => {
    if (!Number.isFinite(s.t) || s.t < range.start - .001 || s.t > range.end + .001 || s.t <= last) throw new Error('Invalid analysis timestamps'); last = s.t;
    const faces = (Array.isArray(s.faces) ? s.faces : []).slice(0, 32).map(f => ({ ...V.rect(f), score: V.finite(f.score, 0, 0, 1), trackId: String(f.trackId || '').slice(0, 60), estimated: f.estimated === true }));
    const motion = s.motion ? { dx: V.finite(s.motion.dx, 0, -100, 100), dy: V.finite(s.motion.dy, 0, -100, 100), strength: V.finite(s.motion.strength, 0, 0, 1), confidence: V.finite(s.motion.confidence, 0, 0, 1), regions: V.numberArray(s.motion.regions, 48) } : null;
    const brightness = s.brightness ? { mean: V.finite(s.brightness.mean, 0, 0, 1), min: V.finite(s.brightness.min, 0, 0, 1), max: V.finite(s.brightness.max, 1, 0, 1), contrast: V.finite(s.brightness.contrast, 0, 0, 1), rgb: V.numberArray(s.brightness.rgb, 3), light: V.numberArray(s.brightness.light, 48), complexity: V.numberArray(s.brightness.complexity, 48) } : null;
    const person = s.person ? { grid: V.numberArray(s.person.grid, 144), occupancy: V.finite(s.person.occupancy, 0, 0, 1), confidence: V.finite(s.person.confidence, 0, 0, 1), box: s.person.box ? V.rect(s.person.box) : null, estimated: s.person.estimated === true } : null;
    return { t: s.t, videoTime: V.finite(s.videoTime, s.t), brightness, motion, faces, person, visionSample: s.visionSample === true, change: ['cut', 'flash', 'fade'].includes(s.change) ? s.change : null, changeScore: V.finite(s.changeScore, 0, 0, 1) };
  });
  const scenes = (Array.isArray(value.scenes) ? value.scenes : []).slice(0, V.maxSamples).map((s, i) => ({ id: 'scene-' + i, start: V.finite(s.start, range.start, range.start, range.end), end: V.finite(s.end, range.end, range.start, range.end) })).filter(s => s.end > s.start);
  const safeZones = {};
  for (const [key, zone] of Object.entries(value.safeZones || {}).slice(0, 2000)) if (/^line-\d+$|^cue-.{1,100}$/.test(key)) {
    try { safeZones[key] = { text: String(zone.text || '').slice(0, 10000), start: V.finite(zone.start, 0), end: V.finite(zone.end, 0), candidates: (Array.isArray(zone.candidates) ? zone.candidates : []).slice(0, 3).map(c => ({ rect: V.rect(c.rect), score: V.finite(c.score, 0, 0, 100), safe: c.safe === true, reasons: (Array.isArray(c.reasons) ? c.reasons : []).filter(r => ['coverage','face-unavailable','person-unavailable','brightness-unavailable','face-overlap','person-overlap','protected-overlap','subtitle-overlap','contrast'].includes(r)), faceRisk: V.finite(c.faceRisk, 0, 0, 1), personRisk: V.finite(c.personRisk, 0, 0, 1), manualRisk: V.finite(c.manualRisk, 0, 0, 1), subtitleRisk: V.finite(c.subtitleRisk, 0, 0, 1), confidence: V.finite(c.confidence, 0, 0, 1), readable: V.finite(c.readable, 0, 0, 1), covered: c.covered === true, position: String(c.position || '').slice(0, 50), recommendedColor: /^#[0-9a-f]{6}$/i.test(c.recommendedColor || '') ? c.recommendedColor : '#ffffff' })) }; } catch (_) { /* Invalid suggestions never prevent ordinary editing. */ }
  }
  return { format: value.format, schemaVersion: V.schema, engineVersion: V.version, source, options, range, samples, scenes, safeZones, createdAt: String(value.createdAt || '').slice(0, 40), elapsedMs: V.finite(value.elapsedMs, 0, 0, 1e12), mapping: { projectStart: 0, videoStart: 0, speed: 1, loop: false, holdLastFrame: true }, models: { runtime: String(value.models?.runtime || '').slice(0, 100), face: String(value.models?.face || '').slice(0, 100), person: String(value.models?.person || '').slice(0, 100) }, warnings: (Array.isArray(value.warnings) ? value.warnings : []).slice(0, 30).map(w => String(w).slice(0, 500)) };
};
V.placements = value => {
  const out = {};
  for (const [key, p] of Object.entries(value || {}).slice(0, 20000)) if (/^line-\d+$|^cue-.{1,100}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key) && Number.isFinite(p.dx) && Number.isFinite(p.dy)) out[key] = { dx: V.finite(p.dx, 0, -2, 2), dy: V.finite(p.dy, 0, -2, 2), text: String(p.text || '').slice(0, 10000) };
  return out;
};
J.normalizeVideoAnalysis = value => {
  let result = null, warning = '';
  if (value?.result) try { result = V.validateResult(value.result); } catch (e) { warning = e.message; }
  return { options: V.options(value?.options), regions: V.regions(value?.regions), placements: V.placements(value?.placements), result, loadWarning: warning };
};
const defaults = J.defaultProject, upgrade = J.upgradeLayerProject, planner = J.plan;
J.defaultProject = () => ({ ...defaults(), videoAnalysis: J.normalizeVideoAnalysis() });
J.upgradeLayerProject = (project, source) => { upgrade(project, source); project.videoAnalysis = J.normalizeVideoAnalysis(source?.videoAnalysis); return project; };
J.plan = (project, audio) => Object.assign(planner(project, audio), { videoPlacements: V.placements(project.videoAnalysis?.placements) });
})();
