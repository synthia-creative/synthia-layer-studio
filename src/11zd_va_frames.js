/* Analysis owns its decoder/media element. Preview currentTime is never touched. */
(() => {
'use strict';
const V = J.VideoAnalysis;
V.event = (el, name, signal, begin) => new Promise((resolve, reject) => {
  let timer; const clean = () => { clearTimeout(timer); el.removeEventListener(name, done); el.removeEventListener('error', fail); signal?.removeEventListener('abort', stop); };
  const done = () => { clean(); resolve(); }, fail = () => { clean(); reject(new Error('MEDIA_DECODE: ' + (el.error?.message || 'Unsupported or unreadable media'))); }, stop = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
  el.addEventListener(name, done, { once: true }); el.addEventListener('error', fail, { once: true }); signal?.addEventListener('abort', stop, { once: true });
  timer = setTimeout(() => { clean(); reject(new Error('MEDIA_TIMEOUT')); }, 15000);
  if (signal?.aborted) return stop();
  try { begin?.(); } catch (e) { clean(); reject(e); }
});
V.sourceInfo = async (media, signal) => {
  V.abort(signal);
  const file = media.file, full = file.size <= 12 * 1024 * 1024, chunk = 1024 * 1024;
  const blob = full ? file : new Blob([String(file.size), file.slice(0, chunk), file.slice(Math.max(0, Math.floor(file.size / 2) - chunk / 2), Math.floor(file.size / 2) + chunk / 2), file.slice(-chunk)]);
  const data = await blob.arrayBuffer(); V.abort(signal);
  const digest = await crypto.subtle.digest('SHA-256', data); V.abort(signal);
  return V.source({ name: file.name, size: file.size, width: media.width, height: media.height, duration: media.video ? (media.videoDuration || media.duration) : null, kind: media.video ? 'video' : 'image', hash: [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''), hashMode: full ? 'full' : 'sampled-3x1MiB' });
};
V.times = (start, end, fps, cap) => {
  if (!(end > start) || !(fps > 0) || !(cap >= 2)) throw new Error('Invalid analysis range');
  const n = Math.min(cap, Math.ceil((end - start) * fps) + 1), step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => V.round(start + step * i));
};
V.FrameProvider = class {
  async open(media, width, signal) {
    this.signal = signal; this.media = media; this.url = URL.createObjectURL(media.file);
    this.el = document.createElement(media.video ? 'video' : 'img');
    if (media.video) { this.el.muted = true; this.el.playsInline = true; this.el.preload = 'auto'; }
    this.onAbort = () => this.close(); signal.addEventListener('abort', this.onAbort, { once: true });
    try {
      await V.event(this.el, media.video ? 'loadeddata' : 'load', signal, () => { this.el.src = this.url; if (media.video) this.el.load(); });
      V.abort(signal);
      const ratio = Math.min(1, width / Math.max(media.width, media.height));
      this.canvas = document.createElement('canvas'); this.canvas.width = Math.max(8, Math.round(media.width * ratio)); this.canvas.height = Math.max(8, Math.round(media.height * ratio));
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true }); return this;
    } catch (e) { this.close(); throw e; }
  }
  async frame(t) {
    V.abort(this.signal);
    if (this.media.video) {
      const target = Math.max(0, Math.min(t, this.el.duration - .001));
      if (Math.abs(this.el.currentTime - target) > .00001 || this.el.seeking) await V.event(this.el, 'seeked', this.signal, () => { this.el.currentTime = target; });
      if (this.el.readyState < 2) await V.event(this.el, 'loadeddata', this.signal);
    }
    V.abort(this.signal); this.ctx.drawImage(this.el, 0, 0, this.canvas.width, this.canvas.height);
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
  close() {
    this.signal?.removeEventListener('abort', this.onAbort);
    if (this.el) { if (this.media.video) this.el.pause(); this.el.removeAttribute('src'); if (this.media.video) this.el.load(); this.el = null; }
    if (this.url) URL.revokeObjectURL(this.url); this.url = null;
    if (this.canvas) this.canvas.width = this.canvas.height = 1; this.canvas = null; this.ctx = null;
  }
};
})();
