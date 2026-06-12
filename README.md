# おしたくトレイン タイムライン→タイマー操作順修正版

作成日：2026-06-12

この版では、PC版・スマホ版ともに、タイムラインがタイマー操作より上に来るように表示順を明示しました。

## 修正内容

- PC版で `タイムライン → タイマー操作` の順番になるようCSSで明示
- スマホ版で `カード → できた！ → タイムライン → タイマー操作` の順番になるようCSSで明示
- `.track-wrap` を `order: 30`
- `#viewTimerControls` を `order: 40`
- DOM順も `actionRow → track-wrap → viewTimerControls` になるよう補正
- ゴールまで時間表示の削除、絵文字UI、駅間時間補正は維持
- 保存形式とPWAキャッシュをV41へ更新

## 保存形式

`oshitakuTrainNoPhotoStateV41`

## PWAキャッシュ

`oshitaku-train-pwa-v41`

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
