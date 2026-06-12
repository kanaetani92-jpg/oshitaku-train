# おしたくトレイン 横軸タイムライン固定版

作成日：2026-06-12

この版では、Web版・スマホ版ともに、タイムラインを横軸表示へ固定しました。

## 実施内容

- `effectiveTimelineMode()` を常に `horizontal` に変更
- 旧保存データで `auto` や `vertical` が残っていても横軸へ移行
- 設定画面から縦表示の選択肢を削除
- CSSで `timeline-vertical` が残っても横軸表示になるよう上書き
- PWAキャッシュと保存形式をV33へ更新

## 表示方針

- PC / Web版：横軸タイムライン
- Android：横軸タイムライン
- iPhone：横軸タイムライン
- タブレット：横軸タイムライン

## 保存形式

`oshitakuTrainNoPhotoStateV33`

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
