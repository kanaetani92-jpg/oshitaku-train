# Android・iPhoneスマホ配置統一 修正レポート

## 確認結果

- app.js: OK
- data-layer.js: OK
- service-worker.js: OK
- HTML ID重複：なし
- initAccountAuthUi呼び出し削除：OK
- 未定義accountページ初期値削除：OK
- metricsセクション削除：OK
- nowMetric削除：OK
- nextMetric削除：OK
- percentMetric削除：OK
- 大きい絵カード内のいますること削除：OK
- スマホ共通Gridあり：OK
- Android/iPhone共通CSSあり：OK
- status-areaをスマホで非表示：OK
- currentCardが1番目：OK
- actionRowが2番目：OK
- doneBtnが前の駅より先：OK
- trackWrapがtimer前：OK
- 保存形式V32：OK
- PWA V32：OK
- HTML参照V32：OK

## 未確認

- iPhone Safari実機
- Android Chrome実機
- Service Workerの実登録
- ホーム画面からの起動
- 長時間利用

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
