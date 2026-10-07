(() => {
    'use strict';
    function boot() {
        const el = J.studioElement, tr = J.layerText, root = J.studioSection('advancedFont', 'フォントファイル読込', 'Import font files'), file = el('input', null, 'studioFontFile');
        file.type = 'file';
        file.accept = '.ttf,.otf,.woff,.woff2';
        const label = el('label', tr('フォントを選択 / ここへドロップ', 'Choose a font / drop here'));
        label.className = 'studio-font-drop';
        label.append(file);
        root.append(label);
        const status = el('p', null, 'studioFontStatus');
        status.setAttribute('role', 'status');
        root.append(status, el('p', tr('追加したフォント本体はプロジェクトJSONに含まれます。最大8書体・各8MB・合計約18MB。既存の「PCのフォントから選ぶ」も引き続き使えます。', 'Imported font data is embedded in project JSON. Up to 8 fonts, 8 MB each, about 18 MB total. The installed PC font picker remains available.')));
        let busy = false;
        const load = async (f) => {
            if (!f || busy || J.ui.exporting || J.layerSession.busy)
                return;
            busy = true;
            file.disabled = true;
            try {
                const added = await J.importStudioFont(f, J.ui.project);
                status.textContent = added ? added.label + ' ✓' : '';
            }
            catch (e) {
                status.textContent = e.message;
                J.uiApi.toast(e.message);
            }
            finally {
                busy = false;
                file.disabled = false;
                file.value = '';
            }
        };
        file.addEventListener('change', () => load(file.files?.[0]));
        label.addEventListener('dragover', e => e.preventDefault());
        label.addEventListener('drop', e => { e.preventDefault(); load(e.dataTransfer.files[0]); });
        J.syncLayerUI();
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot);
    else
        boot();
})();
