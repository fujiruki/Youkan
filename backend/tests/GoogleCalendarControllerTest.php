<?php
// backend/tests/GoogleCalendarControllerTest.php
// R-034 Phase 2: GoogleCalendarController の単体テスト
//
// 設計:
//   - 認証は authenticate() を override したサブクラスで bypass
//   - HTTP は FakeHttpClient（GoogleCalendarServiceTest と同じ）
//   - DB は in-memory SQLite
//   - JSON 出力は ob_start で捕捉して検証

require_once __DIR__ . '/../services/CryptoService.php';
require_once __DIR__ . '/../services/GoogleCalendarService.php';
require_once __DIR__ . '/helpers/FakeHttpClient.php';
require_once __DIR__ . '/../GoogleCalendarController.php';

/**
 * 認証 bypass + JSON 出力捕捉のためのコントローラ派生
 */
class TestableGoogleCalendarController extends GoogleCalendarController {
    public string $mockUserId = 'user-1';
    public array $lastResponse = [];
    public ?int $lastStatus = null;
    /** PATCH/POST 等で php://input を差し替えるためのモック */
    public array $mockInput = [];

    public function __construct(PDO $pdo, GoogleCalendarService $service) {
        // 親の constructor は呼ばず、必要なプロパティだけ注入
        $this->pdo = $pdo;
        $this->service = $service;
    }

    protected function authenticate(): void {
        $this->currentUserId = $this->mockUserId;
    }

    protected function sendJSON($data): void {
        $this->lastResponse = is_array($data) ? $data : ['_raw' => $data];
        // 例外で抜ける（exit; の代わり）
        throw new TestExit();
    }

    protected function sendError($code, $message): void {
        $this->lastStatus = $code;
        $this->lastResponse = ['error' => $message];
        throw new TestExit();
    }

    protected function getInput() {
        return $this->mockInput;
    }
}

class TestExit extends \Exception {}

class GoogleCalendarControllerTest {
    private PDO $pdo;
    private CryptoService $crypto;
    private FakeHttpClient $http;
    private GoogleCalendarService $service;
    private TestableGoogleCalendarController $controller;

    public function __construct() {
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
        $this->service = new GoogleCalendarService(
            $this->pdo,
            $this->crypto,
            [
                'client_id' => 'fake-id',
                'client_secret' => 'fake-secret',
                'redirect_uri' => 'http://localhost:8000/api/google/oauth/callback',
            ],
            $this->http
        );
        $this->controller = new TestableGoogleCalendarController($this->pdo, $this->service);
    }

    public function run(): void {
        echo "Running GoogleCalendarController Tests...\n";
        $this->testStartReturnsAuthUrl();
        $this->testRefreshCooldown();
        $this->testGetEventsFromCache();
        $this->testStatusWhenConnected();
        $this->testStatusWhenNotConnected();
        $this->testDeleteOauth();
        // [R-041] 複数 Google カレンダー対応
        $this->testListCalendarsReturnsRows();
        $this->testPatchCalendarTogglesEnabled();
        $this->testPatchCalendarRejectsOtherUser();
        echo "All tests passed!\n";
    }

    private function captureResponse(callable $action): array {
        $this->controller->lastResponse = [];
        $this->controller->lastStatus = null;
        try {
            $action();
        } catch (TestExit $e) {
            // 期待した経路
        }
        return [
            'status' => $this->controller->lastStatus,
            'body' => $this->controller->lastResponse,
        ];
    }

    private function testStartReturnsAuthUrl(): void {
        echo "  [Test] POST /google/oauth/start returns authUrl...";
        $res = $this->captureResponse(fn() => $this->controller->oauthStart());
        $body = $res['body'];
        assert(isset($body['authUrl']), "authUrl missing");
        assert(strpos($body['authUrl'], 'accounts.google.com') !== false, "wrong host");
        assert(strpos($body['authUrl'], 'state=') !== false, "state missing");
        echo " OK\n";
    }

    private function testRefreshCooldown(): void {
        echo "  [Test] POST /google/calendar/refresh enforces 60s cooldown...";
        $now = time();
        $this->pdo->prepare("INSERT INTO user_google_oauth (user_id, encrypted_refresh_token, last_sync_at, created_at) VALUES (?, ?, ?, ?)")
            ->execute(['user-1', $this->crypto->encrypt('rt'), $now - 10, $now - 3600]);

        $res = $this->captureResponse(fn() => $this->controller->refresh());
        assert($res['status'] === 429, "expected 429, got " . var_export($res['status'], true));
        assert(strpos($res['body']['error'] ?? '', 'cooldown') !== false || strpos($res['body']['error'] ?? '', 'クールダウン') !== false, "cooldown message missing");

        // last_sync_at を 70 秒前に戻す → 通る
        $this->pdo->prepare("UPDATE user_google_oauth SET last_sync_at = ? WHERE user_id = ?")
            ->execute([$now - 70, 'user-1']);

        $this->http->enqueue(200, ['access_token' => 'ya29.x', 'expires_in' => 3600]);
        $this->http->enqueue(200, ['items' => []]);

        $res2 = $this->captureResponse(fn() => $this->controller->refresh());
        assert($res2['status'] === null, "expected success, got status " . var_export($res2['status'], true));
        assert(isset($res2['body']['count']), "count missing in success response");
        echo " OK\n";
    }

    private function testGetEventsFromCache(): void {
        echo "  [Test] GET /google/calendar/events reads from cache...";
        $now = time();
        $this->pdo->prepare("INSERT INTO external_events_cache (id, user_id, calendar_id, event_id, start_at, end_at, all_day, title, location, fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([
                'google:evt1', 'user-1', 'primary', 'evt1',
                strtotime('2026-06-15 10:00:00'),
                strtotime('2026-06-15 11:00:00'),
                0, '会議', 'Zoom', $now,
            ]);

        $_GET['from'] = '2026-06-01';
        $_GET['to'] = '2026-06-30';
        $res = $this->captureResponse(fn() => $this->controller->getEvents());
        $events = $res['body']['events'] ?? null;
        assert(is_array($events), "events missing");
        assert(count($events) === 1, "expected 1 event, got " . count($events));
        assert($events[0]['title'] === '会議');
        assert($events[0]['id'] === 'google:evt1');
        echo " OK\n";
    }

    private function testStatusWhenConnected(): void {
        echo "  [Test] GET /google/oauth/status when connected...";
        $this->pdo->prepare("DELETE FROM user_google_oauth")->execute();
        $now = time();
        $this->pdo->prepare("INSERT INTO user_google_oauth (user_id, encrypted_refresh_token, primary_calendar_email, primary_calendar_id, last_sync_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            ->execute(['user-1', $this->crypto->encrypt('rt'), 'haruki@example.com', 'primary', $now - 100, $now - 1000]);
        $res = $this->captureResponse(fn() => $this->controller->status());
        assert($res['body']['connected'] === true);
        assert($res['body']['email'] === 'haruki@example.com');
        echo " OK\n";
    }

    private function testStatusWhenNotConnected(): void {
        echo "  [Test] GET /google/oauth/status when not connected...";
        $this->pdo->prepare("DELETE FROM user_google_oauth")->execute();
        $res = $this->captureResponse(fn() => $this->controller->status());
        assert($res['body']['connected'] === false, "should be disconnected: " . json_encode($res['body']));
        echo " OK\n";
    }

    private function testDeleteOauth(): void {
        echo "  [Test] DELETE /google/oauth revokes & cleans up...";
        $now = time();
        $this->pdo->prepare("DELETE FROM user_google_oauth")->execute();
        $this->pdo->prepare("DELETE FROM external_events_cache")->execute();
        $this->pdo->prepare("INSERT INTO user_google_oauth (user_id, encrypted_refresh_token, created_at) VALUES (?, ?, ?)")
            ->execute(['user-1', $this->crypto->encrypt('rt-del'), $now]);
        $this->pdo->prepare("INSERT INTO external_events_cache (id, user_id, calendar_id, event_id, start_at, end_at, all_day, fetched_at) VALUES (?,?,?,?,?,?,?,?)")
            ->execute(['google:x', 'user-1', 'primary', 'x', 100, 200, 0, $now]);

        $this->http->enqueue(200, []);
        $res = $this->captureResponse(fn() => $this->controller->revoke());
        assert(($res['body']['success'] ?? false) === true, "success flag missing");

        $oauthCount = (int)$this->pdo->query("SELECT COUNT(*) FROM user_google_oauth")->fetchColumn();
        $cacheCount = (int)$this->pdo->query("SELECT COUNT(*) FROM external_events_cache")->fetchColumn();
        assert($oauthCount === 0 && $cacheCount === 0, "cleanup failed");
        echo " OK\n";
    }

    // ===== [R-041] 複数 Google カレンダー対応 =====

    private function testListCalendarsReturnsRows(): void {
        echo "  [Test] GET /google/calendars returns calendar list...";
        // OAuth を仕込み、refresh access → calendarList.list の順でモック
        $this->pdo->prepare("DELETE FROM user_google_oauth")->execute();
        $this->pdo->prepare("DELETE FROM user_google_calendars")->execute();
        $now = time();
        $this->pdo->prepare("INSERT INTO user_google_oauth (user_id, encrypted_refresh_token, primary_calendar_id, created_at) VALUES (?, ?, 'primary', ?)")
            ->execute(['user-1', $this->crypto->encrypt('rt'), $now]);

        $this->http->enqueue(200, ['access_token' => 'ya29.cal', 'expires_in' => 3600]);
        $this->http->enqueue(200, [
            'items' => [
                ['id' => 'primary', 'summary' => 'Primary', 'backgroundColor' => '#4285F4'],
                ['id' => 'side@group.calendar.google.com', 'summary' => 'サブ', 'backgroundColor' => '#33B679'],
            ],
        ]);

        $res = $this->captureResponse(fn() => $this->controller->listCalendars());
        $list = $res['body']['calendars'] ?? null;
        assert(is_array($list), 'calendars missing in response');
        assert(count($list) === 2, 'expected 2 calendars, got ' . count($list));
        $byId = [];
        foreach ($list as $c) { $byId[$c['calendar_id']] = $c; }
        assert(isset($byId['primary']) && $byId['primary']['color_hex'] === '#4285F4', 'primary color_hex missing');
        assert($byId['primary']['is_enabled'] === true, 'is_enabled bool expected');
        assert(isset($byId['primary']['id']) && $byId['primary']['id'] > 0, 'row id missing');
        echo " OK\n";
    }

    private function testPatchCalendarTogglesEnabled(): void {
        echo "  [Test] PATCH /google/calendars/{id} toggles is_enabled...";
        $this->pdo->prepare("DELETE FROM user_google_calendars")->execute();
        $now = time();
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, color_hex, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)")
            ->execute(['user-1', 'primary', 'Primary', '#4285F4', $now, $now]);
        $rowId = (int)$this->pdo->lastInsertId();

        $this->controller->mockInput = ['is_enabled' => false];
        $res = $this->captureResponse(fn() => $this->controller->patchCalendar($rowId));
        assert(($res['body']['success'] ?? false) === true, 'success flag missing');

        $row = $this->pdo->query("SELECT is_enabled FROM user_google_calendars WHERE id=$rowId")->fetch(PDO::FETCH_ASSOC);
        assert((int)$row['is_enabled'] === 0, 'is_enabled should be 0');
        echo " OK\n";
    }

    private function testPatchCalendarRejectsOtherUser(): void {
        echo "  [Test] PATCH /google/calendars/{id} rejects other-user rows...";
        $this->pdo->prepare("DELETE FROM user_google_calendars")->execute();
        $now = time();
        // 他ユーザーの行
        $this->pdo->prepare("INSERT INTO user_google_calendars (user_id, calendar_id, summary, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)")
            ->execute(['other-user', 'primary', 'Other', $now, $now]);
        $otherId = (int)$this->pdo->lastInsertId();

        $this->controller->mockInput = ['is_enabled' => false];
        $res = $this->captureResponse(fn() => $this->controller->patchCalendar($otherId));
        assert($res['status'] === 404, 'expected 404 not-found for other user, got ' . var_export($res['status'], true));

        // 行は変更されない
        $row = $this->pdo->query("SELECT is_enabled FROM user_google_calendars WHERE id=$otherId")->fetch(PDO::FETCH_ASSOC);
        assert((int)$row['is_enabled'] === 1, '他ユーザー行は変更されていないこと');
        echo " OK\n";
    }
}

$test = new GoogleCalendarControllerTest();
$test->run();
