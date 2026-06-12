# 横軸タイムライン固定

## 目的

Web版でも、スマホ版と同じくタイムラインを横軸表示に統一しました。

## 修正内容

- タイムライン方向を常に `horizontal` に固定
- 旧設定の `auto` / `vertical` を読み込み時に `horizontal` へ移行
- 設定画面の縦表示選択肢を削除
- `timeline-vertical` クラスが残った場合でも、CSSで横軸として表示
- 車両、進捗バー、駅ドット、駅ラベルを横方向に配置

## 対象

- PC / Web版
- Android Chrome
- iPhone Safari
- iPad / タブレット

## GitHub

GitHubへの反映は行っていません。
