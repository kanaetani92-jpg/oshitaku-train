# 1.2ベース復帰・編集プレビュー削除レポート

## 確認結果

- app.js: OK
- data-layer.js: OK
- service-worker.js: OK
- HTML ID重複：なし
- VERSIONが1.2.1：OK
- 保存キー1.2.1：OK
- PWAキャッシュ1.2.1：OK
- HTML参照1.2.1：OK
- 1.2をLEGACY保持：OK
- 編集カード表示プレビュー削除：OK
- 旧プレビュー削除：OK
- CSSでプレビュー非表示補強：OK
- つぎまで原因補正：OK
- totalMinutesがintervalMinutes使用：OK
- autoIndexがintervalMinutes使用：OK
- 船新幹線バス向き修正維持：OK
- でんしゃ上レイヤー維持：OK
- ToDo UI削除維持：OK
- 出発時1始まり維持：OK
- 線路上絵文字のみ維持：OK
- 旧データ時間補正シミュレーション：OK

## 未確認

- PC実ブラウザでの編集画面表示
- iPhone Safari実機
- Android Chrome実機
- 実際の保存データでの `つぎまで` 表示
- Service Workerの実登録
- ホーム画面からの起動
- 長時間利用

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
