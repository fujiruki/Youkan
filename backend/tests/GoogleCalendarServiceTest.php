<?php
// backend/tests/GoogleCalendarServiceTest.php
// R-034 Phase 2: GoogleCalendarService の単体テスト
//   - HTTP は注入可能なクライアントで mock
//   - DB は in-memory SQLite を用意して暗号化往復まで通す
require_once __DIR__ . '/../services/CryptoService.php';
require_once __DIR__ . '/../services/GoogleCalendarService.php';

/**
 * GoogleCalendarService が叩く HTTP 呼び出しを mock するためのスタブ。
 * 呼び出し履歴を保存しつつ、事前に積んだレスポンスを順に返す。
 */
class FakeHttpClient {
    public array $calls = [];
    private array $queue = [];

    public function enqueue(int $status, array $jsonBody, array $headers = []): void {
        $this->queue[] = [
            'status' => $status,
            'body' => json_encode($jsonBody),
            'headers' => $headers,
        ];
    }

    public function request(string $method, string $url, array $options = []): array {
        $this->calls[] = ['method' => $method, 'url' => $url, 'options' => $options];
        if (empty($this->queue)) {
            throw new \RuntimeException("FakeHttpClient: no response queued for $method $url");
        }
        return array_shift($this->queue);
    }
}

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
}

$test = new GoogleCalendarServiceTest();
$test->run();
