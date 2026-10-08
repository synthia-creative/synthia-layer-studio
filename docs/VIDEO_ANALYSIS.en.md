# Video Analysis Engine v1.0

This optional tool estimates motion, scenes, brightness, faces, people and lyric placement from a background video or image. The existing editor, renderer and MP4 engines remain in use. No automatic motion generation or video editing is added.

## Workflow

1. Open the app through HTTP in desktop Chrome/Edge and load a background video/image.
2. Open **Integrated studio tools → Video analysis**. Lyrics are optional for analysis.
3. Turn **Enable video analysis** ON, choose quality/range/features, then press **Start analysis**. Turning the switch ON alone does nothing.
4. Enable **Show analysis results** to inspect faces, person occupancy, motion, regional brightness and scene candidates.
5. In **Safe Zone / lyric placement**, select a subtitle and evaluate up to three candidates. Compare score, overlap, readability and analysis confidence separately. Preview the animation before applying its position.
6. Apply explicitly. Timing, fonts, colors and motion are retained; Ctrl+Z undoes the placement. Applied positions persist with analysis OFF.

| Analysis | Display | Behavior |
| --- | --- | --- |
| OFF | OFF | Ordinary editing, no new analysis, no guides. |
| ON | OFF | Explicit Start runs analysis; guides remain hidden. |
| OFF | ON | Matching saved results can be displayed; no new analysis. |
| ON | ON | Explicit Start runs analysis; completed results can be displayed. |

Both switches reset to OFF at launch/project import/analysis import and are never persisted. Turning analysis OFF cancels the current Worker/decode without deleting saved results, manual regions or applied positions. Visibility is independent. Media changes cancel stale jobs and hide mismatched data. Starting an export cancels analysis to prioritize output.

## Quality and bounds

| Quality | Metrics / vision longest side | Approximate rate | Vision frequency |
| --- | --- | --- | --- |
| Fast | 160 / 320px | 1 fps | Every third sample plus final sample |
| Standard | 240 / 512px | 2 fps | Every second sample plus final sample |
| Detailed | 320 / 640px | 4 fps | Every sample, plus refined cut boundaries |

Standard/Detailed also scan six overlapping tiles for small faces and deduplicate results. Default frame limit is 600, maximum 1200. Longer ranges increase spacing and produce a FRAME_CAP warning. End seconds 0 means media end. Frames are decoded separately from the preview, one at a time; only coarse measurements are saved.

Motion uses sparse textured block matching, normalized per second and image size. Scene candidates use chroma/luma/edge changes; flashes/fades are separate. Brightness and complexity use an 8×6 grid. Faces use fixed BlazeFace short-range float16 v1 with brief geometric tracking and missed-face protection. People use fixed SelfieSegmenter float16 v1, its one-channel sigmoid foreground mask, reduced to a 16×9 occupancy grid.

Safe Zone uses finite sampling of animated glyph bounds from the existing renderer, then evaluates the subtitle interval against faces, silhouettes, timed manual regions, other lyrics, contrast, complexity, motion and screen edges. Base weights: face 45%, people 22%, complexity 10%, readability 10%, motion 8%, edge 5%. Manual-region/other-lyric overlap is heavily penalized. Scores are heuristic preferences, not model probabilities. Confidence is a separate estimate including model availability and temporal coverage. No detection does not prove nobody is present. Inspect every recommendation visually. Suggested colors are never applied automatically.

## Manual editing and multiple subtitles

Add/update/delete a protected region using source-relative coordinates and start/end seconds, or use preview drag modes to add, move or resize it. Regions belong to a source hash and are retained on reanalysis. Use multiple timed regions for moving subjects. Manual protection remains available when a model fails.

Manual lyric X/Y sets the center of its measured animated envelope. Removing the position override restores the original placement. Locked subtitles reject placement, manual placement and override removal.

Select multiple subtitles, evaluate them, then preview every target. Only then can you confirm a batch application; one Ctrl+Z restores all positions. Select all is supported. Guides and uncommitted candidate previews are confined to the preview Canvas; they are excluded from front/matte/completed MP4, range exports and transparent PNG sequences. Applied placements use the existing renderer for previews and exports.

## Saving and source validation

Save standalone `.analysis.json`, or save the project JSON containing optional `videoAnalysis` options/results/regions/placements. Legacy version 1 projects remain supported. Invalid analysis data disables only analysis, preserving ordinary editing. Importing results does not apply or overwrite positions.

Reload the source media after opening a project. Match kind, size, dimensions, duration and SHA-256, not filename. Files up to 12MiB use a full hash; larger files hash the first/middle/last 1MiB plus size. The sampled hash is not proof of whole-file identity; `hashMode` records this distinction. Analysis JSON limit: 16MiB. Deleting analysis results retains manual regions and placements.

## Static operation

Run `python -m http.server 8765 --bind 127.0.0.1` from this folder, then open `http://127.0.0.1:8765/` or `/en/`. This only serves static files; media is processed locally, never uploaded. Models are bundled and loaded only on explicit analysis. Existing Google Fonts may still make external requests.

The editor remains built as a standalone HTML. Person analysis requires HTTP because of browser module/WASM restrictions; ordinary editing still works from `file://`. Serve the entire `vendor/vision/` tree with `.mjs` as JavaScript and `.wasm` as `application/wasm`. Root/subdirectory/English relative paths are supported. Strict CSP must allow blob Workers and same-origin model requests. Packaging does not publish the app.

## Limitations and integration

Small/distant/profile/occluded faces, low light, differently sized crowds, anime/AI characters and fast motion can produce misses or false positives. Coarse grids miss fine outlines and short appearances. Tracking is geometric, not identity recognition. Block matching cannot fully separate camera movement from subject motion or measure arbitrary large/subpixel displacement. Scene detection is approximate.

Lyric bounds use 480px, about 8 fps and up to 160 regular samples plus cut boundaries; they do not prove optimal placement at every full-resolution frame. Background mapping follows the existing start 0, speed 1, no loop, hold-last-frame behavior. True source fps is unknown (`null`). Only browser-supported codecs work. Model failure falls back to basic measurements and provisional placement. Decoder memory depends on source resolution/length; whole-process peak RAM is not guaranteed.

Future integration can consume `J.VideoAnalysis.run(media, options, signal, onProgress)`, `evaluateSafeAsync(...)`, source/range/mapping, per-timestamp motion/brightness/faces/person/change, scenes and safeZones. Applied positions use `videoAnalysis.placements[cue-ID/line-index]` with a matching-text guard. Automatic motion generation is outside this version.

Fixed MediaPipe Tasks Vision 0.10.21 and float16 model version 1 are included with hashes/provenance in `vendor/vision/manifest.json`. See [notices](../THIRD_PARTY_NOTICES.md), [Face Detector](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js), [Image Segmenter](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js), [BlazeFace model card](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20%28Short%20Range%29.pdf), and [Selfie Segmentation model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf).

## Candidates needing review (v1.7.1)

Each candidate shows specific reasons and corrective actions. Animated text is assessed at sampled times rather than as a single union of its whole path. The candidate rectangle and manual-position anchor use the frame nearest the subtitle interval midpoint. Only simultaneously visible subtitles count as other-text collisions. Coverage is assessed within the target interval. Actual face, person and protected-region collisions still require review. Contrast is a single-color approximation; inspect outlines, gradients and shadows visually.

Use the [HTML guide](VIDEO_ANALYSIS.en.html) in browsers. The Markdown file also includes a UTF-8 byte-order mark for direct viewing.
