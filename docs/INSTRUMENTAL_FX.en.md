# Instrumental FX Engine v1.0

## Getting started

Open Integrated studio tools → Instrumental FX. The parent, Auto and Manual switches default to OFF. Turning them off retains sections, FX and presets. Preview visibility affects only the preview; the parent disables all FX rendering, including completed MP4.

Detection uses gaps in lyric timings, not vocal recognition. All processing stays in the static browser app.

## 1. Detect sections

Load SRT and audio, enable Instrumental FX, then choose Detect / review sections. Without audio, enter the detection duration. The default minimum gap is 2 seconds with 0.1 seconds of boundary padding. Overlapping lyric cues form a union. Fillers, empty text and instrumental markers do not count as lyrics. A lyric-free song becomes one Custom section.

Review candidates and accept them. Adjust names, start/end, Intro / Interlude / Outro / Custom and Auto targets. Add, delete, split at the playhead or merge with the next section. Reimporting lyrics stages new candidates without replacing adjusted sections. Acceptance excludes candidates overlapping adjusted rows. Replacing all sections is a separate confirmation. Section deletion retains existing FX. Subtitle times are never rewritten.

## 2. Generate Auto FX

Choose Auto / Cyber / Pop / Cinematic / Rock / Minimal, Balanced / Rhythm / Ambient, strength and seed, then Generate all sections. Generation explicitly reuses the existing Energy / Onset / Beat analysis; loading media or enabling FX does not generate effects. Cancel analysis / generation stops the job and retains previous edits. Reloading audio rejects stale completion results.

Enable Auto to display the result. Identical sections, settings, seed and analysis reproduce the same FX. Zero strength generates no automatic effects. Fillers lower density and opacity.

## 3. Add Manual FX

Select a section and one of Particle Burst, Light Flash, Geometry Motion, Audio Pulse, Light Trails or Transition Accent. Add Manual FX and enable Manual. Audio is optional; use the playhead and numeric times.

## 4. Edit individual effects

Select one FX and edit start/end/duration, X/Y, scale, rotation, opacity, color, blend, speed, intensity, beat response, front/back plane, visibility and lock. Type-specific settings include count, lifetime, velocity, flash brightness/range, geometry shape/line width, pulse sensitivity, trail length and accent type.

Enable direct preview editing while paused: select an FX center and drag to move, use corners to scale or the top circle to rotate. Handles never enter exports. Other objects stay independent. Auto then Manual tracks compose in list order, bottom to top. Change each effect's position relative to lyrics and its order within the track.

Auto / Manual tracks appear below additional layers, or inside the FX section when the layer extension is OFF. Drag a clip to move it; drag either edge to resize. Optional beat snapping applies only to FX. Use the list to select overlapping clips. Ctrl+Z undoes changes; Ctrl+Shift+Z / Ctrl+Y redoes them. Locked objects cannot be moved, deleted or regenerated. Project-local presets support save, apply, rename, delete and duplicate.

## 5. Switches

Auto and Manual are independent and can compose together under the parent. Auto beat response needs both global Auto beat response and the individual effect's beat setting. Manual uses its individual beat switch. Saved analysis can work without reloaded audio; missing analysis uses deterministic periodic/static fallback.

## 6. Regenerate

Regenerate all sections, one section or one unlocked Auto FX. Locked Auto FX and all Manual FX remain intact. Restore before generation restores the last automatic result; Undo is also available. Convert or duplicate Auto FX into independent Manual FX. Lyrics and video analysis are preserved.

## 7. Save and restore

Version-1 project JSON uses `studio.instrumentalFx` for switches, sections, objects, parameters, order, seeds, compact analysis, presets and locks. Old JSON initializes the new feature OFF. Existing autosave and optional IndexedDB recovery include FX. Media files still require separate reloading; FX data survives without media.

## 8. Export MP4

Completed MP4 and simple-video exports include background, lyrics and FX through the same time-addressed Canvas composition as preview. Seeking, pausing, speed and range export retain the same deterministic state.

Subtitle front / binary or gray matte and transparent lyric PNG sequences retain their lyric-only meaning and exclude Instrumental FX. FX RGB/matte pairs, transparent FX sequences and WebM are not offered in v1.0; use completed MP4.

## 9. Troubleshooting

- Missing effects: check parent, Auto / Manual, preview and individual visibility, and the current time.
- Wrong sections: check duration, minimum gap and padding, then manually adjust sections.
- People avoidance unavailable: run video analysis explicitly for the same background. FX never starts video analysis. Missing, mismatched or insufficient analysis falls back to normal placement. Candidate scoring is heuristic and cannot guarantee every particle trajectory.
- Too many FX: use Ambient or shorter sections. Each track is limited to 512 objects, each plane to 20 concurrent objects, with bounded particle counts per quality level.
- Slow preview: choose low quality and fewer particles.
- Strong flashes: retain the default flash limit. It caps interval, local area and aggregate brightness and respects reduced-motion preferences; it cannot guarantee absence of all visual stimulation.
- Editing blocked: unlock the selected object.
