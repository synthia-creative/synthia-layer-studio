/* Execution permission and result visibility never imply each other. */
(() => {
'use strict';
const V = J.VideoAnalysis;
V.Controller = class {
  constructor(run, onChange = () => {}, onResult = () => {}) { this.run = run; this.onChange = onChange; this.onResult = onResult; this.enabled = false; this.display = false; this.state = 'idle'; this.progress = 0; this.id = 0; this.result = null; }
  emit() { this.onChange(this); }
  setEnabled(on) { this.enabled = !!on; if (!on) this.cancel(); this.emit(); }
  setDisplay(on) { this.display = !!on; this.emit(); }
  cancel() { ++this.id; this.abortController?.abort(); this.abortController = null; if (this.state === 'running') this.state = 'cancelled'; this.emit(); }
  load(result) { this.cancel(); this.enabled = false; this.display = false; this.result = result; this.progress = 0; this.state = result ? 'saved' : 'idle'; this.error = ''; this.emit(); }
  async start(media, options) {
    if (!this.enabled || this.state === 'running') return false;
    const id = ++this.id, ac = this.abortController = new AbortController();
    this.state = 'running'; this.progress = 0; this.error = ''; this.emit();
    try {
      const result = await this.run(media, options, ac.signal, progress => { if (id === this.id) { this.progress = progress; this.emit(); } });
      if (id !== this.id || ac.signal.aborted || !this.enabled) return false;
      this.result = result; this.state = 'complete'; this.progress = 1; this.onResult(result); this.emit(); return true;
    } catch (e) {
      if (id !== this.id) return false;
      this.state = e.name === 'AbortError' ? 'cancelled' : 'failed'; this.error = e.message; this.emit(); return false;
    } finally { if (id === this.id) this.abortController = null; }
  }
};
})();
