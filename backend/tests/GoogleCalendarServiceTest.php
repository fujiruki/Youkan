<?php
// backend/tests/GoogleCalendarServiceTest.php
// R-034 Phase 2: GoogleCalendarService の単体テスト
//   - HTTP は注入可能なクライアントで mock
//   - DB は in-memory SQLite を用意して暗号化往復まで通す
require_once __DIR__ . '/../services/CryptoService.php';
require_once __DIR__ . '/../services/GoogleCalendarService.php';
require_once __DIR__ . '/helpers/FakeHttpClient.php';

class GoogleCalendarServiceTest {
    private PDO $pdo;
    private CryptoService $crypto;
    private FakeHttpClient $http;
    private GoogleCalendarService $service;
    private array $config;

    public function __construct() {
        // In-memory SQLite
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->exec("
            CREATE TABLE user_google_oauth (
                user_id TEXT PRIMARY KEY,
                encrypted_refresh_token BLOB NOT NULL,
                primary_calendar_email TEXT,
                primary_calendar_id TEXT,
                last_sync_at INTEGER,
                created_at INTEGER NOT NULL
            )
        ");
        $this->pdo->exec("
            CREATE TABLE external_events_cache (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                calendar_id TEXT NOT NULL,
                event_id TEXT NOT NULL,
                start_at INTEGER NOT NULL,
                end_at INTEGER NOT NULL,
                all_day INTEGER NOT NULL DEFAULT 0,
                title TEXT,
                location TEXT,
                fetched_at INTEGER NOT NULL
            )
        ");
        // [R-041] 複数 Google カレンダー対応用テーブル
        $this->pdo->exec("
            CREATE TABLE user_google_calendars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                calendar_id TEXT NOT NULL,
                summary TEXT,
                description TEXT,
                color_hex TEXT,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0,
                last_synced_at INTEGER,
                deleted_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(user_id, calendar_id)
            )
        ");

        $this->crypto = new CryptoService(str_repeat('a1b2', 16));
        $this->http = new FakeHttpClient();
        $this->config = [
            'client_id' => 'fake-client-id.apps.googleusercontent.com',
            'client_secret' => 'fake-secret',
            'redirect_uri' => 'http://localhost:8000/api/google/oauth/callback',
        ];
        $this->service = new GoogleCalendarService(
            $this->pdo,
            $this->crypto,
            $this->config,
            $this->http
        );
    }

    public function run(): void {
        echo "Running GoogleCalendarService Tests...\n";
        $this->testGetAuthorizationUrl();
        $this->testExchangeCodeForTokens();
        $this->testRefreshAccessToken();
        $this->testFetchEvents();
        $this->testRevoke();
        // [R-041] 複数 Google カレンダー対応
        $this->testGetCalendarListUpsertsRows();
        $this->testGetCalendarListLogicallyDeletesMissing();
        $this->testGetEventsParallelMultiCalendar();
        $this->testGetEventsRespectsIsEnabled();
        $this->testGetEventsCacheKeyPerCalendar();
        $this->testUpdateCalendarEnabled();
        echo "All tests passed!\n";
    }

    private function testGetAuthorizationUrl(): void {
        echo "  [Test] getAuthorizationUrl...";
        $url = $this->service->getAuthorizationUrl('state-abc');
        assert(strpos($url, 'https://accounts.google.com/o/oauth2/v2/auth') === 0, "wrong base url: $url");
        assert(strpos($url, 'client_id=' . urlencode($this->config['client_id'])) !== false, "client_id missing");
        assert(strpos($url, 'scope=' . urlencode('https://www.googleapis.com/auth/calendar.readonly')) !== false, "scope missing");
        assert(strpos($url, 'access_type=offline') !== false, "access_type missing");
        assert(strpos($url, 'prompt=consent') !== false, "prompt=consent missing");
        assert(strpos($url, 'state=state-abc') !== false, "state missing");
        echo " OK\n";
    }

    private function testExchangeCodeForTokens(): void {
        echo "  [Test] exchangeCodeForTokens stores encrypted refresh token...";
        $this->http->enqueue(200, [
            'access_token' => 'ya29.fake_access',
            'refresh_token' => '1//fake_refresh',
            'expires_in' => 3600,
            'token_type' => 'Bearer',
        ]);
        // userinfo + calendarList を順に積む
        $this->http->enqueue(200, [
            'email' => 'haruki@example.com',
        ]);
        $this->http->enqueue(200, [
            'id' => 'haruki@example.com',
            'summary' => 'haruki@example.com',
        ]);

        $result = $this->service->exchangeCodeForTokens('user-1', 'auth-code-xyz');

        assert($result['email'] === 'haruki@example.com', "email mismatch: " . ($result['email'] ?? 'null'));
        assert($result['calendar_id'] === 'primary', "calendar_id mismatch");

        // DB に暗号化保存されているか確認
        $row = $this->pdo->query("SELECT * FROM user_google_oauth WHERE user_id='user-1'")->fetch(PDO::FETCH_ASSOC);
        assert($row !== false, "row not inserted");
        assert($row['primary_calendar_email'] === 'haruki@example.com', "email not saved");
        $decrypted = $this->crypto->decrypt($row['encrypted_refresh_token']);
        assert($decrypted === '1//fake_refresh', "refresh token roundtrip failed: $decrypted");

        // POST 先と body の確認
        $tokenCall = $this->http->calls[0];
        assert($tokenCall['url'] === 'https://oauth2.googleapis.com/token', "wrong token endpoint");
        assert($tokenCall['method'] === 'POST');
        assert(strpos($tokenCall['options']['body'], 'code=auth-code-xyz') !== false, "code missing in body");
        assert(strpos($tokenCall['options']['body'], 'grant_type=authorization_code') !== false);
        echo " OK\n";
    }

    private function testRefreshAccessToken(): void {
        echo "  [Test] refreshAccessToken...";
        // 事前にトークンを暗号化保存
        $this->pdo->prepare("INSERT INTO user_google_oauth (user_id, encrypted_refresh_token, created_at) VALUES (?, ?, ?)")
            ->execute(['user-refresh', $this->crypto->encrypt('1//stored_refresh'), time()]);

        $this->http->enqueue(200, [
            'access_token' => 'ya29.new_access',
            'expires_in' => 3600,
            'token_type' => 'Bearer',
        ]);

        $accessToken = $this->service->refreshAccessToken('user-refresh');
        assert($accessToken === 'ya29.new_access', "access token mismatch: $accessToken");

        // 直近の呼び出し body に refresh_token が含まれているか
        $lastCall = end($this->http->calls);
        assert(strpos($lastCall['options']['body'], 'refresh_token=' . urlencode('1//stored_refresh')) !== false, "refresh_token missing");
        assert(strpos($lastCall['options']['body'], 'grant_type=refresh_token') !== false);
        echo " OK\n";
    }

    private function testFetchEvents(): void {
        echo "  [Test] fetchEvents normalizes timed & all-day events...";
        $this->pdo->prepare("INSERT INTO user_google_oauth (user_id, encrypted_refresh_token, primary_calendar_id, created_at) VALUES (?, ?, 'primary', ?)")
            ->execute(['user-fetch', $this->crypto->encrypt('1//rt'), time()]);

        // refresh (access token) → events.list の順
        $this->http->enqueue(200, [
            'access_token' => 'ya29.ok',
            'expires_in' => 3600,
            'token_type' => 'Bearer',
        ]);
        $this->http->enqueue(200, [
            'items' => [
                [
                    'id' => 'evt_timed',
                    'summary' => '会議',
                    'location' => 'Zoom',
                    'start' => ['dateTime' => '2026-06-02T10:00:00+09:00'],
                    'end' => ['dateTime' => '2026-06-02T11:00:00+09:00'],
                    'htmlLink' => 'https://calendar.google.com/event?eid=abc',
                ],
                [
                    'id' => 'evt_allday',
                    'summary' => '誕生日',
                    'start' => ['date' => '2026-06-03'],
                    'end' => ['date' => '2026-06-04'],
                ],
                [
                    // status=cancelled は除外される想定
                    'id' => 'evt_cancelled',
                    'status' => 'cancelled',
                ],
            ],
        ]);

        $from = strtotime('2026-06-01');
        $to = strtotime('2026-06-30');
        $events = $this->service->fetchEvents('user-fetch', $from, $to);

        assert(count($events) === 2, "expected 2 events (cancelled excluded), got " . count($events));
        $byId = [];
        foreach ($events as $e) { $byId[$e['event_id']] = $e; }

        assert($byId['evt_timed']['all_day'] === 0, "timed event should not be all_day");
        assert($byId['evt_timed']['title'] === '会議');
        assert($byId['evt_timed']['location'] === 'Zoom');
        assert($byId['evt_timed']['start_at'] === strtotime('2026-06-02T10:00:00+09:00'));
        assert($byId['evt_timed']['end_at'] === strtotime('2026-06-02T11:00:00+09:00'));
        assert($byId['evt_timed']['id'] === 'google:evt_timed');

        assert($byId['evt_allday']['all_day'] === 1, "all-day flag missing");
        assert($byId['evt_allday']['title'] === '誕生日');
        assert($byId['evt_allday']['start_at'] === strtotime('2026-06-03 00:00:00'));
        assert($byId['evt_allday']['end_at'] === strtotime('2026-06-04 00:00:00'));

        // DB にキャッシュ保存されたか
        $count = (int)$this->pdo->query("SELECT COUNT(*) FROM external_events_cache WHERE user_id='user-fetch'")->fetchColumn();
        assert($count === 2, "expected 2 cached rows, got $count");

        // last_sync_at が更新されたか
        $lastSync = (int)$this->pdo->query("SELECT last_sync_at FROM user_google_oauth WHERE user_id='user-fetch'")->fetchColumn();
        assert($lastSync > 0, "last_sync_at not updated");
        echo " OK\n";
    }

    private function testRevoke(): void {
        echo "  [Test] revoke clears tokens & cache...";
        $this->pdo->prepare("INSERT INTO user_google_oauth (user_id, encrypted_refresh_token, created_at) VALUES (?, ?, ?)")
            ->execute(['user-rev', $this->crypto->encrypt('1//rev'), time()]);
        $this->pdo->prepare("INSERT INTO external_events_cache (id, user_id, calendar_id, event_id, start_at, end_at, all_day, fetched_at) VALUES (?,?,?,?,?,?,?,?)")
            ->execute(['google:e1', 'user-rev', 'primary', 'e1', 100, 200, 0, time()]);

        // revoke endpoint のレスポンス
        $this->http->enqueue(200, []);
        $this->service->revoke('user-rev');

        $oauthCount = (int)$this->pdo->query("SELECT COUNT(*) FROM user_google_oauth WHERE user_id='user-rev'")->fetchColumn();
        $cacheCount = (int)$this->pdo->query("SELECT COUNT(*) FROM external_events_cache WHERE user_id='user-rev'")->fetchColumn();
        assert($oauthCount === 0, "oauth row not deleted");
        assert($cacheCount === 0, "cache rows not deleted");

        // revoke 先 URL を確認
        $revokeCall = end($this->http->calls);
        assert(strpos($revokeCall['url'], 'https://oauth2.googleapis.com/revoke') === 0, "wrong revoke endpoint");
        echo " OK\n";
    }

    // ===== [R-041] 複数 Google カレンダー対応 =====

    /** トークンとカレンダー一覧を仕込んでから getCalendarList() を呼ぶヘルパー */
    private function seedOAuth(string $userId, string $refresh = '1//rt'): void {
        $this->pdo->prepare(
            "INSERT OR REPLACE INTO user_google_oauth (user_id, encrypted_refresh_token, primary_calendar_id, created_at) VALUES (?, ?, 'primary', ?)"
        )->execute([$userId, $this->crypto->encrypt($refresh), time()]);
    }

    private function testGetCalendarListUpsertsRows(): void {
        echo "  [Test] getCalendarList upserts rows from calendarList.list...";
        $this->seedOAuth('user-cal-1');

        // 1. refresh access token → 2. calendarList.list
        $this->http->enqueue(200, ['access_token' => 'ya29.cal', 'expires_in' => 3600]);
        $this->http->enqueue(200, [
            'items' => [
                [
                    'id' => 'primary',
                    'summary' => 'Primary',
                    'backgroundColor' => '#4285F4',
                ],
                [
                    'id' => 'work@group.calendar.google.com',
                    'summary' => '仕事',
                    'description' => '会社のカレンダー',
                    'backgroundColor' => '#0B8043',
                ],
            ],
        ]);

        $result = $this->service->getCalendarList('user-cal-1');
        assert(count($result) === 2, 'expected 2 calendars, got ' . count($result));

        $rows = $this->pdo->query("SELECT * FROM user_google_calendars WHERE user_id='user-cal-1' ORDER BY calendar_id")->fetchAll(PDO::FETCH_ASSOC);
        assert(count($rows) === 2, 'rows not inserted');
        $byId = [];
        foreach ($rows as $r) { $byId[$r['calendar_id']] = $r; }
        assert($byId['primary']['summary'] === 'Primary', 'primary summary not saved');
        assert($byId['primary']['color_hex'] === '#4285F4', 'color_hex not saved: ' . $byId['primary']['color_hex']);
        assert((int)$byId['primary']['is_enabled'] === 1, '初回連携時は全 ON のはず');
        assert($byId['work@group.calendar.google.com']['description'] === '会社のカレンダー', 'description not saved');
        echo " OK\n";
    }

    private function testGetCalendarListLogicallyDeletesMissing(): void {
        echo "  [Test] getCalendarList logically deletes calendars missing from Google...";
        $userId = 'user-cal-del';
        $this->seedOAuth($userId);
        $now = time();
        // 既存行 2 件を準備
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)")
            ->execute([$userId, 'primary', 'Primary', '#4285F4', $now - 100, $now - 100]);
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?)")
            ->execute([$userId, 'gone@group.calendar.google.com', 'もう消えた', '#FF0000', $now - 100, $now - 100]);

        // Google からは primary のみ返ってくる
        $this->http->enqueue(200, ['access_token' => 'ya29.cal2', 'expires_in' => 3600]);
        $this->http->enqueue(200, [
            'items' => [
                ['id' => 'primary', 'summary' => 'Primary', 'backgroundColor' => '#4285F4'],
            ],
        ]);

        $this->service->getCalendarList($userId);

        $gone = $this->pdo->query("SELECT * FROM user_google_calendars WHERE user_id='$userId' AND calendar_id='gone@group.calendar.google.com'")->fetch(PDO::FETCH_ASSOC);
        assert($gone !== false, '行は残るべき（物理削除ではない）');
        assert((int)$gone['is_enabled'] === 0, 'Google にないカレンダーは is_enabled = 0');
        assert((int)$gone['deleted_at'] > 0, 'deleted_at が記録されるべき');

        $primary = $this->pdo->query("SELECT * FROM user_google_calendars WHERE user_id='$userId' AND calendar_id='primary'")->fetch(PDO::FETCH_ASSOC);
        assert((int)$primary['is_enabled'] === 1, 'Google にあるカレンダーは is_enabled 維持');
        assert($primary['deleted_at'] === null, 'deleted_at は null のまま');
        echo " OK\n";
    }

    private function testGetEventsParallelMultiCalendar(): void {
        echo "  [Test] getEvents fetches multiple calendars in parallel via curl_multi...";
        $userId = 'user-multi';
        $this->seedOAuth($userId);
        $now = time();
        // 有効カレンダー 2 件
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)")
            ->execute([$userId, 'primary', 'Primary', '#4285F4', 0, $now, $now]);
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)")
            ->execute([$userId, 'work@group.calendar.google.com', '仕事', '#0B8043', 1, $now, $now]);

        // access token → multi 結果（FakeHttpClient.requestMulti は内部で request() を回す）
        $this->http->enqueue(200, ['access_token' => 'ya29.mlt', 'expires_in' => 3600]);
        $this->http->enqueue(200, [
            'items' => [
                [
                    'id' => 'evt_p',
                    'summary' => 'プライマリ予定',
                    'start' => ['dateTime' => '2026-06-10T09:00:00+09:00'],
                    'end' => ['dateTime' => '2026-06-10T10:00:00+09:00'],
                ],
            ],
        ]);
        $this->http->enqueue(200, [
            'items' => [
                [
                    'id' => 'evt_w',
                    'summary' => '会議',
                    'start' => ['dateTime' => '2026-06-11T09:00:00+09:00'],
                    'end' => ['dateTime' => '2026-06-11T10:00:00+09:00'],
                ],
            ],
        ]);

        $from = strtotime('2026-06-01');
        $to = strtotime('2026-06-30');
        $events = $this->service->getEvents($userId, $from, $to);

        assert(count($events) === 2, 'expected 2 events, got ' . count($events));
        $byCal = [];
        foreach ($events as $e) { $byCal[$e['calendar_id']] = $e; }
        assert(isset($byCal['primary']), 'primary event missing');
        assert(isset($byCal['work@group.calendar.google.com']), 'work event missing');
        assert($byCal['primary']['color_hex'] === '#4285F4', 'color_hex not propagated');
        assert($byCal['work@group.calendar.google.com']['color_hex'] === '#0B8043', 'color_hex (work) not propagated');

        // events.list を 2 回呼んだか確認（並列 = 順序関係なく 2 件）
        // 注: $this->http->calls は全テストで累積するため、本テスト固有の access token "ya29.mlt" で絞る
        $eventsCalls = array_filter($this->http->calls, function($c) {
            if (strpos($c['url'], '/events?') === false) return false;
            $headers = $c['options']['headers'] ?? [];
            foreach ($headers as $h) {
                if (strpos($h, 'Bearer ya29.mlt') !== false) return true;
            }
            return false;
        });
        assert(count($eventsCalls) === 2, 'events.list should be called for each enabled calendar, got ' . count($eventsCalls));
        echo " OK\n";
    }

    private function testGetEventsRespectsIsEnabled(): void {
        echo "  [Test] getEvents skips disabled calendars...";
        $userId = 'user-disabled';
        $this->seedOAuth($userId);
        $now = time();
        // 有効 1 件、無効 1 件
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)")
            ->execute([$userId, 'primary', 'Primary', '#4285F4', $now, $now]);
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 1, ?, ?)")
            ->execute([$userId, 'off@group.calendar.google.com', 'OFF', '#888888', $now, $now]);

        $this->http->enqueue(200, ['access_token' => 'ya29.dis', 'expires_in' => 3600]);
        $this->http->enqueue(200, ['items' => []]);

        $events = $this->service->getEvents($userId, strtotime('2026-06-01'), strtotime('2026-06-30'));
        assert(count($events) === 0, 'no events expected');

        // OFF カレンダーのエンドポイントが叩かれていないこと
        foreach ($this->http->calls as $c) {
            assert(strpos($c['url'], 'off%40group.calendar.google.com') === false && strpos($c['url'], 'off@group.calendar.google.com') === false, 'OFF カレンダーは fetch されないはず: ' . $c['url']);
        }
        echo " OK\n";
    }

    private function testGetEventsCacheKeyPerCalendar(): void {
        echo "  [Test] getEvents caches events per calendar_id (no cross-calendar contamination)...";
        $userId = 'user-cache';
        $this->seedOAuth($userId);
        $now = time();
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)")
            ->execute([$userId, 'primary', 'Primary', '#4285F4', $now, $now]);
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?)")
            ->execute([$userId, 'work@group.calendar.google.com', '仕事', '#0B8043', $now, $now]);

        // 事前キャッシュ: primary のみ過去のイベントが残っている
        $this->pdo->prepare("INSERT INTO external_events_cache (id, user_id, calendar_id, event_id, start_at, end_at, all_day, title, fetched_at) VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute(['google:primary:old', $userId, 'primary', 'old', strtotime('2026-06-15 10:00:00'), strtotime('2026-06-15 11:00:00'), 0, '旧キャッシュ', $now - 1000]);

        $this->http->enqueue(200, ['access_token' => 'ya29.cache', 'expires_in' => 3600]);
        // primary は新しいイベント 1 件
        $this->http->enqueue(200, [
            'items' => [
                [
                    'id' => 'new',
                    'summary' => '新規',
                    'start' => ['dateTime' => '2026-06-20T10:00:00+09:00'],
                    'end' => ['dateTime' => '2026-06-20T11:00:00+09:00'],
                ],
            ],
        ]);
        // work は空
        $this->http->enqueue(200, ['items' => []]);

        $events = $this->service->getEvents($userId, strtotime('2026-06-01'), strtotime('2026-06-30'));

        // primary のキャッシュは calendar_id ごとに上書きされ、work には影響しない
        $primaryRows = $this->pdo->query("SELECT * FROM external_events_cache WHERE user_id='$userId' AND calendar_id='primary'")->fetchAll(PDO::FETCH_ASSOC);
        assert(count($primaryRows) === 1, 'primary cache should be replaced for the period');
        assert($primaryRows[0]['event_id'] === 'new', '旧キャッシュは消えるはず');

        $workRows = $this->pdo->query("SELECT * FROM external_events_cache WHERE user_id='$userId' AND calendar_id='work@group.calendar.google.com'")->fetchAll(PDO::FETCH_ASSOC);
        assert(count($workRows) === 0, 'work には何も入らないはず');

        // id が calendar_id を含む（衝突回避）
        assert($primaryRows[0]['id'] === 'google:primary:new', 'id should embed calendar_id: ' . $primaryRows[0]['id']);
        echo " OK\n";
    }

    private function testUpdateCalendarEnabled(): void {
        echo "  [Test] updateCalendarEnabled toggles is_enabled with user_id scoping...";
        $userId = 'user-toggle';
        $now = time();
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)")
            ->execute([$userId, 'primary', 'Primary', $now, $now]);
        $rowId = (int)$this->pdo->lastInsertId();

        // 他ユーザーの行（マルチテナント隔離テスト）
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)")
            ->execute(['other-user', 'primary', 'Other', $now, $now]);
        $otherRowId = (int)$this->pdo->lastInsertId();

        $ok = $this->service->updateCalendarEnabled($userId, $rowId, false);
        assert($ok === true, 'update should return true');

        $row = $this->pdo->query("SELECT is_enabled FROM user_google_calendars WHERE id=$rowId")->fetch(PDO::FETCH_ASSOC);
        assert((int)$row['is_enabled'] === 0, '無効化されるべき');

        // 他ユーザーの行は触られない
        $other = $this->pdo->query("SELECT is_enabled FROM user_google_calendars WHERE id=$otherRowId")->fetch(PDO::FETCH_ASSOC);
        assert((int)$other['is_enabled'] === 1, '他ユーザーの行は変更されないこと');

        // 他ユーザーの id を渡しても更新されない
        $fail = $this->service->updateCalendarEnabled($userId, $otherRowId, false);
        assert($fail === false, '他ユーザー行は更新されない');
        $other2 = $this->pdo->query("SELECT is_enabled FROM user_google_calendars WHERE id=$otherRowId")->fetch(PDO::FETCH_ASSOC);
        assert((int)$other2['is_enabled'] === 1, '他ユーザー行は依然として変更されない');
        echo " OK\n";
    }
}

$test = new GoogleCalendarServiceTest();
$test->run();
