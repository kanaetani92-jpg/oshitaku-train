# completion ゴール文言削除

## 目的

画面に残っていた次の表示を削除しました。

```html
<section class="completion hidden" role="status">🎉 ゴールです。よくできました！</section>
```

## 削除内容

- `completion` 要素
- 「🎉 ゴールです。よくできました！」文言
- completion の表示切替処理
- スマホgridの `completion` 行

## 補強

古いHTMLやPWAキャッシュが混ざった場合にも表示されないように、CSSで `.completion` を非表示にしています。

## GitHub

GitHubへの反映は行っていません。
