/* Opt-in integrated tools. Projects retain their existing version-1 fields. */
(() => {
'use strict';
const finite = (v, d, lo, hi) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
J.STUDIO_FEATURES = ['tapSync', 'lyricsTiming', 'characterEditing', 'advancedFont', 'musicAnalysis', 'autoMotion', 'timeline', 'export', 'autosave'];
J.normalizeStudio = value => ({
  flags: Object.fromEntries(J.STUDIO_FEATURES.map(k => [k, value?.flags?.[k] === true])),
  tapGap: finite(value?.tapGap, 0, 0, 1000),
  blankLines: value?.blankLines === 'keep' ? 'keep' : 'skip',
});
J.studioOn = (project, feature) => project?.studio?.flags?.[feature] === true;
const defaults = J.defaultProject, upgrade = J.upgradeLayerProject;
J.defaultProject = () => ({ ...defaults(), studio: J.normalizeStudio() });
J.upgradeLayerProject = (project, source) => {
  upgrade(project, source); project.studio = J.normalizeStudio(source?.studio); return project;
};
// The complete timing snapshot matters: a tap can invalidate later old taps.
J.studioTap = (lineTimes, index, time, count) => {
  if (!Number.isInteger(index) || index < 0 || index >= count || !Number.isFinite(time) || time < 0) throw new Error('Invalid tap');
  const rounded = Math.round(time * 1000) / 1000;
  const previous = Object.values(Object.fromEntries(Object.entries(lineTimes).filter(([k]) => +k < index)));
  if (previous.some(t => t >= rounded)) throw new Error(J.layerText('直前の行より後の時刻で打刻してください。', 'Tap after the preceding line.'));
  const before = { ...lineTimes }, next = { ...lineTimes, [index]: rounded };
  for (const k of Object.keys(next)) if (+k > index && next[k] <= time + 0.2) delete next[k];
  return { before, next, index };
};
J.studioTapGap = (plan, project) => {
  if (!J.studioOn(project, 'tapSync') || Array.isArray(project.subtitleCues)) return plan;
  const gap = J.normalizeStudio(project.studio).tapGap / 1000, times = project.timing.lineTimes || {};
  for (let i = 0; i < plan.lines.length - 1; i++) {
    const line = plan.lines[i], next = plan.lines[i + 1];
    if (!Number.isFinite(times[i]) || !Number.isFinite(times[i + 1])) continue;
    const end = Math.max(line.start + .001, next.start - gap);
    const before = line.end, ratio = (end - line.start) / Math.max(.001, before - line.start);
    for (const cut of plan.cuts) if (cut.line === i && cut.layout !== 'interlude') {
      cut.start = line.start + (cut.start - line.start) * ratio;
      cut.end = line.start + (cut.end - line.start) * ratio;
      cut.dur = cut.end - cut.start;
      cut.inDur = Math.min(cut.inDur, cut.dur / 2); cut.outDur = Math.min(cut.outDur, cut.dur / 2);
    }
    line.end = end;
  }
  return plan;
};
const planner = J.plan;
J.plan = (project, audio) => J.studioTapGap(planner(project, audio), project);
})();
