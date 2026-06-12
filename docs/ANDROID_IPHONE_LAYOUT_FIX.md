# Android・iPhoneスマホ配置統一

## 目的

Android版とiPhone版で、子ども画面の配置が同じになるように修正しました。

端末判定は使わず、スマートフォン幅では共通のCSS Gridレイアウトを適用します。

## スマホ版の表示順

1. 大きい絵カード
2. できた！
3. 前の駅にもどる
4. タイムライン
5. タイマー操作
6. これからすること

## 主な修正

- `body.view-mode .main-card` をスマホ幅でGrid化
- `grid-template-areas` で表示順を固定
- Android Chromeのアドレスバー変動に備えて `100svh` / `100dvh` を使用
- 横はみ出し防止のため `min-width: 0` と `overflow-x: hidden` を追加
- Androidの標準ボタン差を減らすため `appearance: none` と `touch-action: manipulation` を追加
- `initAccountAuthUi()` の未定義エラーを削除

## 削除・非表示

- `metrics` セクション
- `いま`
- `つぎまで`
- 進捗表示の `できた`
- 大きい絵カード内の `いますること` ラベル

## GitHub

GitHubへの反映は行っていません。
