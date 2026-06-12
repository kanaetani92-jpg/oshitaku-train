# 最終修正版メモ

## 「これからすること」の削除

HTMLから `upcoming-section` と `upcomingCards` を削除し、設定画面の `showUpcomingToggle` も削除しました。

CSSでも、古いHTMLが混ざった場合に備えて非表示にしています。

## 時間表示の修正

子ども画面の大きい絵カード内に `childRemainingText` を追加しました。

`renderTimeInformation()` で、次の2つを同時に更新します。

- `remainingText`
- `childRemainingText`

## 「できた！」時の処理

`done()` で、完了済み駅までの累積時間を `elapsedMs` へ反映します。

## 「前の駅にもどる」時の処理

`previousStation()` で、戻った駅の開始位置に `elapsedMs` を戻します。

## キャッシュ対策

V36へ更新し、古いPWAキャッシュと混ざりにくくしています。
