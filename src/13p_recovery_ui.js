(() => {
    'use strict';
    async function boot() {
        const el = J.studioElement, tr = J.layerText, root = J.studioSection('autosave', 'ブラウザ自動保存・復元', 'Browser autosave / recovery'), status = el('p', null, 'studioRecoveryStatus');
        status.setAttribute('role', 'status');
        J.studioRecoveryStatus = text => status.textContent = text;
        root.append(J.studioButton('studioSaveNow', '今すぐ自動保存', 'Save snapshot now', () => J.saveStudioSnapshot()), status, el('p', tr('操作変更後・15秒ごと・完成MP4とPNG出力前にIndexedDBへ保存します。次回起動時に復元／破棄を選べます。音源・画像・動画は別途再読込が必要です。フォントファイルはプロジェクト内データから復元されます。拡張をOFFにすると復元用保存を削除します。', 'Save to IndexedDB after edits, every 15 seconds, and before completed MP4 / PNG export. Choose restore or discard on next launch. Reload audio, images and videos separately. Embedded fonts are restored. Turning this extension OFF deletes the recovery snapshot.')));
        let timer = null, wasEnabled = false;
        const schedule = () => {
            clearTimeout(timer);
            if (J.studioRecoveryPending)
                return;
            const enabled = J.studioOn(J.ui.project, 'autosave');
            if (!enabled) {
                if (wasEnabled)
                    J.deleteStudioSnapshot().catch(e => J.studioRecoveryStatus(e.message));
                wasEnabled = false;
                return;
            }
            wasEnabled = true;
            timer = setTimeout(() => {
                if (!J.ui.exporting)
                    J.saveStudioSnapshot();
            }, 350);
        };
        const old = J.syncLayerUI;
        J.syncLayerUI = () => { old(); schedule(); };
        J.syncLayerUI();
        setInterval(() => {
            if (!J.studioRecoveryPending && !J.ui.exporting)
                J.saveStudioSnapshot();
        }, 15000);
        try {
            const saved = await J.readStudioSnapshot();
            if (saved?.schema !== 1 || !Number.isFinite(saved.time) || !J.studioOn(saved.project, 'autosave')) {
                J.studioRecoveryPending = false;
                schedule();
                return;
            }
            J.uiApi.pause();
            const dialog = el('dialog', null, 'studioRecoveryDialog'), heading = el('h2', tr('前回の編集内容があります', 'Previous editing data is available')), note = el('p', tr('復元すると前回のプロジェクトを開きます。破棄すると空のプロジェクトから始めます。素材は別途読み込んでください。', 'Restore opens the previous project. Discard starts a blank project. Load media files separately.')), feedback = el('p'), restore = el('button', tr('復元', 'Restore'), 'studioRecover'), discard = el('button', tr('破棄', 'Discard'), 'studioDiscard');
            heading.id = 'studioRecoveryHeading';
            dialog.setAttribute('aria-labelledby', heading.id);
            dialog.append(heading, el('p', new Date(saved.time).toLocaleString()), note, restore, discard, feedback);
            document.body.append(dialog);
            dialog.addEventListener('cancel', e => e.preventDefault());
            restore.addEventListener('click', async () => {
                restore.disabled = discard.disabled = true;
                try {
                    await J.restoreStudioFonts(J.normalizeStudio(saved.project.studio).fontFiles);
                    J.studioRecoveryPending = false;
                    J.uiApi.restoreProject(saved.project);
                    await J.saveStudioSnapshot();
                    dialog.close();
                    dialog.remove();
                }
                catch (e) {
                    feedback.textContent = e.message;
                    J.studioRecoveryPending = true;
                    restore.disabled = discard.disabled = false;
                }
            });
            discard.addEventListener('click', async () => {
                restore.disabled = discard.disabled = true;
                try {
                    await J.deleteStudioSnapshot();
                    J.studioRecoveryPending = false;
                    await J.uiApi.resetAll();
                    wasEnabled = false;
                    dialog.close();
                    dialog.remove();
                }
                catch (e) {
                    feedback.textContent = e.message;
                    restore.disabled = discard.disabled = false;
                }
            });
            dialog.showModal();
            restore.focus();
        }
        catch (e) {
            J.studioRecoveryPending = false;
            J.studioRecoveryStatus(e.message);
            schedule();
        }
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot);
    else
        boot();
})();
