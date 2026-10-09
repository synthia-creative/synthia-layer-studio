# Integrated studio tools (v1.6.0)

## Subtitle group editing

Enable **Character editing**, open **Character / line / group editing**, and choose **Group**. Pause and click a subtitle in the preview. Group controls the entire subtitle with attached tape, labels and ornaments; Line adjusts its text line and Character adjusts an individual glyph. Multiline text within one cue belongs to the same group.

- Drag inside the selection to move. Drag a corner to scale around the shared visual center; drag the top circle to rotate. Numeric X/Y are offsets in percent of frame width/height, initially 0. Scale starts at 100%; rotation starts at 0°. Limits are −400–400%, 5–1000%, and −360–360° respectively. Empty/invalid values are rejected.
- Reset position, scale or rotation separately, or reset all Group transforms for the selected cue. Glyph/line edits, motion, timing and other cues remain intact. One drag is one Undo transaction; Redo restores it.
- Screen decorations, stripes, preview backgrounds and added image/video/text layers remain independent. Group wraps existing animation/camera, then manual placement is applied; the Lyrics layer transform follows during completed composition. Safe Zone measures the transformed subtitle with its ornaments.
- Locked cues and playback, Tap Sync or export sessions cannot be edited. Content outside the frame is clipped; existing center-free band clipping remains. The selection uses a conservative bounding rectangle which can include decoration margins.
- `studio.groups` saves transforms; `studio.groupLines` saves stable IDs for untimed lyrics. Missing fields in old JSON default to identity. JSON and IndexedDB restore them; Auto, cue draws and style/font changes preserve them. Identical untimed text is matched by occurrence order; use timed cues for strict identity.
- Turning the editing extension OFF retains stored transforms in rendering. Reset them to remove them. Front/matte, simple/completed MP4 and transparent lyric PNG use the same transforms. Selection handles are preview-only. Group keyframes and combining separate cues are not provided.

Use Windows Chrome or Edge. Open **Integrated studio tools → Enable / disable extensions**, select the tools you need, then expand their sections. All extensions default to OFF. Settings use an optional `studio` namespace in version 1 JSON; existing lyrics, cue times, motion libraries and MP4 tools remain available.

1. Load audio and lyrics. Import SRT without changing exact start/end timestamps, import LRC, or paste lyrics and choose section breaks/interludes for blank lines.
2. For untimed lyrics, enable Enhanced Tap Sync and start the existing Tap session. Use Space or the large pointer button. Undo/Backspace works even after the final line. Select a 0/50/100/150ms ending gap. Text fields, dialogs, buttons and active drags suppress Tap keyboard input.
3. Enable Character editing for Line/Character selection and direct preview dragging. Edit position, scale, rotation, opacity and kerning. Emoji use code-point indexing; newlines do not receive glyph indices. Complex shaping/combining marks depend on the font.
4. Import/drop TTF/OTF/WOFF/WOFF2 fonts: up to 8 files, 8MB per file, 24MB total base64. Font binaries are embedded in JSON/recovery. Check font redistribution rights before sharing projects. Existing installed-font enumeration/manual family entry remains available.
5. Select IN/HOLD/OUT motion, intensity 0–1 and perceptual controls 0–100, or one of ten presets using the existing motion engine.
6. Analyze RMS, Peak, Energy, Onset, estimated beats, section changes and lyric density. Results are cached for the same audio. Enter manual sections as `start seconds, end seconds, Intro/Verse/PreChorus/Chorus/Bridge/Outro`. Section-change detection does not infer semantic song structure.
7. Design Auto is the existing Auto-compose. Music Auto uses audio/density/sections; Full Auto combines both. Auto preserves SRT timestamps. Beat Snap defaults to OFF and changes starts only after explicit application within a selected 20/50/100/150ms bound, retaining durations.
8. Additional tracks support cue moving, right-edge resizing, duplication and deletion. Editing untimed lyrics explicitly creates timed cues from the current plan. Add/order Lyrics, Text, Image, Video, Overlay, Effect and Background layers; adjust blend, opacity, times and transforms. Lyrics remains present. Load media for selected Image/Video layers. Videos hold their final frame after playback. These tracks supplement the existing timeline rather than providing a full NLE.
9. Set an export filename and choose Completed MP4, using existing simple-video settings for duration/resolution. The original H.264/AAC engine includes added layers. Active layers with missing media block export and request reloading. Transparent lyric PNG ZIP includes lyrics/legacy decorations but excludes generic added layers, supports cancellation and is limited to 18,000 frames. WebM/alpha video is not included.
10. Enable Autosave / recovery for edit-triggered, 15-second and pre-export IndexedDB snapshots. Choose restore/discard on next launch. Use Save snapshot now and wait for the Saved status before closing. Turning it OFF deletes recovery data. Audio/images/videos require reloading; font binaries restore from the snapshot. Save JSON as well, especially for large fonts exceeding localStorage capacity.

Browser data deletion, private mode, quotas and another browser/origin can remove or isolate recovery data. Physical pen devices, real phones, Mac Safari and long 4K exports require separate testing. Lyrics Studio is unchanged.

[Independent Cut / Part controls, ownership, persistence and developer contract](CUT_PART_TRANSFORMS.en.md)
