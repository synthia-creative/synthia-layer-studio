/* A separate preview-only canvas: never used by renderer/export buffers. */
(() => {
'use strict';
function boot() {
  const V = J.VideoAnalysis, state = J.videoAnalysisUI, el = J.studioElement, tr = J.layerText, $ = id => document.getElementById(id), view = $('view'); if (!state) return;
  const overlay = el('canvas', null, 'vaOverlay'); overlay.hidden = true; overlay.setAttribute('aria-label', tr('映像解析ガイド', 'Video analysis guides')); $('viewport').append(overlay);
  const controls = el('div'); controls.className = 'va-feature-grid'; const toggles = {};
  for (const [key, ja, en] of [['face', '顔の枠', 'Face boxes'], ['person', '人物マスク', 'Person mask'], ['motion', '動き・方向', 'Motion / direction'], ['heat', '動きヒートマップ', 'Motion heatmap'], ['light', '明暗グリッド', 'Luminance grid'], ['safe', 'Safe Zone候補', 'Safe Zone candidates'], ['manual', '手動保護領域', 'Manual regions']]) { const label = el('label', tr(ja, en)), input = el('input', null, 'vaOverlay-' + key); input.type = 'checkbox'; input.checked = key !== 'heat' && key !== 'light'; label.prepend(input); input.addEventListener('change', () => J.drawVideoAnalysisOverlay()); controls.append(label); toggles[key] = input; }
  $('studio-videoAnalysis').append(controls);
  let drag = null, drawingError = '';
  J.drawVideoAnalysisOverlay = () => {
    const source = state.source, controller = state.controller;
    const visible = controller.display && !!source && (!controller.result || state.valid) && J.layerSession.preview === 'composite';
    overlay.hidden = !visible; overlay.style.pointerEvents = visible && $('vaRegionEdit').value !== 'off' ? 'auto' : 'none';
    if (!visible) return;
    overlay.width = view.width; overlay.height = view.height; overlay.style.left = view.offsetLeft + 'px'; overlay.style.top = view.offsetTop + 'px'; overlay.style.width = view.clientWidth + 'px'; overlay.style.height = view.clientHeight + 'px';
    const ctx = overlay.getContext('2d'), fit = V.fit(source, overlay.width, overlay.height), w = overlay.width, h = overlay.height, time = J.ui.t, result = controller.result;
    const drawRect = (r, color, label, fill = false) => { const p = V.toProject(r, fit); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1, w / 640); if (fill) { ctx.globalAlpha = .12; ctx.fillRect(p.x * w, p.y * h, p.w * w, p.h * h); ctx.globalAlpha = 1; } ctx.strokeRect(p.x * w, p.y * h, p.w * w, p.h * h); if (label) { ctx.font = `${Math.max(11, w / 64)}px sans-serif`; ctx.fillText(label, p.x * w + 3, Math.max(13, p.y * h - 3)); } };
    try {
      const inRange = result && (source.kind === 'image' || time >= result.range.start && (time <= result.range.end || result.range.end >= source.duration - .01)), nearest = inRange ? result.samples.reduce((a, b) => Math.abs(a.t - time) <= Math.abs(b.t - time) ? a : b) : null;
      const scene = nearest && result.scenes.find(s => nearest.t >= s.start && nearest.t < s.end);
      const vision = nearest && result.samples.filter(s => s.visionSample && (!scene || s.t >= scene.start && s.t < scene.end)).reduce((a, b) => !a || Math.abs(b.t - time) < Math.abs(a.t - time) ? b : a, null);
      if (vision) {
        if (toggles.person.checked && vision.person) for (let i = 0; i < 144; i++) if (vision.person.grid[i] > .05) { const p = V.toProject({ x: i % 16 / 16, y: Math.floor(i / 16) / 9, w: 1 / 16, h: 1 / 9 }, fit); ctx.fillStyle = `rgba(168,95,214,${vision.person.grid[i] * .25})`; ctx.fillRect(p.x * w, p.y * h, p.w * w, p.h * h); }
        if (toggles.face.checked) for (const face of vision.faces) drawRect(V.expand(face, result.options.faceMargin), '#f07178', `${face.trackId} ${Math.round(face.score * 100)}%${face.estimated ? ' ?' : ''}`);
      }
      if (nearest) {
        if (toggles.heat.checked || toggles.light.checked) for (let i = 0; i < 48; i++) { const p = V.toProject({ x: i % 8 / 8, y: Math.floor(i / 8) / 6, w: 1 / 8, h: 1 / 6 }, fit), v = toggles.heat.checked ? nearest.motion?.regions[i] || 0 : nearest.brightness?.light[i] || 0; ctx.fillStyle = toggles.heat.checked ? `hsla(${220 * (1 - v)},85%,55%,.2)` : `rgba(255,255,255,${v * .3})`; ctx.fillRect(p.x * w, p.y * h, p.w * w, p.h * h); }
        if (toggles.motion.checked && nearest.motion) {
          const m = nearest.motion, x = w / 2, y = h / 2, norm = Math.max(.001, Math.hypot(m.dx, m.dy)), dx = m.dx / norm * w * .07, dy = m.dy / norm * h * .07;
          ctx.strokeStyle = '#61b4e5'; ctx.lineWidth = Math.max(2, w / 500); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
          if (m.strength > .001) { const a = Math.atan2(dy, dx); ctx.beginPath(); ctx.moveTo(x + dx - 10 * Math.cos(a - .5), y + dy - 10 * Math.sin(a - .5)); ctx.lineTo(x + dx, y + dy); ctx.lineTo(x + dx - 10 * Math.cos(a + .5), y + dy - 10 * Math.sin(a + .5)); ctx.stroke(); }
        }
      }
      if (toggles.safe.checked && state.candidatePlan === J.ui.plan && time >= state.line.start && time <= state.line.end) state.candidates.forEach((candidate, i) => drawRect(candidate.rect, candidate.safe ? '#79d9ae' : '#e4bb72', `${i + 1}: ${candidate.score}${i === state.selectedCandidate ? ' ★' : ''}`, i === state.selectedCandidate));
      if (toggles.manual.checked) for (const r of J.ui.project.videoAnalysis.regions) if (r.sourceHash === source.hash && time >= r.start && time <= r.end) { drawRect(r, r.id === $('vaRegion').value ? '#e4bb72' : '#dd96ed', tr('手動保護', 'Protected'), true); }
      if (drag?.rect) drawRect(drag.rect, '#e4bb72', '', true);
      if (drawingError) drawingError = '';
    } catch (e) { overlay.hidden = true; if (drawingError !== e.message) { drawingError = e.message; state.notice = tr('解析ガイドを描画できません: ', 'Analysis guides failed: ') + e.message; } }
  };
  const preview = J.drawLayerPreview;
  J.drawLayerPreview = (ctx, plan, t, options) => {
    V.previewing = ctx.canvas.id === 'view' && state.controller.display && state.valid && state.candidatePlan === plan && state.selectedCandidate >= 0;
    if (V.previewing) {
      const line = state.line, key = V.lineKey(line), candidate = state.candidates[state.selectedCandidate], r = V.toProject(candidate.rect, V.fit(state.source, plan.W, plan.H)), old = J.ui.project.videoAnalysis.placements[key] || { dx: 0, dy: 0 };
      V.previewPlacements = { [key]: { dx: old.dx + r.x + r.w / 2 - state.measured.rect.x - state.measured.rect.w / 2, dy: old.dy + r.y + r.h / 2 - state.measured.rect.y - state.measured.rect.h / 2, text: line.text } };
    }
    try { return preview(ctx, plan, t, options); } finally { V.previewing = false; V.previewPlacements = null; if (ctx.canvas.id === 'view') J.drawVideoAnalysisOverlay(); }
  };
  J.drawVideoAnalysisMarkers = (ctx, X, h, dpr) => {
    if (!state.controller.display || !state.valid || !state.controller.result) return;
    ctx.save(); ctx.strokeStyle = '#79d9ae'; ctx.lineWidth = dpr; for (const scene of state.controller.result.scenes.slice(1)) { const x = X(scene.start); if (x < 0 || x > ctx.canvas.width) continue; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } ctx.restore();
  };
  const point = e => { const bounds = overlay.getBoundingClientRect(), fit = V.fit(state.source, overlay.width, overlay.height); return { x: V.finite(((e.clientX - bounds.left) / bounds.width - fit.x) / fit.w, 0, 0, 1), y: V.finite(((e.clientY - bounds.top) / bounds.height - fit.y) / fit.h, 0, 0, 1) }; };
  overlay.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !state.source || J.ui.playing || J.ui.exporting || J.layerSession.busy || $('vaRegionEdit').value === 'off') return;
    const mode = $('vaRegionEdit').value, p = point(e), region = J.ui.project.videoAnalysis.regions.find(r => r.id === $('vaRegion').value && r.sourceHash === state.source.hash);
    if (mode !== 'draw' && !region) return;
    e.preventDefault(); overlay.setPointerCapture(e.pointerId); drag = { mode, start: p, original: region && { ...region }, rect: region && { ...region }, media: state.source.hash, project: J.ui.project };
  });
  overlay.addEventListener('pointermove', e => {
    if (!drag) return; const p = point(e), r = drag.original;
    if (drag.mode === 'draw') drag.rect = { x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
    else if (drag.mode === 'move') drag.rect = { ...r, x: Math.max(0, Math.min(1 - r.w, r.x + p.x - drag.start.x)), y: Math.max(0, Math.min(1 - r.h, r.y + p.y - drag.start.y)) };
    else drag.rect = { ...r, w: Math.max(.01, p.x - r.x), h: Math.max(.01, p.y - r.y) };
    J.drawVideoAnalysisOverlay();
  });
  overlay.addEventListener('pointerup', () => {
    if (!drag) return; const d = drag; drag = null;
    if (!d.rect || d.project !== J.ui.project || state.source?.hash !== d.media || d.rect.w < .01 || d.rect.h < .01) return;
    if (d.mode === 'draw') { const start = +$('vaRegion-start').value, end = +$('vaRegion-end').value; if (!(end > start)) return; state.commitRegions([...J.ui.project.videoAnalysis.regions, { ...d.rect, id: 'manual-' + crypto.randomUUID(), start, end, sourceHash: d.media }]); }
    else state.commitRegions(J.ui.project.videoAnalysis.regions.map(r => r.id === d.original.id ? { ...r, ...d.rect } : r));
  });
  for (const event of ['pointercancel', 'lostpointercapture']) overlay.addEventListener(event, () => { drag = null; J.drawVideoAnalysisOverlay(); });
  new ResizeObserver(() => J.drawVideoAnalysisOverlay()).observe(view);
  J.drawVideoAnalysisOverlay();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
