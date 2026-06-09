# 3モード共通時間計算仕様

## 位置づけ

3モード化の第4段階として、これまで複数の関数に分散していた時間計算を、モードに依存しない共通エンジンへ整理します。

対象モード：

- `timer`：できた！タイマー
- `auto`：自動タイマー
- `clock`：時計にあわせる

第4段階では計算基盤を整えます。自動タイマーの開始・一時停止・自動進行を画面から利用できるようにする処理は、次の段階以降で実装します。

## 1. モードの時間型

3モードを、次の2つの時間型へ分類します。

| モード | 時間型 | 基準 |
|---|---|---|
| できた！タイマー | `duration` | 開始後の経過時間と所要時間 |
| 自動タイマー | `duration` | 開始後の経過時間と所要時間 |
| 時計にあわせる | `clock` | 端末の現在時刻と開始・終了時刻 |

`timer` と `auto` は同じ駅間所要時間を使用します。ただし、次の駅へ進む条件は異なります。

- `timer`：利用者が「できた！」を押して進む
- `auto`：所要時間が過ぎると自動的に進む

## 2. 共通計算モジュール

追加ファイル：

```text
three-mode-time.js
```

このファイルは画面や保存処理に依存しない純粋な計算モジュールです。ブラウザでは `window.TrainThreeModeTime`、Node.jsでは `require()` から利用できます。

## 3. 所要時間型スケジュール

`buildDurationSchedule(stations)` を使用します。

駅データの `intervalMin` を累積し、すべての駅へ次の値を付与します。

```javascript
{
  markerOffset,
  arriveOffset,
  departOffset,
  durationBeforeMin,
  durationToNextMin
}
```

例：

```text
スタート → 5分 → きがえ → 10分 → ごはん → 3分 → ゴール
```

計算結果：

```text
駅位置：0分、5分、15分、18分
合計：18分
```

同じ計算結果を、できた！タイマーと自動タイマーの両方で使用します。

## 4. 実時刻型スケジュール

`buildClockSchedule(stations)` を使用します。

各駅の `arrive` と `depart` を分へ変換し、最初の出発時刻を0として相対位置を計算します。

付与する主な値：

```javascript
{
  arriveAbs,
  departAbs,
  markerAbs,
  arriveOffset,
  departOffset,
  markerOffset
}
```

## 5. 日付をまたぐ予定

23時台から翌日の0時台へ続く予定を、同じ時系列として扱います。

例：

```text
23:50 開始
00:10 休憩
00:40 終了
```

内部では次のように計算します。

```text
1430分 → 1450分 → 1480分
```

合計時間は50分です。

## 6. モード別経過時間

### できた！タイマー

```javascript
durationElapsedMs({
  running,
  startedAt,
  pausedElapsedMs,
  totalMs,
  nowMs
})
```

既存の次の状態を使用します。

- `running`
- `timerStartedAt`
- `pausedElapsedMs`

### 自動タイマー

```javascript
autoElapsedMs({
  autoRunning,
  autoStartedAt,
  autoPausedElapsedMs,
  totalMs,
  nowMs
})
```

第2段階で追加した次の状態を使用します。

- `autoRunning`
- `autoStartedAt`
- `autoPausedElapsedMs`

第4段階では計算APIを提供しますが、画面の開始操作とはまだ接続しません。

### 時計にあわせる

```javascript
clockElapsedMs(schedule, now)
```

端末の現在時刻から、予定開始後の経過時間を計算します。

## 7. 現在位置の共通形式

所要時間型と実時刻型の両方で、次の形式を返します。

```javascript
{
  pos,
  status,
  stationIndex,
  nextIndex,
  activeIndex,
  nextAt,
  nextType
}
```

主な `status`：

- `waiting`：開始前または出発待ち
- `run`：次の駅へ進行中
- `stop`：駅の予定時間内
- `goal`：最後まで終了

## 8. 一括計算API

```javascript
progressSnapshot(mode, stations, runtime, now)
```

次の値をまとめて返します。

```javascript
{
  mode,
  kind,
  schedule,
  elapsedMs,
  elapsedMin,
  percent,
  vehicle,
  reachedIndex
}
```

次段階の自動タイマーは、このAPIを使用して現在の駅、次の駅、残り時間および終了状態を判定できます。

## 9. 既存アプリとの接続

追加ファイル：

```text
three-mode-time-adapter.js
```

アダプターは起動時に、共通エンジンと従来計算の結果を比較します。

比較対象：

- 合計時間
- 開始・終了位置
- 駅数
- 駅名
- 各駅の到着・出発・表示位置

結果が一致した計算だけを有効化します。不一致または例外が発生した場合は、従来の計算へ自動的に戻ります。

このため、第四段階の変更で既存モードが動かなくなることを防ぎます。

診断結果は次から確認できます。

```javascript
window.TrainThreeModeTimeAdapter.diagnostics
```

## 10. 読み込み順

`three-mode-ui.js` から、次の順に読み込みます。

```text
three-mode-time.js
↓
three-mode-time-adapter.js
```

読み込みに失敗した場合は、既存の時間計算を継続します。

## 11. テスト

追加ファイル：

```text
tests/three-mode-time.test.js
```

確認項目：

- `timer` と `auto` が所要時間型になる
- `clock` が実時刻型になる
- 駅間所要時間の累積
- 実時刻の相対位置
- 24時をまたぐ予定
- タイマーの経過時間
- 自動タイマーの経過時間
- 所要時間型の車両位置
- 実時刻型の停車・移動位置
- 自動タイマーの進捗スナップショット

実行方法：

```bash
node tests/three-mode-time.test.js
```

## 12. 第4段階の完了条件

- 3モードを2種類の時間型に分類できる
- `timer` と `auto` が同じ所要時間スケジュールを使用できる
- `clock` が実時刻スケジュールを使用できる
- 日付をまたぐ時刻を計算できる
- 3モードの経過時間を同じAPIから計算できる
- 現在位置を共通形式で取得できる
- 共通計算と従来計算の一致を起動時に検証できる
- 不一致時に従来計算へ戻れる
- 自動テストが通る

## 13. 第4段階では行わないこと

- 自動タイマーを開始可能にする
- 自動タイマーの一時停止・再開
- 自動タイマーの画面表示切替
- 時間経過による自動的な駅移動の利用開始
- 自動タイマーの終了表示
- 「できた！」ボタンのモード別表示

これらは第5段階以降で実装します。
