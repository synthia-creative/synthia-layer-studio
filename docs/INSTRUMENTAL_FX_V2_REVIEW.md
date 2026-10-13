# Instrumental FX v2.0: implementation decisions

## Phase 1 — baseline and reuse

Baseline: `2d33c16` (v1.1 local UI). Existing native spectrum, Instrumental FX, Music Auto, simple export and video analysis state tests: 34 passed before edits.

- `10_audio.js` decodes PCM and derives RMS, Peak, normalized energy, Onset and estimated beats at 50 Hz. Music Auto already reuses these via `studioAnalyze` and a WeakMap.
- `11v_native_spectrum.js` computes a 64-band FFT at 60 Hz in a Blob worker. Its original frequency range, bars, pulse shaping and black-art/matte policy must remain unchanged. Add low/mid/high measurements to the same FFT and share its completed/in-flight result between consumers.
- `11zzzzzzz_instrumental.js` owns v1 normalization, regions, independent Auto/Manual gates and six deterministic renderers. Add v2 adapters and renderers without replacing those implementations.
- `13s_instrumental_ui.js` owns one Undo transaction per creation, regeneration confirmation, locked Auto retention and Manual protection. Keep this transaction pipeline; stage v2 features together with generated effects before publishing any result.
- Normal preview and completed/simple MP4 both call `composeInstrumentalStudio` after background/native spectrum and before the optional title text. Put video processing at that shared composition point. Lyric-only front/matte/PNG retain their original meaning.
- Image targets live in `studio.layers`, use `studioMedia` for preview and frame-addressed export assets for MP4. Apply reactive transforms at the existing layer transform point without mutating saved layer geometry.
- Video Analysis remains explicitly started and independent. New FX may use its existing matched placement result; they do not launch video analysis.

## Analysis and determinism

V2 stores bounded, quantized PCM-derived features in the same project as FX. The existing music analysis supplies scalar features and credible beats; FFT supplies spectrum and physical frequency bands; waveform stores signed audio samples, not a simulated sine wave. Attack/release, smoothing and peak hold are precomputed from frame zero and cached by settings. Rendering interpolates those time-addressed arrays, so previous playback order cannot affect a seek or MP4.

Spectral/waveform feature frames are capped at 9,000, with sample rate reduced for long tracks. Full resolution is 30 Hz through five minutes. Features are packed into at most about 1.61 MB of base64; regeneration on the same audio retains only one packed copy. The original native spectrum still uses its original 60-Hz data. Frequency bands: 20–250 Hz / 250–4000 Hz / 4000 Hz–Nyquist.

## Composition and cost

Video effects operate on a bounded scratch canvas after background, lyrics, additional layers and Instrumental FX. Quality limits resolution, blur samples and rays/noise density. Motion blur is a spatial directional blur, not history accumulation; radial blur uses deterministic zoom samples. This avoids making the result depend on playback history. Strong full-frame white flashing is not introduced; existing local flash limits remain active.

## Compatibility

Old FX keep their original types, parameters and rendering path. New v2 types/settings/features are optional additions to version-1 project JSON. Parent, Auto and Manual still default OFF. Existing manual objects and locked Auto objects survive regeneration. Missing targets suspend their reaction rather than silently assigning another object. Missing/mismatched media never creates fake periodic audio response.
