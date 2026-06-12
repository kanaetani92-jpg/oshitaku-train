# おしたくトレイン Android・iPhoneスマホ配置統一版

作成日：2026-06-12

この版では、Android Chrome と iPhone Safari で子ども画面の配置が同じになるよう、スマホ共通レイアウトを整理しました。

## 実施内容

- 起動時の `initAccountAuthUi()` エラーを削除
- iPhone/Androidを端末判定せず、`max-width: 640px` のスマホ共通CSSへ統一
- スマホ子ども画面をCSS Gridで固定
- 表示順を次に統一

1. 大きい絵カード
2. できた！
3. 前の駅にもどる
4. タイムライン
5. タイマー操作
6. これからすること

## 削除・非表示

- 進捗パネル `metrics`
- `いま`
- `つぎまで`
- 進捗ラベルとしての `できた`
- 大きい絵カード内の `いますること` ラベル

`できた！` ボタンは必要な操作として残しています。

## 保存形式

`oshitakuTrainNoPhotoStateV32`

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
