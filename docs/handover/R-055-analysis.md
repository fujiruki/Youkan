# R-055 原因分析: 青年部カレンダー「絆感謝運動」(6/7) 表示漏れ

## 問題のサマリ

ユーザー報告 (2026-06-06):
> 「カレンダー選択で全部選択されてるのに表示されてない予定がある。
>  たとえば青年部のカレンダーの『絆感謝運動』という予定が 6/7 に表示されてない」

## 真因 (一文で)

`GET /google/calendar/events` が `getCachedEvents()` (R-034 Phase 2 の旧キャッシュ参照のみ) を呼ぶため、R-041 で導入した複数カレンダー対応の live fetch (`getEvents()`) が走らず、`external_events_cache` に primary カレンダーの古いレコードしか残らない状態になっていた。

## 各層の状態 (調査結果)

### 1. `user_google_calendars` テーブル (DB → API)

`GET /api/google/calendars` のレスポンスには **6 件すべてのカレンダー** が `is_enabled: true` で返っている。

```json
[
  { "id":1, "calendar_id":"ja.japanese#holiday@group.v.calendar.google.com", "summary":"日本の祝日", "is_enabled":true },
  { "id":2, "calendar_id":"f2bc...@group.calendar.google.com",                  "summary":"青年部商工会",   "is_enabled":true },
  { "id":3, "calendar_id":"family15127774402265934393@group.calendar.google.com","summary":"ファミリー カレンダー", "is_enabled":true },
  { "id":4, "calendar_id":"io850kdrqf5g21ht7ladaaar5c@group.calendar.google.com","summary":"YuiHaruFujita", "is_enabled":true },
  { "id":5, "calendar_id":"door.fujita@gmail.com",                               "summary":"door.fujita@gmail.com", "is_enabled":true },
  { "id":6, "calendar_id":"fjt.suntree@gmail.com",                               "summary":"fjt.suntree@gmail.com", "is_enabled":true }
]
```

→ カレンダー設定は正常。ON/OFF や `user_google_calendars` テーブルの問題ではない。

### 2. `external_events_cache` の中身 (修正前)

`GET /api/google/calendar/events?from=2026-06-01&to=2026-06-30` のレスポンス:

- 10 件のみ
- すべて `calendar_id: "primary"`
- **「絆感謝運動」は含まれない**

→ R-041 後に `POST /google/calendar/refresh` が一度も呼ばれていないため、キャッシュは R-034 Phase 2 時代の primary だけのまま。

### 3. `POST /google/calendar/refresh` を 1 回叩いた直後

- `success: true, count: 197` で正常完了
- 続けて `GET /events` を叩くと、6 カレンダー分が混在 (62 件)
- **「絆感謝運動」(2026-06-07 12:00-13:00) も含まれる** (`calendar_id: f2bc...@group.calendar.google.com`)

→ R-041 新版 `getEvents()` 自体は正しく全カレンダーを取得しキャッシュ更新できる。

## どこで欠落していたか

| 層 | 役割 | 状態 |
| :--- | :--- | :--- |
| Google API | カレンダー側のデータ | 正常 (絆感謝運動 6/7 12:00 存在) |
| `GoogleCalendarService::getEvents()` (R-041) | 全カレンダーから取得 + キャッシュ更新 | 動作するが「呼ばれていない」 |
| `external_events_cache` テーブル | キャッシュ | primary だけしか入っていない |
| `GoogleCalendarController::getEvents()` (GET) | フロントへの応答 | `getCachedEvents()` を呼ぶだけ → 古いキャッシュを返す |
| `useExternalEvents` (フロント) | UI | 受け取った data をそのまま描画 (正常) |

**欠落地点 = `GoogleCalendarController::getEvents()`**

R-041 の設計会議 (`secretary/notes/2026-06-04-会議-R041-R042仕様確定.md`) では「`calendarList.list` は 24h バックグラウンド refresh + ボタン押下時の手動 refresh」と決まっていたが、24h バックグラウンド refresh の実装は無く、設定画面の手動「更新」ボタンを押さない限りキャッシュが古いまま放置される構造になっていた。

## 同型バグの可能性

修正前の状態では `external_events_cache` に primary 以外のカレンダーが入っていないため、「ユーザーが Google で新規作成したカレンダーは、設定画面の手動 refresh ボタンを押さない限り Youkan に永遠に出てこない」という構造的不具合となっていた。

具体的には:
- 青年部商工会カレンダーのすべてのイベント (絆感謝運動 以外も)
- 日本の祝日カレンダーのすべての祝日
- ファミリーカレンダー、YuiHaruFujita カレンダー、door.fujita@gmail.com カレンダーのすべてのイベント

これらが本修正で一気に復活する見込み。

## 修正方針

`GoogleCalendarController::getEvents()` (GET) を次のように改修する:

1. `user_google_oauth.last_sync_at` が `AUTO_SYNC_TTL_SEC` (60 秒) より古い、または `user_google_calendars` にこのユーザーの行が無い場合、`getCalendarList()` → `getEvents()` (R-041 新版) を呼んで自動同期する。
2. 自動同期に失敗した場合は既存キャッシュにフォールバックし、UX を壊さない (Google API ダウン時など)。
3. 60 秒以内の連続呼び出しは従来通り `getCachedEvents()` で DB だけから高速応答する。

これにより:
- 初回連携直後の `GET` で全カレンダーが自動取り込みされる
- 既存ユーザーは次回 `GET` で必ず全カレンダー同期される
- TTL 内の連続呼び出しは DB 応答のみ (高速)
- フロント側の変更は不要 (`useExternalEvents` は月単位 15 分キャッシュなのでサーバへの実通信頻度はそのまま低い)
