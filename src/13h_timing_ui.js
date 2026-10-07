(() => {
    'use strict';
    const tr = J.layerText, el = J.studioElement, button = J.studioButton;
    function boot() {
        const root = J.studioSection('lyricsTiming', '歌詞・タイミング / SRT / LRC', 'Lyrics / timing / SRT / LRC');
        const paste = el('textarea', null, 'studioLyricsPaste');
        paste.rows = 5;
        paste.setAttribute('aria-label', tr('貼り付ける歌詞', 'Lyrics to paste'));
        paste.placeholder = tr('歌詞を1行ずつ貼り付け', 'Paste one lyric per line');
        const label = el('label', tr('空行', 'Blank lines')), blanks = el('select', null, 'studioBlankLines');
        for (const [value, ja, en] of [['skip', '区切りとして扱う', 'Treat as a section break'], ['keep', '間奏として残す', 'Keep as an interlude']]) {
            const o = el('option', tr(ja, en));
            o.value = value;
            blanks.append(o);
        }
        label.append(blanks);
        root.append(paste, label);
        root.append(button('studioPasteApply', '歌詞を適用（Tap Sync用）', 'Apply lyrics (for Tap Sync)', () => {
            if (J.ui.tap)
                J.uiApi.stopTap();
            if (!paste.value.trim())
                throw new Error(tr('歌詞を入力してください。', 'Enter lyrics.'));
            J.uiApi.pushEdit();
            const p = J.ui.project;
            p.studio.blankLines = blanks.value === 'keep' ? 'keep' : 'skip';
            p.lyrics = J.studioPasteLyrics(paste.value, blanks.value === 'keep');
            delete p.subtitleCues;
            p.overrides = {};
            p.localLooks = null;
            p.timing.lineTimes = {};
            p.exportRange = null;
            J.studioChanged();
        }));
        const fileLabel = el('label', tr('LRCを読み込む', 'Import LRC')), file = el('input', null, 'studioLRCFile');
        file.type = 'file';
        file.accept = '.lrc,text/plain';
        fileLabel.className = 'file';
        fileLabel.append(file);
        root.append(fileLabel);
        file.addEventListener('change', async () => {
            const f = file.files?.[0];
            if (!f)
                return;
            const epoch = J.projectSessionEpoch;
            try {
                const cues = J.studioParseLRC(await f.text(), J.ui.audio?.duration || 0, J.ui.project.studio.tapGap);
                if (epoch !== J.projectSessionEpoch)
                    return;
                if (J.ui.tap)
                    J.uiApi.stopTap();
                J.uiApi.pushEdit();
                Object.assign(J.ui.project, { subtitleCues: cues, lyrics: cues.map(c => c.text).join('\n\n'), overrides: {}, localLooks: null, exportRange: null });
                J.ui.project.timing.lineTimes = {};
                J.studioChanged();
            }
            catch (error) {
                J.uiApi.toast(error.message);
            }
            finally {
                file.value = '';
            }
        });
        const cues = () => J.ui.project.subtitleCues || J.studioPlanCues(J.ui.plan), name = () => ((J.ui.project.title || 'lyrics').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'lyrics');
        root.append(button('studioExportSRT', 'SRTを保存', 'Save SRT', () => J.saveFile(name() + '.srt', J.studioSRT(cues()))), button('studioExportLRC', 'LRCを保存', 'Save LRC', () => J.saveFile(name() + '.lrc', J.studioLRC(cues()))));
        root.append(button('studioTimingEdit', '現在の歌詞を字幕時刻編集へ', 'Edit current lyrics as timed cues', () => {
            if (Array.isArray(J.ui.project.subtitleCues))
                return;
            const next = J.studioPlanCues(J.ui.plan);
            J.uiApi.pushEdit();
            J.ui.project.subtitleCues = next;
            J.studioChanged();
            J.editLayerCueText(0);
        }));
        root.append(el('p', tr('SRTの開始・終了はそのまま保存します。文字なしの字幕はSRT出力で省略します。LRCは開始時刻のみの形式です。複数行本文は1行にまとめ、読込時の終了は次行または音源長から補完します。空行を間奏にした歌詞は文字を描画しません。', 'SRT preserves start/end times; empty cues are omitted. LRC stores starts only and combines multiline text. Imported ends use the next start or audio duration. Blank interludes draw no lyric text.')));
        J.syncLayerUI();
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot);
    else
        boot();
})();
