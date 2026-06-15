# 子ども画面の絵カードサイズ反映修正

## 修正した内容

設定画面の「絵カードサイズ」を「標準」と「大きい」で切り替えたとき、編集画面だけでなく子ども画面にも反映されるようにしました。

## 原因

編集画面では `html[data-card-size="large"] .current-card` の指定が効いていましたが、子ども画面では `body.view-mode #currentCard` や `body.view-mode #currentIcon` の指定が強く、絵カードサイズ設定を上書きしていました。

## 対応内容

子ども画面専用に、次の指定を追加しました。

- `html[data-card-size="standard"] body.view-mode #currentCard`
- `html[data-card-size="large"] body.view-mode #currentCard`
- `html[data-card-size="standard"] body.view-mode #currentIcon`
- `html[data-card-size="large"] body.view-mode #currentIcon`
- `html[data-card-size="standard"] body.view-mode #currentName`
- `html[data-card-size="large"] body.view-mode #currentName`

## 期待される結果

- 絵カードサイズ「標準」：子ども画面も標準サイズで表示
- 絵カードサイズ「大きい」：子ども画面も大きいサイズで表示
- 編集画面だけでなく、実際に使う子ども画面にも設定が反映される
