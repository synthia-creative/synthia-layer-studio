# Independent cut and effect-part editing

Enable Character editing and choose **Cut / Part**. Group transforms all cuts of a subtitle. Cut transforms one temporal cut. Part transforms one simultaneous drawing block. Line / Character edits text.

## Controls

1. Choose the subtitle and target in the lists. Each entry shows its cut number, text, drawing slot and identifier; selection seeks to that cut. Lists also recover overlapping, off-time and offscreen targets.
2. Drag inside the frame to move, use corners to scale, or the top circle to rotate. Dragging inside an already selected cut keeps that cut selected. Use the list to choose a different overlapping target.
3. X/Y use parent coordinates as % of frame width/height (default 0, −400 to 400). Scale uses % (default 100, 5 to 1000). Rotation uses degrees (default 0, −360 to 360). Invalid/empty numeric values are rejected.
4. Reset position, scale, rotation, or all transforms of the selected target. Siblings, Group, text edits and subtitle times remain independent. A drag is one existing undo transaction; numeric commits and resets are also undoable.
5. Combine Group → Cut → Part. Existing subtitle locks, playback, Tap and export block edits. Saved transforms continue rendering when editing is disabled.

## Ownership and supported styles

| Style | Independent blocks | Attached drawing |
|---|---|---|
| Stacked tape | Each tape strip | Text, backing, stripes and shading |
| Single/cross tape | Main tape and secondary tape | The main tape includes its number/Roman-letter label |
| Labels | Each label and central orb/word | Text with its backing; central element |
| Panels | Each panel | Text, outline, backing, focus lines and tone |
| Other styles | Whole cut | All cut-owned text and decorations |

Other styles explicitly report unavailable internal subdivision. Supporting them requires layout-specific drawing scopes. Shared front decorations belong to the whole cut and are not copied into parts. Backgrounds, screen decorations and additional layers retain their scope. Center-free companion bands are separate targets (B), with existing band clipping retained. Bounds conservatively include shadows and path control points. Output clips content outside the frame.

Example: enter `夜明けの色を/覚えてる` as untimed lyrics and select Tape. Two cuts allow independent phrase editing. One stacked-tape cut allows editing only the strip containing `覚えてる`, while earlier strips stay fixed. Details/regeneration may be needed to obtain the stacked variant.

## Persistence, regeneration and export

JSON and IndexedDB store independent UUID records. Old JSON defaults to identity. Timing, color and font-only changes are excluded from topology signatures. Regeneration/Auto/gacha that changes topology suspends unmatched records without deleting them, shows their count, and never transfers settings to unrelated objects. Returning to the original structure reactivates matching records. Group values remain intact. Identical untimed lines retain occurrence-order limitations; use timed cues for strict subtitle identity.

Generic motion-library recipes exclude Part transforms because recipes can apply to different text. Settings remain project-local and become active only when the applied topology matches.

Front, binary/translucent matte, simple/completed MP4 and transparent PNG sequences share the transform renderer. Selection UI is excluded. Safe Zone measures transformed bounds including decorations. Analysis OFF does not initiate analysis. Existing manual placement adds device-space text offsets once and retains previous shared-decoration behavior.

## Developer contract

`studio.partTransforms[id] = {owner, signature, kind, transform}`. The ID is `part-UUID`, owner is the stable subtitle ID, and kind is `cut` or `part`. Signatures include full text, cut sequence, part topology and drawing slot; array index alone never identifies a target. Unknown records/numbers are sanitized. Duplication creates new UUIDs; deletion removes only that subtitle's records.

`11zzzzzz_parts.js` annotates planned targets. Layouts explicitly wrap owned drawing blocks using `renderEffectPart`; ownership never uses string matching or rendered-pixel slicing. Rest bounds use drawing-command geometry on a 1px measuring canvas and a per-cut WeakMap cache. Group rest measurement excludes child transforms. Actual bounds are recorded from the same live drawing commands.

Outer-to-inner matrices: completed Lyrics composition → Group → original camera → Cut → Part → text animation / Line / Character. Background/screen scopes bypass child transforms. Normalized offsets scale with output resolution. UI drag uses the inverse parent matrix; preview-only canvases display handles.

Run `python build.py`, `node dev/part_transform_test.js`, existing layer/filler/simple-export and related tests, and the `dev/tsconfig.studio.json` type check. Actual browser interaction and MP4/PNG decoding are required in addition to unit tests.
