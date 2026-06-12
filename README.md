# おしたくトレイン でんしゃレイヤー修正版 1.1

作成日：2026-06-12

この版では、でんしゃが各駅アイコンの下に隠れず、上に重なって見えるように修正しました。あわせて、To Do削除後に古い `?page=todo` 状態で出発・再開・一時停止が無効化される問題も補正しています。

## 修正内容

- でんしゃ `.vehicle` の `z-index` を駅アイコンより上に変更
- でんしゃの位置を駅アイコンの下側ではなく、線路・駅の上側に見えるよう調整
- `station-dot`、線路、でんしゃのレイヤー順を明確化
- 古いURLやPWA状態で `todo` ページが指定されても、予定画面へ戻す安全処理を追加
- 不要な `todoBackButton` イベント登録を削除
- バージョンを `1.1` に更新
- 保存キーを `oshitakuTrainNoPhotoState1.1` に更新
- PWAキャッシュを `oshitaku-train-pwa-1.1` に更新

## バージョン

`1.1`

## 保存形式

`oshitakuTrainNoPhotoState1.1`

## PWAキャッシュ

`oshitaku-train-pwa-1.1`

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
