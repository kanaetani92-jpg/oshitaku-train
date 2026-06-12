# おしたくトレイン ゴールまで時間表示削除版

作成日：2026-06-12

この版では、機能としての「ゴールまで」の時間表示を削除しました。

## 修正内容

- 画面上の「ゴールまで」時間表示を削除
- `remainingText` をHTMLから削除
- `timeLabel` をHTMLから削除
- `childTimeBox` / `childRemainingText` をHTMLから削除
- `renderTimeInformation()` から時間表示の更新処理を削除
- 古いHTMLやPWAキャッシュが混ざった場合に備えて、CSSでも時間表示を非表示
- 内部の時間計算は、タイマー・できた・前の駅にもどるの動作用として維持
- 保存形式とPWAキャッシュをV39へ更新

## 保存形式

`oshitakuTrainNoPhotoStateV39`

## PWAキャッシュ

`oshitaku-train-pwa-v39`

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
