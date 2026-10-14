# Ballad Motion Engine v1.0

バラードの「おまかせ」を、穏やかな字幕演出に揃えるブラウザ内エンジンです。設定しただけでは現在の字幕を変えません。

1. テーマで「バラード」を選択します。
2. 静かな（25%）／感動系（35%）／ドラマチック（55%）を選び、演出の強さを調整します。
3. 「おまかせ」または「演出を再抽選」を押します。字幕ごとの変更にも同じルールを適用します。
4. 必要なら詳細設定の「動きを抑える」を選び、再生成します。この設定はJSONと出力にも保存されます。

Soft Fade、Gentle Float、Light Trace、Emotional Bloomと、専用の読みやすい中央配置を追加しました。短い字幕と長文は静止・フェードを優先し、登場と退場の合計を表示時間の半分以下に抑えます。

「楽曲の盛り上がりに追従」は読み込み済み音源のエネルギーを利用します。Music Autoは音源なしでも動きます。バラードでは解析の自動実行とBeat Snapによる時刻変更を行いません。手動Verse／Chorus等の区間だけを参照し、自動解析区間を確定サビとして扱いません。

Design Autoはデザインと動き、Music Autoは現在のデザインを残した動き、Full Autoはその両方を変更します。手動指定、ロック、手動モーション行、文字編集、間奏FX、映像解析の設定は優先・保持します。既存の間奏FXと解析を勝手にONにしません。

保存先は`studio.balladMotion`です。設定・seed・生成済みレシピ・カット構造・音源なしでの時刻再現用データを保存します。旧プロジェクトを読み込んだだけでは演出を変更しません。手動追加のグリッチや揺れも削除しません。

## English

Select **Ballad**, choose Quiet / Emotional / Dramatic, then press Auto-compose or Reroll motion. Settings remain pending until an explicit draw. Existing subtitle timing, manual edits, locks and Instrumental FX are preserved. Music Auto uses existing energy data; no analysis starts automatically. Reduce motion is persisted for preview and exports.

## Development

The identical pure JS core is `src/08a_ballad_core.js`. The Canvas/editor adapter is `src/11zzzzzzzzzz_ballad.js`; settings UI is `src/13z_ballad_ui.js`.

```text
node dev/ballad_test.js
python build.py
python tools/sync_ballad_core.py ../synthia-lyrics-studio-ballad-20261014 --check
```

The engine is local, deterministic and does not require an API, server or account. AE uses the existing browser-export fallback contract; exact rendering of the new expressions is verified for browser MP4/PNG, not native After Effects.
