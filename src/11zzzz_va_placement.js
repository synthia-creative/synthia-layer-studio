/* Translate lyric glyphs through the existing renderer, including matte/front passes. */
(() => {
'use strict';
const V = J.VideoAnalysis, draw = J.drawItem;
V.lineKey = line => line?.cueId ? 'cue-' + line.cueId : 'line-' + line.index;
V.layerDelta = (plan, dx, dy, inverse = true) => {
  if (!plan.studio?.flags.timeline) return { dx, dy };
  const layer = plan.studio.layers.find(l => l.type === 'Lyrics'); if (!layer) return { dx, dy };
  const p = layer.transform, angle = (inverse ? -1 : 1) * p.rotation * Math.PI / 180, scale = inverse ? 1 / p.scale : p.scale;
  const x = dx * plan.W, y = dy * plan.H;
  return { dx: scale * (Math.cos(angle) * x - Math.sin(angle) * y) / plan.W, dy: scale * (Math.sin(angle) * x + Math.cos(angle) * y) / plan.H };
};
J.drawItem = (env, it) => {
  const line = env.plan?.lines?.find(l => l.index === env.cut?.line), key = V.lineKey(line), p = (V.previewing && V.previewPlacements?.[key]) || env.plan?.videoPlacements?.[key];
  const lyric = line && !env.bgOnly && !env.inLayer && it.text && J.studioGlyphMap(line.text, it.text).found;
  if (!lyric) return draw(env, it);
  const ctx = env.ctx, capture = V.capture, originalGlyph = env.studioGlyph;
  const withCapture = capture && env.pass === 'main' ? { ...env, studioGlyph: (g, m, bases) => {
    originalGlyph?.(g, m, bases);
    const w = Math.abs(m.a) * g.w + Math.abs(m.c) * g.h, h = Math.abs(m.b) * g.w + Math.abs(m.d) * g.h, pad = Math.max(3, ((it.stroke || 0) + (it.blur || 0) * 3 + (it.shadow?.blur || 0) * 2) * (env.scale || 1));
    capture.push({ key, x: (m.e - w / 2 - pad) / ctx.canvas.width, y: (m.f - h / 2 - pad) / ctx.canvas.height, w: (w + pad * 2) / ctx.canvas.width, h: (h + pad * 2) / ctx.canvas.height, color: it.color || '#ffffff' });
  } } : env;
  if (!p || p.text !== line.text) return draw(withCapture, it);
  const delta = V.layerDelta(env.plan, p.dx, p.dy), dx = delta.dx * ctx.canvas.width, dy = delta.dy * ctx.canvas.height, m = ctx.getTransform(), det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-9) return draw(withCapture, it);
  ctx.save(); ctx.translate((m.d * dx - m.c * dy) / det, (-m.b * dx + m.a * dy) / det);
  try { return draw(withCapture, it); } finally { ctx.restore(); }
};
V.union = rects => { if (!rects.length) return null; const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y)); return { x, y, w: Math.max(...rects.map(r => r.x + r.w)) - x, h: Math.max(...rects.map(r => r.y + r.h)) - y }; };
V.layerRect = (plan, rect) => {
  if (!plan.studio?.flags.timeline) return rect;
  const layer = plan.studio.layers.find(l => l.type === 'Lyrics'); if (!layer) return rect;
  const p = layer.transform, angle = p.rotation * Math.PI / 180, points = [];
  for (const x of [rect.x, rect.x + rect.w]) for (const y of [rect.y, rect.y + rect.h]) { const px = (x - .5) * plan.W, py = (y - .5) * plan.H; points.push({ x: .5 + p.x / plan.W + p.scale * (Math.cos(angle) * px - Math.sin(angle) * py) / plan.W, y: .5 + p.y / plan.H + p.scale * (Math.sin(angle) * px + Math.cos(angle) * py) / plan.H, w: 0, h: 0 }); }
  return V.union(points);
};
V.measureLine = async (plan, line, signal, onProgress = () => {}) => {
  const width = 480, height = Math.max(8, Math.round(width * plan.H / plan.W)), renderer = new J.LayerRenderer(width, height, J.normalizeLayerMode(J.ui.project.layerMode));
  const times = new Set(V.times(line.start, line.end, 8, 160).map(t => Math.min(line.end - .001, t)));
  for (const c of plan.cuts.filter(c => c.line === line.index)) for (const t of [c.start + .001, c.start + c.inDur, c.end - c.outDur, c.end - .001]) if (t >= line.start && t < line.end) times.add(t);
  const bounds = [], others = [], colors = []; let i = 0;
  try {
    for (const t of [...times].sort((a, b) => a - b)) {
      V.abort(signal); V.capture = []; renderer.draw(plan, t, false);
      const hits = V.capture; V.capture = null;
      const lyric = hits.filter(h => h.key === V.lineKey(line)), rect = V.union(lyric);
      if (rect) { bounds.push(V.layerRect(plan, rect)); colors.push(...lyric.map(h => h.color)); }
      for (const other of hits.filter(h => h.key !== V.lineKey(line))) others.push(V.layerRect(plan, other));
      onProgress(++i / times.size);
      if (i % 4 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const rect = V.union(bounds); if (!rect) throw new Error(J.layerText('字幕の描画領域を測定できません。時刻と表示設定を確認してください。', 'No lyric bounds were captured. Check timing and display settings.'));
    const color = colors.find(c => /^#[0-9a-f]{6}$/i.test(c)) || '#ffffff', components = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255), linear = components.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return { rect, others, color, luminance: .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2], frames: times.size };
  } finally { V.capture = null; renderer.layer.width = renderer.layer.height = 1; }
};
})();
