/* Pending ballad settings: only an explicit generation changes the draw. */
(() => {
  'use strict';
  function boot() {
    const B = J.BalladMotionEngine, A = J.ballad, boxes = [];
    const language = document.documentElement.lang;
    const labels = {
      ja: ['静かな', '感動系', 'ドラマチック', '演出の強さ', '楽曲の盛り上がりに追従', '詳細設定', '動きを抑える（書き出しにも適用）', '演出を再抽選', '設定は次のおまかせ・再抽選で反映します。'],
      en: ['Quiet', 'Emotional', 'Dramatic', 'Motion strength', 'Follow song energy', 'Advanced settings', 'Reduce motion (also in exports)', 'Reroll motion', 'Settings apply on the next auto generation or reroll.'],
      'zh-Hant': ['安靜', '感動', '戲劇性', '演出強度', '跟隨音樂能量', '進階設定', '減少動作（也適用匯出）', '重新抽選演出', '設定於下次自動生成或重新抽選時套用。'],
      'zh-Hans': ['安静', '感动', '戏剧性', '演出强度', '跟随音乐能量', '高级设置', '减少动作（也适用于导出）', '重新抽选演出', '设置于下次自动生成或重新抽选时应用。'],
      ko: ['조용한', '감성적', '극적인', '연출 강도', '음악 에너지 따라가기', '고급 설정', '동작 줄이기 (내보내기 포함)', '연출 다시 선택', '다음 자동 생성 또는 다시 선택 시 적용됩니다.'],
      'id-ID': ['Tenang', 'Emosional', 'Dramatis', 'Kekuatan gerakan', 'Ikuti energi lagu', 'Pengaturan lanjutan', 'Kurangi gerakan (termasuk ekspor)', 'Acak ulang gerakan', 'Pengaturan diterapkan saat membuat atau mengacak ulang.'],
      vi: ['Yên tĩnh', 'Cảm xúc', 'Kịch tính', 'Cường độ chuyển động', 'Theo năng lượng bài hát', 'Cài đặt nâng cao', 'Giảm chuyển động (kể cả xuất)', 'Chọn lại chuyển động', 'Áp dụng khi tạo tự động hoặc chọn lại lần tiếp theo.'],
    }[language] || ['Quiet', 'Emotional', 'Dramatic', 'Motion strength', 'Follow song energy', 'Advanced settings', 'Reduce motion (also in exports)', 'Reroll motion', 'Settings apply on the next auto generation or reroll.'];
    const create = (tag, text) => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };
    const selectors = A.layer ? document.querySelectorAll('#omakaseTheme,#omakaseThemeEasy') : document.querySelectorAll('.themeSel');
    for (const sel of selectors) {
      const box = create('div'); box.className = 'ballad-settings';
      const preset = create('select'); preset.className = 'ballad-preset'; preset.setAttribute('aria-label', language === 'ja' ? 'バラードプリセット' : 'Ballad preset');
      ['quiet', 'emotional', 'dramatic'].forEach((key, i) => { const option = create('option', labels[i]); option.value = key; preset.append(option); });
      const strengthLabel = create('label', labels[3] + ' '), strength = create('input'), output = create('output');
      strength.type = 'range'; strength.min = '0'; strength.max = '100'; strength.className = 'ballad-strength'; strength.setAttribute('aria-label', labels[3]); strengthLabel.append(strength, output);
      const detail = create('details'), summary = create('summary', labels[5]), reducedLabel = create('label', labels[6]), reduced = create('input');
      reduced.type = 'checkbox'; reduced.className = 'ballad-reduced'; reducedLabel.prepend(reduced); detail.append(summary, reducedLabel);
      let follow;
      if (A.layer) { const followLabel = create('label', labels[4]); follow = create('input'); follow.type = 'checkbox'; follow.className = 'ballad-follow'; followLabel.prepend(follow); box.append(followLabel); }
      const reroll = create('button', labels[7]); reroll.type = 'button'; reroll.className = 'ghost small ballad-reroll';
      box.prepend(preset, strengthLabel); box.append(detail, reroll, create('p', labels[8]));
      sel.parentElement.insertAdjacentElement('afterend', box);
      const update = patch => {
        if (J.ui.exporting) return;
        J.uiApi.balladRemember();
        const old = A.dataOf(J.ui.project), data = { ...old, ...B.settings(old), recipes: old?.recipes || {}, ...patch };
        A.write(J.ui.project, data); J.uiApi.flushSave(); J.syncBalladUI();
      };
      preset.addEventListener('change', () => update({ preset: preset.value, strength: B.presets[preset.value].strength }));
      strength.addEventListener('input', () => { output.value = strength.value + '%'; });
      strength.addEventListener('change', () => update({ strength: +strength.value }));
      reduced.addEventListener('change', () => update({ reduceMotion: reduced.checked }));
      follow?.addEventListener('change', () => update({ followEnergy: follow.checked }));
      reroll.addEventListener('click', () => J.uiApi.balladReroll());
      sel.addEventListener('change', () => J.syncBalladUI());
      boxes.push({ box, sel, preset, strength, output, follow, reduced });
    }
    J.syncBalladUI = () => {
      const p = J.ui.project, s = B.settings(A.dataOf(p));
      const visible = boxes.find(b => b.sel.getClientRects().length && getComputedStyle(b.sel).visibility !== 'hidden');
      for (const { box, sel, preset, strength, output, follow, reduced } of boxes) {
        box.hidden = A.themeOf(p) !== 'ballad' || sel !== visible?.sel; preset.value = s.preset; strength.value = String(s.strength); output.value = s.strength + '%'; reduced.checked = s.reduceMotion; if (follow) follow.checked = s.followEnergy;
      }
    };
    J.syncBalladUI();
    document.querySelectorAll('#modePro,#modeEasy,#modeMobile').forEach(e => e.addEventListener('click', () => J.syncBalladUI()));
    window.addEventListener('resize', () => J.syncBalladUI());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
