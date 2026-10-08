/* Bounded CPU block matching, luminance/chroma histograms and regional statistics. */
(() => {
'use strict';
const V = J.VideoAnalysis;
V.metrics = function metrics(rgba, w, h, previous, dt, useMotion) {
  const gray = new Uint8Array(w * h), hist = new Float32Array(48), count = new Uint32Array(48), light = new Float32Array(48), complex = new Float32Array(48), motionRegions = Array(48).fill(0), rgb = [0, 0, 0];
  let sum = 0, sum2 = 0, min = 255, max = 0, diff = 0, structured = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, j = i * 4, r = rgba[j], g = rgba[j + 1], b = rgba[j + 2], l = gray[i] = Math.round(.2126 * r + .7152 * g + .0722 * b), region = Math.min(5, Math.floor(y / h * 6)) * 8 + Math.min(7, Math.floor(x / w * 8));
    count[region]++; light[region] += l / 255; sum += l; sum2 += l * l; min = Math.min(min, l); max = Math.max(max, l);
    rgb[0] += r; rgb[1] += g; rgb[2] += b;
    // Chromatic differences resist global exposure changes.
    hist[Math.min(15, Math.floor((r - g + 255) / 511 * 16))]++; hist[16 + Math.min(15, Math.floor((b - g + 255) / 511 * 16))]++; hist[32 + Math.min(15, l >> 4)]++;
    if (x > 0) complex[region] += Math.abs(l - gray[i - 1]) > 25 ? 1 : 0;
    if (y > 0) complex[region] += Math.abs(l - gray[i - w]) > 25 ? 1 : 0;
    if (previous && previous.gray.length === gray.length) diff += Math.abs(l - previous.gray[i]) / 255;
  }
  const n = w * h, mean = sum / n / 255, contrast = Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2)) / 255;
  for (let i = 0; i < 48; i++) { light[i] /= count[i] || 1; complex[i] /= 2 * (count[i] || 1); hist[i] /= n; }
  const chroma = previous ? hist.slice(0, 32).reduce((s, v, i) => s + Math.abs(v - previous.hist[i]), 0) / 4 : 0;
  const lumaDiff = previous ? Math.abs(mean - previous.mean) : 0;
  const edgeDiff = previous ? complex.reduce((s, v, i) => s + Math.abs(v - previous.complex[i]), 0) / 48 : 0;
  const changeScore = Math.min(1, chroma * .6 + diff / n * .4);
  let change = previous && (chroma > .32 || (diff / n > .32 && edgeDiff > .08)) ? 'cut' : previous && lumaDiff > .25 && chroma < .12 ? 'flash' : previous && lumaDiff > .08 && chroma < .2 ? 'fade' : null;
  const vectors = [];
  if (useMotion && previous && previous.gray.length === gray.length && !change && dt > 0) {
    // Sparse textured blocks; an aperture/untextured match is not evidence of motion.
    const step = Math.max(10, Math.floor(Math.min(w, h) / 6)), radius = Math.min(6, Math.max(2, Math.floor(w / 40)));
    for (let y = 5 + radius; y < h - 5 - radius; y += step) for (let x = 5 + radius; x < w - 5 - radius; x += step) {
      let energy = 0; for (let by = -3; by <= 3; by += 2) for (let bx = -3; bx <= 3; bx += 2) energy += Math.abs(previous.gray[(y + by) * w + x + bx] - previous.gray[(y + by) * w + x + bx + 1]);
      if (energy < 70) continue; structured++;
      let best = Infinity, second = Infinity, dx = 0, dy = 0;
      for (let vy = -radius; vy <= radius; vy++) for (let vx = -radius; vx <= radius; vx++) {
        let err = 0; for (let by = -3; by <= 3; by += 2) for (let bx = -3; bx <= 3; bx += 2) err += Math.abs(previous.gray[(y + by) * w + x + bx] - gray[(y + by + vy) * w + x + bx + vx]);
        if (err < best || (err === best && Math.hypot(vx, vy) < Math.hypot(dx, dy))) { second = best; best = err; dx = vx; dy = vy; } else second = Math.min(second, err);
      }
      if (best > 1000 || second - best < 8) continue;
      const region = Math.min(5, Math.floor(y / h * 6)) * 8 + Math.min(7, Math.floor(x / w * 8)), strength = Math.min(1, Math.hypot(dx / w, dy / h) / dt * 10);
      motionRegions[region] = Math.max(motionRegions[region], strength); vectors.push({ dx: dx / w / dt, dy: dy / h / dt, confidence: Math.min(1, (second - best) / (second + 1)) });
    }
  }
  const median = a => a.length ? a.sort((a, b) => a - b)[Math.floor(a.length / 2)] : 0;
  const dx = median(vectors.map(v => v.dx)), dy = median(vectors.map(v => v.dy)), strength = vectors.length ? vectors.reduce((s, v) => s + Math.hypot(v.dx, v.dy), 0) / vectors.length : 0;
  const round = v => Math.round(v * 10000) / 10000;
  return { state: { gray, hist, mean, complex }, brightness: { mean: round(mean), min: round(min / 255), max: round(max / 255), contrast: round(contrast), rgb: rgb.map(v => round(v / n / 255)), light: Array.from(light, round), complexity: Array.from(complex, round) }, motion: { dx: round(dx), dy: round(dy), strength: round(Math.min(1, strength * 10)), confidence: round(vectors.length / Math.max(1, structured) * (vectors.length ? vectors.reduce((s, v) => s + v.confidence, 0) / vectors.length : 0)), regions: motionRegions.map(round) }, change, changeScore: round(changeScore) };
};
V.finalizeScenes = (samples, range, enabled) => {
  if (!enabled) { for (const s of samples) { s.change = null; s.changeScore = 0; } return []; }
  // A brief returning brightness event is a flash, not two scene boundaries.
  for (let i = 1; i < samples.length - 1; i++) if (samples[i].change === 'flash' && samples[i + 1].change === 'flash') samples[i + 1].change = 'flash';
  const starts = [range.start, ...samples.filter(s => s.change === 'cut' && s.t > range.start && s.t < range.end).map(s => s.t)];
  return starts.map((start, i) => ({ id: 'scene-' + i, start, end: starts[i + 1] ?? range.end }));
};
})();
