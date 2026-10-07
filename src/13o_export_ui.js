(() => {
    'use strict';
    function boot() {
        const el = J.studioElement, tr = J.layerText, root = J.studioSection('export', '完成MP4・透過PNG連番', 'Completed MP4 / transparent PNG sequence'), filename = el('input', null, 'studioExportName'), label = el('label', tr('出力ファイル名（拡張子を除く）', 'Output filename (without extension)')), status = el('p', null, 'studioExportStatus'), cancel = el('button', tr('中止', 'Cancel'), 'studioExportCancel');
        filename.type = 'text';
        filename.maxLength = 100;
        label.append(filename);
        filename.addEventListener('change', () => { J.uiApi.pushEdit(); J.ui.project.studio.output.filename = filename.value.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 100); J.studioChanged(); });
        cancel.type = 'button';
        cancel.hidden = true;
        cancel.addEventListener('click', () => J.ui.exporting?.abort());
        root.append(label, J.studioButton('studioCompletedMP4', '完成MP4を書き出す', 'Export completed MP4', () => document.getElementById('simpleExport').click()), J.studioButton('studioExportPNG', '歌詞のみ透過PNG連番（ZIP）', 'Transparent lyric PNG sequence (ZIP)', async () => {
            J.uiApi.pause();
            ( /** @type {HTMLElement|null} */(document.activeElement))?.blur();
            if (J.layerCueEditsInvalid)
                throw new Error(tr('字幕の入力エラーを修正してください。', 'Fix invalid cue edits first.'));
            const project = structuredClone(J.ui.project), plan = J.ui.plan, range = J.uiApi.exportRange(), ac = new AbortController(), controls = [...( /** @type {NodeListOf<StudioControl>} */(document.querySelectorAll('#app button,#app input,#app textarea,#app select')))], disabled = controls.map(c => c.disabled);
            J.ui.exporting = ac;
            J.layerSession.busy = true;
            controls.forEach(c => c.disabled = true);
            cancel.disabled = false;
            cancel.hidden = false;
            try {
                await J.saveStudioSnapshot?.(project);
                const blob = await J.exportStudioPNG({ project, plan, range, signal: ac.signal, onProgress: (progress, text) => status.textContent = text });
                await J.saveFile(J.studioOutputName(project) + '_lyrics_png.zip', blob);
                status.textContent = tr('PNG連番を保存しました。', 'PNG sequence saved.');
            }
            catch (e) {
                status.textContent = e.name === 'AbortError' ? tr('中止しました。', 'Cancelled.') : e.message;
            }
            finally {
                controls.forEach((c, i) => c.disabled = disabled[i]);
                J.ui.exporting = null;
                J.layerSession.busy = false;
                cancel.hidden = true;
                J.syncLayerUI();
            }
        }), cancel, status, el('p', tr('完成MP4は既存H.264/AACエンジンで背景・歌詞・追加レイヤーを焼き込みます。追加動画の音声は使わず、読込音源を使います。PNGは歌詞だけを透明背景で出力。長さ・解像度は既存の完成動画設定／書き出し範囲を使います。透過WebMは標準機能にしていません。', 'Completed MP4 uses the existing H.264/AAC engine to burn in backgrounds, lyrics and additional layers. Added video audio is muted; imported audio is used. PNG contains the lyric layer on transparency. Duration, resolution and range use existing export settings. Alpha WebM is not enabled.')));
        const old = J.syncLayerUI;
        J.syncLayerUI = () => { old(); filename.value = J.ui.project.studio.output.filename; };
        J.syncLayerUI();
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot);
    else
        boot();
})();
