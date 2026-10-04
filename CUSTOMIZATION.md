# SYNTHIA Layer Studio Customization

## Original Repository

https://github.com/cityedge/jizura_layer_studio

Reference revision: `4053ec363ff389318b6967bf59ced11a0374feaa` (v1.5.0). History is kept only in the separate local reference checkout; this repository starts independently and is not a GitHub fork.

## Branding

製品名は SYNTHIA Layer Studio、短縮名とヘッダーは SYNTHIA、簡易マークとfaviconは S。
title・description・OGP・日英ガイド・Aboutの製品名を更新。Creditsではhakoniwa氏のJIZURAとcityedge氏のJIZURA Layer Studioへリンクしています。
画面構造・配色・描画・動画処理は参考元を維持しています。

## Source Files Changed

- `README.en.md`
- `README.md`
- `app/body.html`
- `app/english.py`
- `app/guide.en.html`
- `app/guide.ja.html`
- `app/publication.py`
- `build.py`
- `docs/PUBLISHING.en.md`
- `docs/PUBLISHING.md`
- `src/12_ui.js`
- `src/13_layer_ui.js`
- `src/13e_user_themes_ui.js`
- `src/13f_motion_library_ui.js`
- `tools/package_release.py`
- `user_guide.en.md`
- `user_guide.md`
- `.gitignore`（新規）
- `.nojekyll`（新規）
- `CUSTOMIZATION.md`（新規）
- `index.html`・`en/index.html`（ビルド生成）

## Compatibility

JSONのschema、property、version、`jizura-*` format、localStorageキーは保持。
保存名のみ `曲名_project.json` へ変更。曲名なしは `project`。
テーマとモーションライブラリのJSONファイル名のみブランドなしへ変更。
素材はブラウザ内で処理。サーバー、ログイン、DB、素材送信は追加していません。
Google Fontsへの既存接続は保持。

## Build

Python 3.10以降の標準ライブラリのみ。

```text
python build.py
```

公開URLは `app/publication.py` の `SITE_URL` に設定します。`SYNTHIA_SITE_URL` 環境変数で上書き可能。従来の `JIZURA_SITE_URL` も互換性のため受け付けます。未確定時はcanonical・og:urlを出力しません。

## Tests

```text
node dev/layer_test.js
node dev/filler_test.js
node dev/simple_export_test.js
```

関連する `dev/*_test.js` 全件も実行し、ブラウザでSRT、JSON、背景、音源、短時間のMP4ペアと簡易MP4を確認します。MP4はWebCodecs・H.264、音声はAAC対応に依存します。PC版 Chrome / Edge 推奨。

## Release

```text
python tools/package_release.py
```

`dist/SYNTHIA-Layer-Studio-.../` にupload、SHA256SUMS、削除一覧、ZIPとZIPハッシュを生成。削除一覧は参考元旧版用で、新規公開に削除操作は不要です。個人素材・テスト生成物・Git履歴は配布しません。

## Deploy

GitHub Pages: `main / root`。公開先: https://takashige2026.github.io/synthia-layer-studio/ / Repository: https://github.com/takashige2026/synthia-layer-studio

## 今後の更新

1. `app/` または `src/` の編集元を修正します。
2. `python build.py` で日本語版・英語版を再生成します。
3. `node dev/layer_test.js`、`node dev/filler_test.js`、`node dev/simple_export_test.js` と関連テストを実行し、ブラウザでも確認します。
4. `python tools/package_release.py` で配布ZIPを保存します（`dist/`はGit管理対象外）。
5. `git add .` → `git commit -m "fix: describe the change"` → `git push` を実行します。
6. GitHub Pagesが `main / (root)` から自動更新されます。実際の公開URLで再確認します。

Forkではないため、参考元の更新は自動同期されません。必要な変更だけ差分を確認して取り込みます。


## License Notes

`LICENSE`、`THIRD_PARTY_NOTICES.md`、`vendor/` は参考元と同一内容を保持。
Copyright (c) 2026 hakoniwa / Copyright (c) 2026 cityedge を維持。
MediabunnyのMPL-2.0本文、ソース提供情報と未改変の `mediabunny-1.60.0.tgz` を維持します。
ブランド名変更を原作者の変更と混同しないこと。履歴の説明や描画パック内の元JIZURAの表記は保持します。

## Initial Local Validation — 2026-10-04

- Python 3.13 / Node.js 24: build成功、既存15テストファイル・128テスト成功。
- WindowsのPC版ChromeとEdge（Playwrightによるheadless実行）、1600×1000と390×844で表示確認。
- 日英の切り替え、SRT入力、本文・時刻編集、タイムライン、おまかせ、字幕の配色・書体ガチャ、JSON保存・復元を確認。
- 元JIZURA Layer Studioで実際に保存した合成テストJSONを読み込み、字幕・時刻・個別設定の一致を確認。
- 合成PNGと2秒の合成WAV、スペアナ生成、MP4動画背景を確認。
- 2秒・480p・24fpsのペアMP4、フロント単独MP4、タイトル・AAC音声付き簡易MP4を生成し、ブラウザで動画のデコード・再生フレームを確認。
- JavaScript・HTTP・consoleの重大エラーなし。LICENSE・第三者表示・vendorファイルは元ソースとSHA256一致。
- テスト素材・保存JSON・動画・スクリーンショット・検証スクリプトは公開リポジトリに含めていません。
- 長時間・4K出力、別OS、実ユーザー素材、全演出組み合わせの受入確認は未実施です。

## Published Validation — 2026-10-04

GitHub Repository: https://github.com/takashige2026/synthia-layer-studio

Web App: https://takashige2026.github.io/synthia-layer-studio/

- GitHub APIでPublic・非Fork・`main`・Pages `main / root`・`built`を確認。
- 配信URL上でWindowsのChrome・Edgeを使用し、ローカル検証と同じSRT・編集・タイムライン・ガチャ・JSON・画像／動画背景・合成音源・スペアナの操作を確認。
- 公開環境でも2秒・854×480・24fpsのマット＋フロント、フロント単独、タイトル・AAC音声付き簡易MP4を保存し、動画フレームのデコードを確認。
- 日本語・英語・サブディレクトリの言語リンク、Google Fontsのファイル取得、canonical・og:url・og:titleを確認。
- JavaScript、console、HTTPエラーと通信失敗は検出されませんでした。
- テスト素材は合成データのみで、公開リポジトリへアップロードしていません。
