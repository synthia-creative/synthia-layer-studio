/* Independent video-analysis controls, using the existing editor save/undo APIs. */
(() => {
'use strict';
function boot() {
  const V = J.VideoAnalysis, el = J.studioElement, tr = J.layerText, $ = id => document.getElementById(id);
  const root = J.studioSection('videoAnalysis', '映像自動解析', 'Video analysis');
  const state = J.videoAnalysisUI = { source: null, valid: false, candidates: [], selectedCandidate: -1, measured: null, candidatePlan: null, checking: false, mediaId: 0, notice: '', batch: [], batchPlan: null }; let batchResults;
  const data = () => J.ui.project.videoAnalysis || (J.ui.project.videoAnalysis = J.normalizeVideoAnalysis());
  const locked = line => !!(J.ui.project.subtitleCues?.[line.index]?.locked || J.ui.project.locks?.params?.[V.lineKey(line)] || J.ui.project.overrides?.[line.index]?.lock);
  const dirty = () => { J.ui.need = true; J.drawVideoAnalysisOverlay?.(); };
  const status = el('p', null, 'vaStatus'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const overview = el('p', null, 'vaOverview'), progress = el('progress', null, 'vaProgress'); progress.max = 1;
  const switchRow = el('div'); switchRow.className = 'va-switches';
  function checkbox(id, ja, en, checked, change) { const label = el('label', tr(ja, en)), input = el('input', null, id); input.type = 'checkbox'; input.checked = checked; input.setAttribute('aria-label', tr(ja, en)); input.addEventListener('change', () => change(input.checked)); label.prepend(input); return { label, input }; }
  const enabled = checkbox('vaEnabled', '映像自動解析 ON / OFF', 'Enable video analysis', false, on => controller.setEnabled(on));
  const display = checkbox('vaDisplay', '解析結果の表示 ON / OFF', 'Show analysis results', false, on => controller.setDisplay(on));
  switchRow.append(enabled.label, display.label);
  const states = { idle: ['待機中', 'Idle'], running: ['解析中', 'Analyzing'], complete: ['解析完了', 'Complete'], cancelled: ['中止', 'Cancelled'], failed: ['失敗', 'Failed'], saved: ['保存済み結果', 'Saved results'] };
  const controller = state.controller = new V.Controller(V.run, () => sync(), result => { data().result = result; state.valid = V.sameSource(result.source, state.source); state.notice = ''; clearCandidates(); J.uiApi.flushSave(); });
  function clearCandidates() { state.candidates = []; state.selectedCandidate = -1; state.measured = null; state.candidatePlan = null; state.batch = []; state.batchPlan = null; batchResults?.replaceChildren(); state.measureAbort?.abort(); candidates.replaceChildren(); dirty(); }
  function act(id, ja, en, fn) {
    const b = el('button', tr(ja, en), id); b.type = 'button';
    b.addEventListener('click', async () => { try { await fn(); } catch (e) { if (e.name !== 'AbortError') state.notice = e.message; } finally { sync(); } }); return b;
  }
  const quality = el('select', null, 'vaQuality');
  for (const [value, ja, en] of [['fast', '高速', 'Fast'], ['standard', '標準', 'Standard'], ['high', '高精度', 'Detailed']]) { const o = el('option', tr(ja, en)); o.value = value; quality.append(o); }
  const settings = el('div'); settings.className = 'va-settings';
  const qualityLabel = el('label', tr('解析品質 ', 'Quality ')); qualityLabel.append(quality); settings.append(qualityLabel);
  function number(id, ja, en, min, max, step, initial, parent = settings) { const label = el('label', tr(ja, en)), input = el('input', null, id); input.type = 'number'; input.min = min; input.max = max; input.step = step; input.value = String(initial); input.setAttribute('aria-label', tr(ja, en)); label.append(input); parent.append(label); return input; }
  const start = number('vaStart', '開始秒', 'Start seconds', 0, 86400, .01, 0), end = number('vaEnd', '終了秒（0は素材末尾）', 'End seconds (0 = media end)', 0, 86400, .01, 0), cap = number('vaFrameCap', '最大解析フレーム数', 'Frame limit', 2, 1200, 1, 600), margin = number('vaFaceMargin', '顔の保護余白（%）', 'Face margin (%)', 0, 80, 1, 15);
  const features = el('div'); features.className = 'va-feature-grid'; const featureInputs = {};
  for (const [key, ja, en] of [['motion', '動き・移動方向', 'Motion / direction'], ['scene', 'シーンチェンジ', 'Scene changes'], ['brightness', '明暗・コントラスト', 'Brightness / contrast'], ['face', '顔検出', 'Faces'], ['person', '人物領域', 'People'], ['safe', 'Safe Zone', 'Safe Zone']]) { const c = checkbox('vaFeature-' + key, ja, en, true, saveOptions); featureInputs[key] = c.input; features.append(c.label); }
  function saveOptions() {
    if (controller.state === 'running') return;
    data().options = V.options({ quality: quality.value, start: start.valueAsNumber, end: end.valueAsNumber, maxFrames: cap.valueAsNumber, faceMargin: margin.valueAsNumber / 100, features: Object.fromEntries(Object.entries(featureInputs).map(([k, v]) => [k, v.checked])) });
    J.uiApi.flushSave(); clearCandidates(); sync();
  }
  for (const input of [quality, start, end, cap, margin]) input.addEventListener('change', saveOptions);
  const qualityInfo = el('p', tr('高速: 基礎160px／人物320px・約1枚/秒、人物は3枚ごと。標準: 240px／512px・約2枚/秒、人物は2枚ごと。高精度: 320px／640px・約4枚/秒、人物は毎回・カット周辺を追加解析。標準以上は小さい顔を領域分割でも検出。上限を超えると間隔を広げます。高品質ほど処理・保存量が増えます。速度・検出精度の保証はありません。', 'Fast: metrics 160px / vision 320px, about 1 fps, vision every third sample. Standard: 240px / 512px, about 2 fps, vision every second sample. Detailed: 320px / 640px, about 4 fps, vision every sample and refined cut boundaries. Standard/Detailed also scan overlapping tiles for small faces. The frame cap increases spacing. Higher detail needs more time and storage; no speed or accuracy guarantee.'));
  const startButton = act('vaAnalyze', '解析開始', 'Start analysis', async () => { if (!controller.enabled || J.layerSession.busy || J.ui.exporting || state.checking) return; saveOptions(); clearCandidates(); state.notice = ''; await controller.start(J.layerSession.background, data().options); });
  const cancelButton = act('vaCancel', '解析キャンセル', 'Cancel analysis', () => controller.cancel());
  const actions = el('div'); actions.className = 'va-actions'; actions.append(startButton, cancelButton);
  const saveButton = act('vaSave', '解析結果を保存', 'Save analysis JSON', () => {
    if (!controller.result) throw new Error(tr('保存する解析結果がありません。', 'No analysis results to save.'));
    const result = { ...controller.result, manualRegions: data().regions.filter(r => r.sourceHash === controller.result.source.hash) };
    const blob = new Blob([JSON.stringify(result)], { type: 'application/json' }); if (blob.size > V.maxBytes) throw new Error('Analysis data exceeds 16 MiB');
    const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = controller.result.source.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') + '.analysis.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); state.notice = tr('解析JSONを保存しました。', 'Analysis JSON saved.');
  });
  const fileLabel = el('label', tr('解析結果を読み込む ', 'Load analysis JSON ')), file = el('input', null, 'vaLoad'); file.type = 'file'; file.accept = '.json,application/json'; fileLabel.append(file);
  file.addEventListener('change', async () => {
    const f = file.files[0], project = J.ui.project; if (!f) return;
    try { if (f.size > V.maxBytes) throw new Error('Analysis JSON exceeds 16 MiB'); const parsed = JSON.parse(await f.text()), result = V.validateResult(parsed); if (project !== J.ui.project) return;
      controller.cancel(); data().result = result;
      // Import never overwrites existing manual edits or applied lyric positions.
      const ids = new Set(data().regions.map(r => r.id)); data().regions.push(...V.regions(parsed.manualRegions).filter(r => r.sourceHash === result.source.hash && !ids.has(r.id))); data().regions = V.regions(data().regions);
      controller.load(result); state.valid = V.sameSource(result.source, state.source); clearCandidates(); J.uiApi.flushSave(); state.notice = tr('保存済み結果を読み込みました。両スイッチはOFFです。', 'Results loaded. Both switches are OFF.');
    } catch (e) { state.notice = tr('解析JSONを読み込めません: ', 'Cannot load analysis JSON: ') + e.message; } finally { file.value = ''; sync(); }
  });
  const deleteButton = act('vaDelete', '解析結果の削除', 'Delete analysis results', () => { if (!controller.result) return; if (!confirm(tr('解析結果だけを削除します。手動保護領域と適用済み字幕位置は保持します。', 'Delete analysis results? Manual regions and applied lyric positions are retained.'))) return; controller.cancel(); data().result = null; controller.result = null; controller.state = 'idle'; state.valid = false; clearCandidates(); J.uiApi.flushSave(); });
  const storage = el('div'); storage.className = 'va-actions'; storage.append(saveButton, fileLabel, deleteButton);
  const privacy = el('p', tr('素材はブラウザ内で処理します。解析モデルは同梱済み・初期状態では読み込みません。解析枠は完成動画へ入りません。', 'Media stays in your browser. Bundled models load only on explicit analysis. Guides are excluded from exports.'));
  const guide = el('a', tr('起動方法・操作ガイド・既知の制限', 'Startup, guide and known limitations')); guide.href = document.documentElement.lang === 'en' ? '../docs/VIDEO_ANALYSIS.en.html' : 'docs/VIDEO_ANALYSIS.html'; guide.target = '_blank'; guide.rel = 'noopener';
  root.append(switchRow, status, progress, overview, settings, features, qualityInfo, actions, storage, privacy, guide);

  const safe = el('details', null, 'vaSafePanel'); safe.append(el('summary', tr('Safe Zone候補と字幕位置', 'Safe Zone / lyric placement')));
  const lineSelect = el('select', null, 'vaLine'); lineSelect.setAttribute('aria-label', tr('対象字幕', 'Target subtitle'));
  const candidateInfo = el('p', tr('字幕区間の描画範囲を測定して、最大3候補を表示します。', 'Measure animated lyric bounds across the interval and show up to three candidates.'), 'vaCandidateStatus');
  const candidates = el('div', null, 'vaCandidates');
  const compute = act('vaComputeSafe', '配置候補を計算', 'Evaluate placement candidates', async () => {
    if (!state.valid || !controller.result) throw new Error(tr('素材と一致する解析結果が必要です。', 'Matching analysis results are required.'));
    const line = J.ui.plan.lines.find(l => String(l.index) === lineSelect.value); if (!line || !(line.end > line.start)) throw new Error(tr('字幕を選択してください。', 'Select a subtitle.'));
    clearCandidates(); const plan = J.ui.plan, project = J.ui.project, ac = state.measureAbort = new AbortController();
    const measurement = await V.measureLine(plan, line, ac.signal, p => { candidateInfo.textContent = tr('字幕の描画範囲を測定中 ', 'Measuring lyric bounds ') + Math.round(p * 100) + '%'; });
    if (plan !== J.ui.plan || project !== J.ui.project || ac.signal.aborted || !state.valid) return;
    const fit = V.fit(controller.result.source, plan.W, plan.H), envelope = V.toVideo(measurement.rect, fit);
    const evaluated = await V.evaluateSafeAsync(controller.result, data().regions, line, envelope, measurement.luminance, measurement.others.map(r => V.toVideo(r, fit)), ac.signal, videoGeometry(measurement, fit));
    if (plan !== J.ui.plan || project !== J.ui.project || ac.signal.aborted || !state.valid) return;
    state.candidates = evaluated; state.measured = measurement; state.line = { ...line }; state.candidatePlan = plan; state.selectedCandidate = -1;
    controller.result.safeZones ||= {}; controller.result.safeZones[V.lineKey(line)] = { text: line.text, start: line.start, end: line.end, candidates: state.candidates };
    J.uiApi.flushSave(); renderCandidates(); dirty();
  });
  function videoGeometry(measurement, fit) { return measurement.geometry.map(f => ({ t: f.t, rect: V.toVideo(f.rect, fit), others: f.others.map(r => V.toVideo(r, fit)) })); }
  const reasonLabels = {
    coverage: ['字幕の区間を解析し、解析間隔を1秒以内にしてください（範囲・フレーム上限を確認）。', 'Analyze the subtitle interval with spacing of at most one second; check range and frame limit.'],
    'face-unavailable': ['顔検出が未利用です。顔検出をONにして再解析し、読込エラーがあればHTTPで起動してください。', 'Face detection unavailable. Enable it and reanalyze; use HTTP if model loading failed.'],
    'person-unavailable': ['人物領域が未利用です。人物領域をONにして再解析してください。', 'Person detection unavailable. Enable it and reanalyze.'],
    'brightness-unavailable': ['明暗の解析が未利用です。明暗・コントラストをONにして再解析してください。', 'Brightness analysis unavailable. Enable it and reanalyze.'],
    'face-overlap': ['字幕の動きが顔の保護範囲に重なります。文字サイズ・モーション・位置を調整してください。', 'Animated text overlaps protected faces. Adjust size, motion or position.'],
    'person-overlap': ['字幕が人物領域に重なります。文字サイズ・モーション・位置を調整してください。', 'Text overlaps people. Adjust size, motion or position.'],
    'protected-overlap': ['手動保護領域に重なります。字幕サイズ・位置・保護領域の時間を確認してください。', 'Text overlaps a manual protected region. Check size, position and region timing.'],
    'subtitle-overlap': ['同時に表示される別の字幕に重なります。字幕の位置・タイミングを確認してください。', 'Text overlaps another visible subtitle. Check position and timing.'],
    contrast: ['現在の文字色と背景のコントラストが低い評価です。推奨色や縁取りを確認してください。', 'Current text has low estimated contrast. Check the suggested color or outline.']
  };
  function renderCandidates() {
    candidates.replaceChildren(); const safeFound = state.candidates.some(c => c.safe);
    candidateInfo.textContent = safeFound ? tr('低リスクの配置候補があります。文字の動きと人物をプレビューで確認してください。', 'Low-risk candidates found. Check animation and people in the preview.') : state.candidates.length ? tr('要確認の配置候補です。各候補に表示した理由を確認してください。', 'Candidates need review. Check the specific reasons below.') : state.measured && (state.measured.rect.w > .94 || state.measured.rect.h > .94) ? tr('字幕が大きく、背景内に収まる候補を作れません。文字サイズを小さくして再計算してください。', 'The subtitle is too large to fit. Reduce text size and recompute.') : tr('字幕の表示区間に解析結果がありません。開始・終了秒を確認して再解析してください。', 'No analysis for this subtitle interval. Check the range and reanalyze.');
    state.candidates.forEach((c, i) => {
      const entry = el('div'); entry.className = 'va-candidate';
      entry.append(el('strong', `${i + 1}. ${tr(...positionLabel(c.position))} · ${c.score}/100`), el('p', tr('顔との重複 ', 'Face overlap ') + Math.round(c.faceRisk * 100) + '% · ' + tr('人物との重複 ', 'Person overlap ') + Math.round(c.personRisk * 100) + '% · ' + tr('視認性 ', 'Readability ') + Math.round(c.readable * 100) + '% · ' + tr('解析信頼度 ', 'Analysis confidence ') + Math.round(c.confidence * 100) + '%'), el('p', (c.safe ? tr('低い人物衝突リスク、表示区間のカバーあり。', 'Low detected collision risk; interval covered.') : tr('要確認。以下の理由に応じて調整してください。', 'Needs review. Adjust according to the reasons below.')) + tr(' 推奨色: ', ' Suggested color: ') + c.recommendedColor), act('vaCandidate-' + i, '候補をプレビュー', 'Preview candidate', () => { state.selectedCandidate = i; controller.setDisplay(true); J.uiApi.seek((state.line.start + state.line.end) / 2); dirty(); })); candidates.append(entry);
      if (!c.safe) for (const reason of c.reasons || []) if (reasonLabels[reason]) entry.append(el('p', tr(...reasonLabels[reason])));
    });
  }
  function positionLabel(value) { const [x, y] = value.split('-'); return [{ left: '左', center: '中央', right: '右' }[x] + { top: '上', middle: '中央', bottom: '下' }[y], value]; }
  const apply = act('vaApplyPosition', '選択字幕にこの位置を適用', 'Apply position to selected subtitle', () => {
    if (J.layerSession.busy || J.ui.exporting) return;
    const c = state.candidates[state.selectedCandidate], line = state.line;
    if (!c || state.candidatePlan !== J.ui.plan || !state.valid) throw new Error(tr('候補を再計算してプレビューしてください。', 'Recompute and preview a candidate.'));
    if (!c.safe && !confirm(tr('この候補は暫定評価です。プレビューを確認した位置を適用しますか？', 'This candidate is provisional. Apply the position you checked in the preview?'))) return;
    const key = V.lineKey(line);
    if (locked(line)) throw new Error(tr('ロック中の字幕です。', 'This subtitle is locked.'));
    const r = V.toProject(c.rect, V.fit(controller.result.source, J.ui.plan.W, J.ui.plan.H)), old = data().placements[key] || { dx: 0, dy: 0 };
    J.uiApi.pushEdit(); data().placements[key] = { dx: old.dx + r.x + r.w / 2 - state.measured.rect.x - state.measured.rect.w / 2, dy: old.dy + r.y + r.h / 2 - state.measured.rect.y - state.measured.rect.h / 2, text: line.text };
    J.uiApi.replan(); J.uiApi.flushSave(); clearCandidates(); state.notice = tr('字幕位置を適用しました。Ctrl+Zで取り消せます。', 'Position applied. Use Ctrl+Z to undo.');
  });
  const resetPosition = act('vaResetPosition', '選択字幕の位置上書きを解除', 'Remove selected position override', () => { const line = J.ui.plan.lines.find(l => String(l.index) === lineSelect.value); if (!line || J.layerSession.busy || J.ui.exporting) return; if (locked(line)) throw new Error(tr('ロック中の字幕です。', 'This subtitle is locked.')); J.uiApi.pushEdit(); delete data().placements[V.lineKey(line)]; J.uiApi.replan(); J.uiApi.flushSave(); clearCandidates(); });
  const manualXY = el('div'); manualXY.className = 'va-settings';
  const mx = number('vaManualX', '手動位置X（%）', 'Manual X (%)', 0, 100, .1, 50, manualXY), my = number('vaManualY', '手動位置Y（%）', 'Manual Y (%)', 0, 100, .1, 50, manualXY);
  const manualPosition = act('vaManualPosition', '手動位置を選択字幕に適用', 'Apply manual lyric position', async () => {
    if (J.layerSession.busy || J.ui.exporting) return;
    const line = J.ui.plan.lines.find(l => String(l.index) === lineSelect.value), plan = J.ui.plan; if (!line) throw new Error('Select a subtitle');
    if (locked(line)) throw new Error(tr('ロック中の字幕です。', 'This subtitle is locked.'));
    if (![mx.valueAsNumber, my.valueAsNumber].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) throw new Error('Invalid position');
    const m = await V.measureLine(plan, line, new AbortController().signal); if (plan !== J.ui.plan) return;
    const key = V.lineKey(line), p = data().placements[key] || { dx: 0, dy: 0 }; J.uiApi.pushEdit(); data().placements[key] = { dx: p.dx + mx.valueAsNumber / 100 - m.rect.x - m.rect.w / 2, dy: p.dy + my.valueAsNumber / 100 - m.rect.y - m.rect.h / 2, text: line.text }; J.uiApi.replan(); J.uiApi.flushSave(); clearCandidates();
  });
  safe.append(lineSelect, compute, candidateInfo, candidates, apply, resetPosition, manualXY, manualPosition, el('p', tr('解析OFFでも適用済み位置は保持します。推奨色は自動適用しません。モーション全体の領域は有限サンプリングによる推定です。', 'Applied positions persist with analysis OFF. Suggested colors are never applied automatically. Animation bounds use finite sampling.'))); root.append(safe);
  const batchPanel = el('details', null, 'vaBatchPanel'); batchPanel.append(el('summary', tr('複数字幕への配置候補', 'Placement for multiple subtitles')));
  const batchLines = el('select', null, 'vaBatchLines'); batchLines.multiple = true; batchLines.size = 5; batchLines.setAttribute('aria-label', tr('適用対象の複数字幕', 'Select multiple target subtitles')); batchResults = el('div', null, 'vaBatchResults');
  const batchCompute = act('vaBatchCompute', '選択した字幕の候補を計算', 'Evaluate selected subtitles', async () => {
    if (!state.valid || !controller.result) throw new Error(tr('素材と一致する解析結果が必要です。', 'Matching results are required.'));
    const selected = [...batchLines.selectedOptions].map(o => +o.value), plan = J.ui.plan, project = J.ui.project;
    if (!selected.length) throw new Error(tr('字幕を選択してください。', 'Select subtitles.'));
    clearCandidates(); const ac = state.measureAbort = new AbortController(), fit = V.fit(controller.result.source, plan.W, plan.H), pending = [];
    for (const index of selected) {
      const line = plan.lines.find(l => l.index === index); if (!line) continue;
      if (locked(line)) throw new Error(tr('ロック中の字幕があります。', 'A selected subtitle is locked.'));
      const measurement = await V.measureLine(plan, line, ac.signal), evaluated = await V.evaluateSafeAsync(controller.result, data().regions, line, V.toVideo(measurement.rect, fit), measurement.luminance, measurement.others.map(r => V.toVideo(r, fit)), ac.signal, videoGeometry(measurement, fit));
      if (!evaluated.length) throw new Error(tr('候補のない字幕があります: ', 'No candidate for subtitle: ') + (index + 1));
      pending.push({ line: { ...line }, measurement, candidates: evaluated, previewed: false });
      if (plan !== J.ui.plan || project !== J.ui.project || ac.signal.aborted || !state.valid) return;
    }
    state.batch = pending; state.batchPlan = plan;
    controller.result.safeZones ||= {}; for (const entry of pending) controller.result.safeZones[V.lineKey(entry.line)] = { text: entry.line.text, start: entry.line.start, end: entry.line.end, candidates: entry.candidates }; J.uiApi.flushSave();
    pending.forEach((entry, i) => batchResults.append(act('vaBatchPreview-' + i, `${entry.line.index + 1}行目をプレビュー（${entry.candidates[0].score}点）`, `Preview subtitle ${entry.line.index + 1} (${entry.candidates[0].score})`, () => { entry.previewed = true; state.candidates = entry.candidates; state.selectedCandidate = 0; state.measured = entry.measurement; state.line = entry.line; state.candidatePlan = plan; controller.setDisplay(true); J.uiApi.seek((entry.line.start + entry.line.end) / 2); renderCandidates(); dirty(); })));
    state.notice = tr('各行をプレビューしてから適用してください。', 'Preview every selected subtitle before applying.');
  });
  const batchApply = act('vaBatchApply', '確認した複数字幕に適用', 'Apply to previewed subtitles', () => {
    if (J.ui.exporting || J.layerSession.busy) return;
    if (!state.batch.length || state.batchPlan !== J.ui.plan || !state.valid || state.batch.some(e => !e.previewed)) throw new Error(tr('全対象をプレビューし、変更時は候補を再計算してください。', 'Preview every target and recompute after edits.'));
    if (state.batch.some(e => locked(e.line))) throw new Error(tr('ロック中の字幕があります。', 'A selected subtitle is locked.'));
    if (!confirm(tr('確認した ', 'Apply the previewed positions to ') + state.batch.length + tr(' 件の字幕位置を適用します。Ctrl+Zで取り消せます。', ' subtitles? Ctrl+Z can undo this.'))) return;
    J.uiApi.pushEdit(); const fit = V.fit(controller.result.source, J.ui.plan.W, J.ui.plan.H);
    for (const entry of state.batch) { const key = V.lineKey(entry.line), r = V.toProject(entry.candidates[0].rect, fit), old = data().placements[key] || { dx: 0, dy: 0 }, m = entry.measurement.rect; data().placements[key] = { dx: old.dx + r.x + r.w / 2 - m.x - m.w / 2, dy: old.dy + r.y + r.h / 2 - m.y - m.h / 2, text: entry.line.text }; }
    J.uiApi.replan(); J.uiApi.flushSave(); clearCandidates();
  });
  batchPanel.append(batchLines, act('vaSelectAll', '全字幕を選択', 'Select all subtitles', () => { for (const option of batchLines.options) option.selected = true; }), batchCompute, batchResults, batchApply); root.append(batchPanel);

  const protection = el('details', null, 'vaProtection'); protection.append(el('summary', tr('手動保護領域', 'Manual protected regions')));
  const regionList = el('select', null, 'vaRegion'); regionList.setAttribute('aria-label', tr('保護領域を選択', 'Select protected region')); protection.append(regionList);
  const regionFields = {}, regionGrid = el('div'); regionGrid.className = 'va-settings';
  for (const [key, label, initial] of [['x', 'X (%)', 10], ['y', 'Y (%)', 10], ['w', 'Width (%)', 30], ['h', 'Height (%)', 40], ['start', 'Start (s)', 0], ['end', 'End (s)', 86400]]) regionFields[key] = number('vaRegion-' + key, label, label, 0, ['start', 'end'].includes(key) ? 86400 : 100, .1, initial, regionGrid);
  protection.append(regionGrid);
  state.commitRegions = regions => { J.uiApi.pushEdit(); data().regions = V.regions(regions); clearCandidates(); J.uiApi.flushSave(); syncRegions(); dirty(); };
  const regionFromFields = id => { const values = Object.fromEntries(Object.entries(regionFields).map(([k, input]) => [k, input.valueAsNumber])); if (!Object.values(values).every(Number.isFinite) || values.end <= values.start || values.w <= 0 || values.h <= 0 || values.x + values.w > 100 || values.y + values.h > 100) throw new Error(tr('保護領域の座標と時間を確認してください。', 'Check region coordinates and times.')); return { ...values, x: values.x / 100, y: values.y / 100, w: values.w / 100, h: values.h / 100, id, sourceHash: state.source.hash }; };
  protection.append(act('vaAddRegion', '保護領域を追加', 'Add protected region', () => { if (!state.source) throw new Error(tr('背景素材を選択してください。', 'Select background media.')); state.commitRegions([...data().regions, regionFromFields('manual-' + crypto.randomUUID())]); }), act('vaUpdateRegion', '選択領域を更新', 'Update selected region', () => { const region = data().regions.find(r => r.id === regionList.value); if (!region || !state.source || region.sourceHash !== state.source.hash) throw new Error('Select a region for this media'); state.commitRegions(data().regions.map(r => r.id === region.id ? regionFromFields(region.id) : r)); }), act('vaRemoveRegion', '選択領域を削除', 'Delete selected region', () => state.commitRegions(data().regions.filter(r => r.id !== regionList.value))));
  const edit = el('select', null, 'vaRegionEdit'); for (const [value, ja, en] of [['off', 'プレビュー操作: 通常', 'Preview: normal'], ['draw', 'ドラッグで新規領域', 'Drag to add region'], ['move', '選択領域を移動', 'Move selected region'], ['resize', '選択領域の右下を変更', 'Resize selected region']]) { const o = el('option', tr(ja, en)); o.value = value; edit.append(o); }
  edit.addEventListener('change', () => { if (edit.value !== 'off') controller.setDisplay(true); dirty(); }); protection.append(edit, el('p', tr('座標は素材内の割合です。人物が移動する場合は複数の時間区間を追加してください。再解析で手動領域を消しません。', 'Coordinates are percentages of the source media. For moving people, add multiple timed regions. Reanalysis retains manual regions.'))); root.append(protection);
  regionList.addEventListener('change', () => { const r = data().regions.find(r => r.id === regionList.value); if (!r) return; for (const [k, input] of Object.entries(regionFields)) input.value = String(r[k] * (['start', 'end'].includes(k) ? 1 : 100)); dirty(); });
  function syncRegions() { const old = regionList.value; regionList.replaceChildren(); for (const [i, r] of data().regions.entries()) if (r.sourceHash === state.source?.hash) { const o = el('option', `${i + 1}: ${r.start.toFixed(2)}–${r.end.toFixed(2)}s`); o.value = r.id; regionList.append(o); } if ([...regionList.options].some(o => o.value === old)) regionList.value = old; }
  function syncOptions() { const o = data().options; quality.value = o.quality; start.value = o.start; end.value = o.end; cap.value = o.maxFrames; margin.value = o.faceMargin * 100; for (const k in featureInputs) featureInputs[k].checked = o.features[k]; }
  function sync() {
    enabled.input.checked = controller.enabled; display.input.checked = controller.display; progress.value = controller.progress;
    const pair = states[controller.state] || states.idle;
    status.textContent = tr(...pair) + (controller.state === 'running' ? ` · ${Math.round(controller.progress * 100)}%` : '') + (state.checking ? tr(' · 素材照合中', ' · checking source') : '') + (controller.result && !state.valid ? tr(' · 結果不一致／素材未確認', ' · result mismatch / unverified source') : '') + (controller.error ? ' · ' + controller.error : '') + (state.notice ? ' · ' + state.notice : '');
    startButton.disabled = !controller.enabled || controller.state === 'running' || !J.layerSession.background || state.checking || J.layerSession.busy || J.ui.exporting;
    cancelButton.disabled = controller.state !== 'running'; saveButton.disabled = !controller.result; compute.disabled = !state.valid || !J.ui.plan.lines.length || !controller.result?.options.features.safe;
    apply.disabled = state.selectedCandidate < 0 || state.candidatePlan !== J.ui.plan;
    batchCompute.disabled = !state.valid || !controller.result?.options.features.safe; batchApply.disabled = !state.batch.length || state.batchPlan !== J.ui.plan || state.batch.some(e => !e.previewed);
    for (const input of [quality, start, end, cap, margin, ...Object.values(featureInputs)]) input.disabled = controller.state === 'running';
    const r = controller.result;
    overview.textContent = r ? `${r.source.name} · ${r.samples.length} ${tr('解析フレーム', 'samples')} · ${r.scenes.length} ${tr('シーン候補', 'scene candidates')} · ${Math.round(r.elapsedMs)}ms · ${tr('顔の最大検出数', 'Maximum detected faces')}: ${Math.max(0, ...r.samples.map(s => (s.faces || []).filter(f => !f.estimated).length))} · ${tr('人物モデル', 'Person model')}: ${r.models.person ? tr('利用済み', 'used') : tr('未使用', 'unavailable')}\n${tr('未検出は人物がいない証明ではありません。候補は必ず目視で確認してください。', 'No detection does not prove nobody is present. Always inspect candidates visually.')}\n${r.warnings.join('\n')}` : (data().loadWarning || tr('解析データはありません。', 'No analysis data.'));
    if (state.candidatePlan && state.candidatePlan !== J.ui.plan) { state.candidates = []; state.selectedCandidate = -1; state.candidatePlan = null; candidates.replaceChildren(); }
    const old = lineSelect.value, signature = J.ui.plan.lines.map(l => `${l.index}:${l.text}`).join('|');
    if (signature !== lineSelect.dataset.signature) { lineSelect.dataset.signature = signature; lineSelect.replaceChildren(); batchLines.replaceChildren(); for (const l of J.ui.plan.lines.filter(l => l.text && !l.interlude)) { const o = el('option', `${l.index + 1}: ${l.text.slice(0, 40)}`); o.value = l.index; lineSelect.append(o); batchLines.append(o.cloneNode(true)); } if ([...lineSelect.options].some(o => o.value === old)) lineSelect.value = old; }
    syncRegions(); dirty();
  }
  lineSelect.addEventListener('change', () => { clearCandidates(); const l = J.ui.plan.lines.find(l => String(l.index) === lineSelect.value); if (l) J.uiApi.seek((l.start + l.end) / 2); });
  J.videoAnalysisMediaChanged = async loading => {
    const id = ++state.mediaId; state.sourceAbort?.abort(); state.sourceAbort = new AbortController(); controller.cancel(); state.valid = false; state.source = null; clearCandidates(); state.checking = !!J.layerSession.background && !loading; sync();
    if (loading || !J.layerSession.background) return;
    const media = J.layerSession.background, project = J.ui.project;
    try { const source = await V.sourceInfo(media, state.sourceAbort.signal); if (id !== state.mediaId || project !== J.ui.project || media !== J.layerSession.background) return; state.source = source; state.valid = V.sameSource(source, controller.result?.source); }
    catch (e) { if (e.name !== 'AbortError' && id === state.mediaId) state.notice = e.message; }
    finally { if (id === state.mediaId) { state.checking = false; sync(); } }
  };
  J.videoAnalysisProjectLoaded = () => { controller.load(data().result); state.notice = data().loadWarning; syncOptions(); J.videoAnalysisMediaChanged(); };
  J.videoAnalysisBeforeExport = () => { if (controller.state === 'running') { controller.cancel(); state.notice = tr('書き出しを優先して解析を中止しました。保存済み結果は保持しています。', 'Analysis cancelled to prioritize export. Saved results are retained.'); } state.measureAbort?.abort(); };
  const syncLayer = J.syncLayerUI; J.syncLayerUI = () => { syncLayer(); sync(); };
  controller.load(data().result); syncOptions(); J.videoAnalysisMediaChanged();
  state.sync = sync; state.clearCandidates = clearCandidates;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
