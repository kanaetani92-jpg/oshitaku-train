# これからすること削除・時間表示修正

## 原因

前版では、残り時間を表示する `remainingText` が `status-area` の中にありました。

スマホ表示では `status-area` を非表示にしていたため、JavaScript側で残り時間を更新しても、画面上では変化が見えませんでした。

## 修正

大きい絵カード内に、子ども画面用の残り時間表示を追加しました。

```html
<div id="childTimeBox" class="child-time-box">
  <small>ゴールまで</small>
  <strong id="childRemainingText">20:00</strong>
</div>
```

`renderTimeInformation()` で、従来の `remainingText` と新しい `childRemainingText` の両方を更新します。

## 「できた！」での修正

`done()` で次の駅へ進むとき、完了済み駅の累積時間を `elapsedMs` に反映します。

これにより、「できた！」を押した直後にゴールまでの残り時間が減ります。

## 「前の駅にもどる」での修正

`previousStation()` では、戻った駅の開始位置に合わせて `elapsedMs` を戻します。

これにより、「前の駅にもどる」を押した直後にゴールまでの残り時間が戻ります。

## GitHub

GitHubへの反映は行っていません。
