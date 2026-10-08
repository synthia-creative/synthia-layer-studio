/* Models and all per-frame CPU work run in an on-demand classic Worker. */
(() => {
'use strict';
const V = J.VideoAnalysis;
V.workerMain = function workerMain(metrics) {
  let options, metricWidth = 240, previous = null, previousT = 0, canvas, context, small, smallContext, face, person, labels = [], personMaskIndex = 1, faceTrack = [], nextTrack = 0;
  self.onmessage = async e => {
    const { id, kind, payload } = e.data;
    try {
      if (kind === 'init') {
        options = payload.options; metricWidth = payload.metricWidth || 240; const warnings = [];
        if (options.features.face || options.features.person) {
          try {
            const vision = await import(payload.base + 'vision_bundle.mjs');
            const files = await vision.FilesetResolver.forVisionTasks(payload.base + 'wasm');
            if (options.features.face) try { face = await vision.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: payload.base + 'blaze_face_short_range-v1.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: .45 }); } catch (e) { warnings.push('FACE_MODEL: ' + e.message); }
            if (options.features.person) try {
              person = await vision.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: payload.base + 'selfie_segmenter-v1.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true });
              labels = person.getLabels();
              // Never assume an arbitrary segmenter's foreground represents people.
              if (labels.length === 1 && labels[0] === 'selfie') personMaskIndex = 0; // Fixed v1 model: one sigmoid foreground confidence channel.
              else if (labels.length === 2 && /person/i.test(labels[1] || '') && /background/i.test(labels[0] || '')) personMaskIndex = 1;
              else { person.close(); person = null; throw new Error('Labels do not match the fixed person model: ' + JSON.stringify(labels)); }
            } catch (e) { warnings.push('PERSON_MODEL: ' + e.message); }
          } catch (e) { warnings.push('VISION_RUNTIME: ' + e.message); }
        }
        self.postMessage({ id, payload: { warnings, face: !!face, person: !!person, labels } }); return;
      }
      if (kind === 'frame') {
        const { width: w, height: h, buffer, t, visionFrame } = payload, pixels = new Uint8ClampedArray(buffer);
        if (!canvas || canvas.width !== w || canvas.height !== h) { canvas = new OffscreenCanvas(w, h); context = canvas.getContext('2d'); }
        context.putImageData(new ImageData(pixels, w, h), 0, 0);
        const ratio = Math.min(1, metricWidth / Math.max(w, h)), mw = Math.max(8, Math.round(w * ratio)), mh = Math.max(8, Math.round(h * ratio));
        if (!small || small.width !== mw || small.height !== mh) { small = new OffscreenCanvas(mw, mh); smallContext = small.getContext('2d', { willReadFrequently: true }); }
        smallContext.drawImage(canvas, 0, 0, mw, mh);
        const out = metrics(smallContext.getImageData(0, 0, mw, mh).data, mw, mh, previous, t - previousT, options.features.motion);
        previous = out.state; previousT = t; delete out.state;
        if (out.change) faceTrack = [];
        out.faces = []; out.person = null; out.visionSample = !!visionFrame;
        if (visionFrame && (face || person)) {
          if (face) {
            let detected = face.detect(canvas).detections;
            if (options.quality !== 'fast') {
              const tile = new OffscreenCanvas(Math.round(w * .5), Math.round(h * .7)), tileCtx = tile.getContext('2d');
              for (const y of [0, h - tile.height]) for (const x of [0, Math.round(w * .25), w - tile.width]) {
                tileCtx.drawImage(canvas, x, y, tile.width, tile.height, 0, 0, tile.width, tile.height);
                for (const d of face.detect(tile).detections) detected.push({ ...d, boundingBox: { ...d.boundingBox, originX: d.boundingBox.originX + x, originY: d.boundingBox.originY + y } });
              }
              tile.width = tile.height = 1;
              const unique = [];
              for (const d of detected.sort((a, b) => (b.categories[0]?.score || 0) - (a.categories[0]?.score || 0))) {
                const a = d.boundingBox;
                if (unique.every(other => { const b = other.boundingBox, intersection = Math.max(0, Math.min(a.originX + a.width, b.originX + b.width) - Math.max(a.originX, b.originX)) * Math.max(0, Math.min(a.originY + a.height, b.originY + b.height) - Math.max(a.originY, b.originY)); return intersection / Math.max(1, Math.min(a.width * a.height, b.width * b.height)) < .4; })) unique.push(d);
              }
              detected = unique;
            }
            const used = new Set();
            out.faces = detected.map(d => {
              const b = d.boundingBox, box = { x: Math.max(0, b.originX / w), y: Math.max(0, b.originY / h), w: b.width / w, h: b.height / h, score: d.categories[0]?.score || 0, estimated: false };
              const prev = faceTrack.filter(f => !used.has(f.trackId)).sort((a, b) => Math.hypot(a.x - box.x, a.y - box.y) - Math.hypot(b.x - box.x, b.y - box.y))[0];
              box.trackId = prev && Math.hypot(prev.x - box.x, prev.y - box.y) < .25 ? prev.trackId : 'face-' + ++nextTrack; used.add(box.trackId); return box;
            });
            // Missed detections remain uncertain; briefly retain expanded protection.
            for (const prev of faceTrack) if (!used.has(prev.trackId) && t - prev.lastSeen <= 1) out.faces.push({ ...prev, score: prev.score * .7, estimated: true });
            faceTrack = out.faces.map(f => ({ ...f, lastSeen: f.estimated ? f.lastSeen : t }));
          }
          if (person) {
            person.segment(canvas, result => {
              const mask = result.confidenceMasks[personMaskIndex]; if (!mask) throw new Error('Person confidence channel is missing');
              const data = mask.getAsFloat32Array(), mw = mask.width, mh = mask.height, grid = Array(144).fill(0), counts = Array(144).fill(0);
              let hits = 0, confidence = 0, x0 = mw, y0 = mh, x1 = -1, y1 = -1;
              for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
                const value = data[y * mw + x], cell = Math.min(8, Math.floor(y / mh * 9)) * 16 + Math.min(15, Math.floor(x / mw * 16)); counts[cell]++;
                if (value >= .5) { hits++; confidence += value; grid[cell]++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
              }
              out.person = { grid: grid.map((v, i) => Math.round(v / Math.max(1, counts[i]) * 10000) / 10000), occupancy: hits / data.length, confidence: hits ? confidence / hits : 0, box: hits ? { x: x0 / mw, y: y0 / mh, w: (x1 + 1 - x0) / mw, h: (y1 + 1 - y0) / mh } : null, estimated: false };
              // Callback masks are owned and released by MediaPipe on return.
            });
          }
        }
        if (!options.features.motion) out.motion = null;
        if (!options.features.brightness) out.brightness = null;
        self.postMessage({ id, payload: out });
      }
    } catch (e) { self.postMessage({ id, error: e.message }); }
  };
};
V.WorkerClient = class {
  constructor() {
    const code = '(' + V.workerMain.toString() + ')(' + V.metrics.toString() + ');';
    this.url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); this.worker = new Worker(this.url); this.id = 0; this.pending = new Map();
    this.worker.onmessage = e => { const item = this.pending.get(e.data.id); if (!item) return; this.pending.delete(e.data.id); item.clean(); if (e.data.error) item.reject(new Error(e.data.error)); else item.resolve(e.data.payload); };
    this.worker.onerror = e => { for (const item of this.pending.values()) { item.clean(); item.reject(new Error('ANALYSIS_WORKER: ' + e.message)); } this.pending.clear(); };
  }
  request(kind, payload, signal, transfer = []) {
    V.abort(signal);
    return new Promise((resolve, reject) => {
      const id = ++this.id; let timer;
      const stop = () => { this.pending.delete(id); clean(); reject(new DOMException('Cancelled', 'AbortError')); }, clean = () => { clearTimeout(timer); signal.removeEventListener('abort', stop); };
      timer = setTimeout(() => { this.pending.delete(id); clean(); reject(new Error('ANALYSIS_WORKER_TIMEOUT')); }, kind === 'init' ? 45000 : 15000);
      signal.addEventListener('abort', stop, { once: true }); this.pending.set(id, { resolve, reject, clean }); this.worker.postMessage({ id, kind, payload }, transfer);
    });
  }
  close() { this.worker.terminate(); URL.revokeObjectURL(this.url); for (const item of this.pending.values()) { item.clean(); item.reject(new DOMException('Cancelled', 'AbortError')); } this.pending.clear(); }
};
V.run = async (media, rawOptions, signal, onProgress) => {
  if (!media?.file) throw new Error(J.layerText('背景の動画または静止画を読み込んでください。', 'Load a video or image background.'));
  if (location.protocol === 'file:' && (rawOptions.features.face || rawOptions.features.person)) throw new Error(J.layerText('人物解析はHTTPサーバーから起動してください。従来の編集は直接起動でも使えます。', 'For person analysis, use a local HTTP server. Existing editing still works from a file.'));
  const started = performance.now(), options = V.options(rawOptions), q = V.quality[options.quality], provider = new V.FrameProvider(); let worker;
  try {
    const source = await V.sourceInfo(media, signal), duration = media.video ? source.duration : Math.max(1, options.end || J.ui.plan.duration || 5), start = options.start, end = options.end || duration;
    if (!(end > start) || start < 0 || (media.video && end > duration + .001)) throw new Error(J.layerText('解析範囲を素材の長さ以内で指定してください。', 'Set the analysis range within the media duration.'));
    const range = { start, end }, times = media.video ? V.times(start, end, q.fps, options.maxFrames) : [start];
    await provider.open(media, options.features.face || options.features.person ? q.visionWidth : q.width, signal); worker = new V.WorkerClient();
    const base = new URL((document.documentElement.lang === 'en' ? '../' : './') + 'vendor/vision/', location.href).href;
    const vision = await worker.request('init', { options, base, metricWidth: q.width }, signal); let samples = [];
    const sampleAll = async (timestamps, progressStart = 0, progressSpan = 1) => {
    const output = [];
    for (let i = 0; i < timestamps.length; i++) {
      V.abort(signal); const t = timestamps[i], frame = await provider.frame(t), visionFrame = i % q.visionEvery === 0 || i === timestamps.length - 1;
      const sample = await worker.request('frame', { width: frame.width, height: frame.height, buffer: frame.data.buffer, t, visionFrame }, signal, [frame.data.buffer]);
      output.push({ ...sample, t, videoTime: media.video ? Math.min(t, source.duration) : 0 }); onProgress(progressStart + progressSpan * (i + 1) / timestamps.length);
    }
    return output;
    };
    samples = await sampleAll(times, 0, options.quality === 'high' ? .8 : 1);
    // High quality refines boundaries with a fresh, separate pass; all final samples sorted.
    if (media.video && options.quality === 'high' && options.features.scene && samples.length < options.maxFrames) {
      const refinements = [];
      for (let i = 1; i < samples.length && times.length + refinements.length < options.maxFrames; i++) if (samples[i].change === 'cut') refinements.push(V.round((samples[i - 1].t + samples[i].t) / 2));
      if (refinements.length) {
        worker.close(); worker = new V.WorkerClient(); await worker.request('init', { options, base, metricWidth: q.width }, signal);
        samples = await sampleAll([...new Set([...times, ...refinements])].sort((a, b) => a - b), .8, .2);
      }
    }
    V.abort(signal); onProgress(1);
    const warnings = [...vision.warnings];
    if (media.video && times.length >= options.maxFrames) warnings.push('FRAME_CAP: sampling interval increased to respect the frame limit.');
    if (!vision.face && options.features.face) warnings.push('Face protection is unavailable; add manual regions.');
    if (!vision.person && options.features.person) warnings.push('Person segmentation is unavailable; Safe Zone cannot confirm person avoidance.');
    if (vision.face && !samples.some(s => s.faces?.some(f => !f.estimated))) warnings.push('NO_FACE_DETECTED: this does not prove faces are absent; inspect the preview or add manual protection.');
    if (samples.some(s => (s.faces || []).length > 1)) warnings.push('MULTIPLE_FACES: person masks may miss smaller or distant people; inspect every subtitle interval.');
    const result = { format: 'synthia-video-analysis', schemaVersion: 1, source, range, options, samples, scenes: V.finalizeScenes(samples, range, options.features.scene), createdAt: new Date().toISOString(), elapsedMs: performance.now() - started, models: { runtime: 'MediaPipe Tasks Vision 0.10.21', face: vision.face ? 'BlazeFace short-range float16 v1' : '', person: vision.person ? 'SelfieSegmenter float16 v1 (sigmoid foreground)' : '' }, warnings };
    return V.validateResult(result);
  } finally { provider.close(); worker?.close(); }
};
})();
