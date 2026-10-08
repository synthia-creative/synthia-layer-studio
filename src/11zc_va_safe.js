/* Safe Zone scores are heuristic preferences, separate from model confidence. */
(() => {
'use strict';
const V = J.VideoAnalysis;
V.weights = { face: .45, person: .22, complexity: .1, readability: .1, motion: .08, edge: .05 };
V.overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) / Math.max(.000001, a.w * a.h);
V.expand = (r, margin) => { const x = Math.max(0, r.x - r.w * margin), y = Math.max(0, r.y - r.h * margin); return { x, y, w: Math.min(1, r.x + r.w * (1 + margin)) - x, h: Math.min(1, r.y + r.h * (1 + margin)) - y }; };
V.fit = (source, width, height) => { const scale = Math.min(width / source.width, height / source.height), w = source.width * scale / width, h = source.height * scale / height; return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }; };
V.toVideo = (rect, fit) => ({ x: (rect.x - fit.x) / fit.w, y: (rect.y - fit.y) / fit.h, w: rect.w / fit.w, h: rect.h / fit.h });
V.toProject = (rect, fit) => ({ x: fit.x + rect.x * fit.w, y: fit.y + rect.y * fit.h, w: rect.w * fit.w, h: rect.h * fit.h });
V.gridMean = (grid, cols, rows, rect) => {
  if (!grid) return null; let weight = 0, sum = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const cell = { x: x / cols, y: y / rows, w: 1 / cols, h: 1 / rows }, a = V.overlap(rect, cell); sum += a * grid[y * cols + x]; weight += a; }
  return weight ? sum / weight : 0;
};
V.evaluateSafe = (result, regions, interval, envelope, textLuminance = 1, others = []) => {
  if (!result || !envelope || !result.options.features.safe) return [];
  const gap = result.samples.length > 1 ? Math.max(...result.samples.slice(1).map((s, i) => s.t - result.samples[i].t)) : 0;
  const hold = result.source.kind === 'video' && result.range.end >= result.source.duration - .01;
  const active = result.source.kind === 'image' ? result.samples : hold && interval.start >= result.source.duration ? [result.samples.at(-1)] : result.samples.filter(s => s.t >= interval.start - gap && s.t <= interval.end + gap);
  if (!active.length || envelope.w > .94 || envelope.h > .94) return [];
  const covered = result.source.kind === 'image' || interval.start >= result.range.start && (interval.end <= result.range.end + .001 || hold) && (interval.start >= result.source.duration && hold || gap <= 1.1);
  const faceReady = !!result.models.face, personReady = !!result.models.person, brightnessReady = result.options.features.brightness;
  const manual = regions.filter(r => r.sourceHash === result.source.hash && r.start < interval.end && r.end > interval.start);
  const candidates = [], margin = result.options.faceMargin;
  const sameScene = (a, b) => result.scenes.length ? result.scenes.some(s => a.t >= s.start && a.t <= s.end && b.t >= s.start && b.t <= s.end) : Math.abs(a.t - b.t) <= Math.max(1, gap * 2);
  for (let iy = 0; iy < 9; iy++) for (let ix = 0; ix < 13; ix++) {
    const rect = { x: .03 + ix / 12 * (.94 - envelope.w), y: .03 + iy / 8 * (.94 - envelope.h), w: envelope.w, h: envelope.h };
    let faceRisk = 0, personRisk = 0, complexity = 0, motion = 0, readable = 1, faceConfidence = .6, collisions = 0;
    const manualRisk = Math.max(0, ...manual.map(r => V.overlap(rect, r))), subtitleRisk = Math.max(0, ...others.map(r => V.overlap(rect, r)));
    for (const sample of active) {
      const nearby = active.filter(s => s.visionSample && Math.abs(s.t - sample.t) <= Math.max(1, gap * 2) && sameScene(sample, s));
      const faces = nearby.flatMap(s => s.faces || []);
      const risk = Math.max(0, ...faces.map(f => { const protectedFace = V.expand(f, margin + (f.estimated ? .2 : 0)); return Math.max(V.overlap(rect, protectedFace), V.overlap(protectedFace, rect)); }));
      faceRisk = Math.max(faceRisk, risk); if (risk > .01) collisions++;
      if (faces.length) faceConfidence = Math.min(faceConfidence, ...faces.map(f => f.score));
      personRisk = Math.max(personRisk, ...nearby.map(s => V.gridMean(s.person?.grid, 16, 9, rect) || 0));
      complexity += V.gridMean(sample.brightness?.complexity, 8, 6, rect) || 0;
      motion += V.gridMean(sample.motion?.regions, 8, 6, rect) || 0;
      const lum = V.gridMean(sample.brightness?.light, 8, 6, rect);
      if (lum != null) { const bg = lum <= .04045 ? lum / 12.92 : ((lum + .055) / 1.055) ** 2.4, ratio = (Math.max(textLuminance, bg) + .05) / (Math.min(textLuminance, bg) + .05); readable = Math.min(readable, Math.min(1, ratio / 4.5)); }
    }
    complexity /= active.length; motion /= active.length;
    const edge = Math.max(0, 1 - Math.min(rect.x, rect.y, 1 - rect.x - rect.w, 1 - rect.y - rect.h) / .06), weights = V.weights;
    let penalty = weights.face * Math.max(faceRisk, collisions / active.length * .5) + weights.person * personRisk + weights.complexity * complexity + weights.readability * (1 - readable) + weights.motion * motion + weights.edge * edge;
    if (manualRisk > 0 || subtitleRisk > 0) penalty = Math.max(.85, penalty);
    const score = Math.max(0, Math.round(100 * (1 - penalty))), safe = covered && faceRisk < .02 && manualRisk === 0 && subtitleRisk === 0 && personRisk < .2 && readable >= .5 && faceReady && personReady && brightnessReady;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    candidates.push({ rect, score, safe, faceRisk, personRisk, manualRisk, subtitleRisk, readable: V.round(readable), confidence: V.round((faceReady ? faceConfidence : .25) * (personReady ? 1 : .5) * (covered ? 1 : .5)), covered, position: [cx < .4 ? 'left' : cx > .6 ? 'right' : 'center', cy < .4 ? 'top' : cy > .6 ? 'bottom' : 'middle'].join('-'), recommendedColor: active.reduce((sum, s) => sum + (V.gridMean(s.brightness?.light, 8, 6, rect) || 0), 0) / active.length > .5 ? '#000000' : '#ffffff' });
  }
    candidates.sort((a, b) => Number(b.safe) - Number(a.safe) || b.score - a.score);
  const chosen = [];
  for (const c of candidates) if (chosen.every(r => Math.hypot(c.rect.x - r.rect.x, c.rect.y - r.rect.y) > .18)) { chosen.push(c); if (chosen.length === 3) break; }
  return chosen;
};
V.evaluateSafeAsync = (result, regions, interval, envelope, luminance, others, signal) => new Promise((resolve, reject) => {
  let url, worker;
  const stop = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); }, clean = () => { signal?.removeEventListener('abort', stop); worker?.terminate(); if (url) URL.revokeObjectURL(url); };
  try {
    V.abort(signal);
    const functions = ['round', 'overlap', 'expand', 'gridMean', 'evaluateSafe'];
    const code = 'const V={weights:' + JSON.stringify(V.weights) + '};' + functions.map(k => 'V.' + k + '=' + V[k].toString() + ';').join('') + 'self.onmessage=e=>{try{self.postMessage({result:V.evaluateSafe(...e.data)});}catch(error){self.postMessage({error:error.message});}};';
    url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); worker = new Worker(url); signal?.addEventListener('abort', stop, { once: true });
    worker.onmessage = e => { clean(); if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.result); };
    worker.onerror = e => { clean(); reject(new Error(e.message)); };
    worker.postMessage([result, regions, interval, envelope, luminance, others]);
  } catch (e) { clean(); reject(e); }
});
})();
