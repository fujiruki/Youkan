<?php
// backend/services/GoogleCalendarService.php
// R-034 Phase 2: Google Calendar OAuth & イベント取得
//
// 設計方針:
//   - SDK は使わず curl で OAuth2 / Calendar REST API を直接叩く（composer 依存ゼロ）
//   - HTTP クライアントは注入可能（テストで FakeHttpClient に差し替え）
//   - リフレッシュトークンは CryptoService で AES-256-GCM 暗号化して DB 保管
//   - アクセストークンは保存しない（リフレッシュトークンから都度発行、メモリ内のみ）

require_once __DIR__ . '/CryptoService.php';
require_once __DIR__ . '/HttpClient.php';

class GoogleCalendarService {
    public const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
    public const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    public const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    public const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
    public const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
    public const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
    public const ALL_DAY_MINUTES = 240; // 終日イベントの量感換算（仕様: 半日相当）
    public const MULTI_CONCURRENCY = 5; // R-041: events.list 並列取得の同時接続数上限

    private PDO $pdo;
    private CryptoService $crypto;
    private array $config; // [client_id, client_secret, redirect_uri]
    private $http; // HttpClient | FakeHttpClient

    public function __construct(PDO $pdo, CryptoService $crypto, array $config, $http = null) {
        $required = ['client_id', 'client_secret', 'redirect_uri'];
        foreach ($required as $k) {
            if (empty($config[$k])) {
                throw new \InvalidArgumentException("GoogleCalendarService: config['$k'] is required");
            }
        }
        $this->pdo = $pdo;
        $this->crypto = $crypto;
        $this->config = $config;
        $this->http = $http ?? new HttpClient();
    }

    /**
     * 環境変数から自動構築するヘルパー
     */
    public static function fromEnv(PDO $pdo): self {
        $crypto = CryptoService::fromEnv();
        $config = [
            'client_id' => CryptoService::loadEnvKey('GOOGLE_OAUTH_CLIENT_ID') ?? '',
            'client_secret' => CryptoService::loadEnvKey('GOOGLE_OAUTH_CLIENT_SECRET') ?? '',
            'redirect_uri' => CryptoService::loadEnvKey('GOOGLE_OAUTH_REDIRECT_URI') ?? '',
        ];
        return new self($pdo, $crypto, $config);
    }

    /**
     * OAuth 認証画面の URL を生成。
     * state は CSRF 対策として呼び元（コントローラ）が生成・検証する。
     */
    public function getAuthorizationUrl(string $state): string {
        $params = [
            'client_id' => $this->config['client_id'],
            'redirect_uri' => $this->config['redirect_uri'],
            'response_type' => 'code',
            'scope' => self::SCOPE,
            'access_type' => 'offline', // refresh_token を要求
            'prompt' => 'consent',      // 毎回 refresh_token を返してもらう
            'state' => $state,
            'include_granted_scopes' => 'true',
        ];
        return self::AUTH_URL . '?' . http_build_query($params);
    }

    /**
     * 認可コードをトークンに交換し、リフレッシュトークンを暗号化して保存する。
     * @return array { email, calendar_id }
     */
    public function exchangeCodeForTokens(string $userId, string $code): array {
        $body = http_build_query([
            'code' => $code,
            'client_id' => $this->config['client_id'],
            'client_secret' => $this->config['client_secret'],
            'redirect_uri' => $this->config['redirect_uri'],
            'grant_type' => 'authorization_code',
        ]);
        $res = $this->http->request('POST', self::TOKEN_URL, [
            'headers' => ['Content-Type: application/x-www-form-urlencoded'],
            'body' => $body,
        ]);
        if ($res['status'] !== 200) {
            throw new \RuntimeException('GoogleCalendarService: token exchange failed: ' . $res['body']);
        }
        $tokens = json_decode($res['body'], true);
        if (empty($tokens['refresh_token'])) {
            throw new \RuntimeException('GoogleCalendarService: no refresh_token returned. Try revoking the app in Google account settings, then re-authenticate.');
        }
        $refreshToken = $tokens['refresh_token'];
        $accessToken = $tokens['access_token'] ?? '';

        // userinfo: メールアドレス取得
        $email = '';
        if ($accessToken) {
            $infoRes = $this->http->request('GET', self::USERINFO_URL, [
                'headers' => ["Authorization: Bearer $accessToken"],
            ]);
            if ($infoRes['status'] === 200) {
                $info = json_decode($infoRes['body'], true);
                $email = $info['email'] ?? '';
            }
        }

        // primary カレンダー ID は Google 仕様で常に 'primary' エイリアスが使える
        // （メールアドレスと同値だが、APIではエイリアスを推奨）
        $calendarId = 'primary';
        if ($accessToken) {
            $calRes = $this->http->request('GET', self::CALENDAR_API . '/calendars/primary', [
                'headers' => ["Authorization: Bearer $accessToken"],
            ]);
            if ($calRes['status'] === 200) {
                $cal = json_decode($calRes['body'], true);
                if (!empty($cal['id'])) {
                    // Phase 2 では primary 固定だが、id を保存しておくと Phase 3 で楽
                    // ただしロジックは 'primary' エイリアスを使い続けるため calendar_id は 'primary' のまま
                }
            }
        }

        $encrypted = $this->crypto->encrypt($refreshToken);
        $now = time();

        // UPSERT
        $stmt = $this->pdo->prepare("
            INSERT INTO user_google_oauth (user_id, encrypted_refresh_token, primary_calendar_email, primary_calendar_id, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                encrypted_refresh_token = excluded.encrypted_refresh_token,
                primary_calendar_email = excluded.primary_calendar_email,
                primary_calendar_id = excluded.primary_calendar_id
        ");
        $stmt->execute([$userId, $encrypted, $email, $calendarId, $now]);

        return [
            'email' => $email,
            'calendar_id' => $calendarId,
        ];
    }

    /**
     * リフレッシュトークンから新しいアクセストークンを発行する。
     * 戻り値: access_token 文字列（メモリ保持のみ。DB に保存しない）
     */
    public function refreshAccessToken(string $userId): string {
        $stmt = $this->pdo->prepare("SELECT encrypted_refresh_token FROM user_google_oauth WHERE user_id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new \RuntimeException('GoogleCalendarService: no OAuth record for user');
        }
        $refresh = $this->crypto->decrypt($row['encrypted_refresh_token']);
        if (!$refresh) {
            throw new \RuntimeException('GoogleCalendarService: failed to decrypt refresh token');
        }
        $body = http_build_query([
            'client_id' => $this->config['client_id'],
            'client_secret' => $this->config['client_secret'],
            'refresh_token' => $refresh,
            'grant_type' => 'refresh_token',
        ]);
        $res = $this->http->request('POST', self::TOKEN_URL, [
            'headers' => ['Content-Type: application/x-www-form-urlencoded'],
            'body' => $body,
        ]);
        if ($res['status'] !== 200) {
            throw new \RuntimeException('GoogleCalendarService: refresh failed: ' . $res['body']);
        }
        $tokens = json_decode($res['body'], true);
        if (empty($tokens['access_token'])) {
            throw new \RuntimeException('GoogleCalendarService: refresh returned no access_token');
        }
        return $tokens['access_token'];
    }

    /**
     * primary カレンダーのイベントを期間指定で取得し、external_events_cache に upsert。
     * @return array<int, array{ id:string, event_id:string, calendar_id:string, start_at:int, end_at:int, all_day:int, title:?string, location:?string, html_link:?string }>
     */
    public function fetchEvents(string $userId, int $fromTimestamp, int $toTimestamp): array {
        $accessToken = $this->refreshAccessToken($userId);

        $url = self::CALENDAR_API . '/calendars/primary/events?' . http_build_query([
            'timeMin' => gmdate('Y-m-d\TH:i:s\Z', $fromTimestamp),
            'timeMax' => gmdate('Y-m-d\TH:i:s\Z', $toTimestamp),
            'singleEvents' => 'true',
            'orderBy' => 'startTime',
            'maxResults' => 250,
        ]);
        $res = $this->http->request('GET', $url, [
            'headers' => ["Authorization: Bearer $accessToken"],
        ]);
        if ($res['status'] !== 200) {
            throw new \RuntimeException('GoogleCalendarService: events.list failed: ' . $res['body']);
        }
        $data = json_decode($res['body'], true);
        $items = $data['items'] ?? [];

        $now = time();
        $normalized = [];

        // 既存キャッシュをクリア（指定期間内）
        $delStmt = $this->pdo->prepare("DELETE FROM external_events_cache WHERE user_id = ? AND start_at >= ? AND start_at < ?");
        $delStmt->execute([$userId, $fromTimestamp, $toTimestamp]);

        $insStmt = $this->pdo->prepare("
            INSERT INTO external_events_cache (id, user_id, calendar_id, event_id, start_at, end_at, all_day, title, location, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                start_at = excluded.start_at,
                end_at = excluded.end_at,
                all_day = excluded.all_day,
                title = excluded.title,
                location = excluded.location,
                fetched_at = excluded.fetched_at
        ");

        foreach ($items as $item) {
            if (($item['status'] ?? '') === 'cancelled') {
                continue;
            }
            $eventId = $item['id'] ?? null;
            if (!$eventId) continue;

            $allDay = 0;
            $startAt = 0;
            $endAt = 0;
            if (isset($item['start']['dateTime'])) {
                $startAt = strtotime($item['start']['dateTime']);
                $endAt = strtotime($item['end']['dateTime'] ?? $item['start']['dateTime']);
            } elseif (isset($item['start']['date'])) {
                $allDay = 1;
                $startAt = strtotime($item['start']['date'] . ' 00:00:00');
                $endAt = strtotime(($item['end']['date'] ?? $item['start']['date']) . ' 00:00:00');
            } else {
                continue;
            }

            $row = [
                'id' => 'google:' . $eventId,
                'user_id' => $userId,
                'calendar_id' => 'primary',
                'event_id' => $eventId,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'all_day' => $allDay,
                'title' => $item['summary'] ?? null,
                'location' => $item['location'] ?? null,
                'html_link' => $item['htmlLink'] ?? null,
            ];

            $insStmt->execute([
                $row['id'], $userId, $row['calendar_id'], $row['event_id'],
                $row['start_at'], $row['end_at'], $row['all_day'],
                $row['title'], $row['location'], $now,
            ]);

            $normalized[] = $row;
        }

        // last_sync_at 更新
        $this->pdo->prepare("UPDATE user_google_oauth SET last_sync_at = ? WHERE user_id = ?")
            ->execute([$now, $userId]);

        return $normalized;
    }

    /**
     * トークンを Google 側で無効化し、DB から OAuth レコード＋キャッシュを削除する。
     */
    public function revoke(string $userId): void {
        $stmt = $this->pdo->prepare("SELECT encrypted_refresh_token FROM user_google_oauth WHERE user_id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $refresh = $this->crypto->decrypt($row['encrypted_refresh_token']);
            if ($refresh) {
                try {
                    $this->http->request('POST', self::REVOKE_URL . '?token=' . urlencode($refresh), [
                        'headers' => ['Content-Type: application/x-www-form-urlencoded'],
                        'body' => '',
                    ]);
                } catch (\Throwable $e) {
                    // Google 側の取消が失敗してもローカル DB は消す
                    error_log('GoogleCalendarService::revoke remote revoke failed: ' . $e->getMessage());
                }
            }
        }

        // FK の CASCADE が効かないケース（SQLite で foreign_keys=OFF 等）に備え明示削除
        $this->pdo->prepare("DELETE FROM external_events_cache WHERE user_id = ?")->execute([$userId]);
        $this->pdo->prepare("DELETE FROM user_google_oauth WHERE user_id = ?")->execute([$userId]);
    }

    /**
     * キャッシュから期間内のイベントを取得（API へ問い合わせず DB 参照のみ）
     */
    public function getCachedEvents(string $userId, int $fromTimestamp, int $toTimestamp): array {
        $stmt = $this->pdo->prepare("
            SELECT id, calendar_id, event_id, start_at, end_at, all_day, title, location
            FROM external_events_cache
            WHERE user_id = ? AND start_at < ? AND end_at >= ?
            ORDER BY start_at ASC
        ");
        $stmt->execute([$userId, $toTimestamp, $fromTimestamp]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [];
        foreach ($rows as $r) {
            $eventId = $r['event_id'];
            $result[] = [
                'id' => $r['id'],
                'calendar_id' => $r['calendar_id'],
                'start_at' => (int)$r['start_at'],
                'end_at' => (int)$r['end_at'],
                'all_day' => (int)$r['all_day'] === 1,
                'title' => $r['title'],
                'location' => $r['location'],
                // html_link は DB 保存しないため都度組み立て（イベントの汎用 URL）
                'html_link' => 'https://calendar.google.com/calendar/u/0/r/eventedit/' . rawurlencode($eventId),
            ];
        }
        return $result;
    }

    // ===== [R-041] 複数 Google カレンダー対応 =====

    /**
     * Google `calendarList.list` を呼び、`user_google_calendars` に upsert する。
     * Google 側から消えたカレンダーは `is_enabled = 0` + `deleted_at = now()` で論理削除。
     * 初回連携または新規発見カレンダーは `is_enabled = 1` として挿入（前提: 全 ON）。
     *
     * @return array<int, array{
     *   id:int, calendar_id:string, summary:?string, description:?string,
     *   color_hex:?string, is_enabled:bool, sort_order:int
     * }>
     */
    public function getCalendarList(string $userId): array {
        $accessToken = $this->refreshAccessToken($userId);
        $res = $this->http->request('GET', self::CALENDAR_API . '/users/me/calendarList', [
            'headers' => ["Authorization: Bearer $accessToken"],
        ]);
        if ($res['status'] !== 200) {
            throw new \RuntimeException('GoogleCalendarService: calendarList.list failed: ' . $res['body']);
        }
        $data = json_decode($res['body'], true);
        $items = $data['items'] ?? [];

        $now = time();
        $googleIds = [];
        $sortOrder = 0;

        foreach ($items as $item) {
            $calendarId = $item['id'] ?? null;
            if (!$calendarId) continue;
            $googleIds[] = $calendarId;
            $summary = $item['summaryOverride'] ?? ($item['summary'] ?? null);
            $description = $item['description'] ?? null;
            $colorHex = $item['backgroundColor'] ?? null;

            // 既存行を確認
            $sel = $this->pdo->prepare("SELECT id, is_enabled FROM user_google_calendars WHERE user_id = ? AND calendar_id = ?");
            $sel->execute([$userId, $calendarId]);
            $existing = $sel->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // 既存行は属性更新、削除フラグ解除。is_enabled はユーザー設定を尊重
                $upd = $this->pdo->prepare("
                    UPDATE user_google_calendars
                       SET summary = ?, description = ?, color_hex = ?,
                           sort_order = ?, deleted_at = NULL, last_synced_at = ?, updated_at = ?
                     WHERE id = ?
                ");
                $upd->execute([$summary, $description, $colorHex, $sortOrder, $now, $now, (int)$existing['id']]);
            } else {
                // 新規発見カレンダー: is_enabled = 1 で挿入（初回連携 = 全 ON）
                $ins = $this->pdo->prepare("
                    INSERT INTO user_google_calendars
                        (user_id, calendar_id, summary, description, color_hex, is_enabled, sort_order, last_synced_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
                ");
                $ins->execute([$userId, $calendarId, $summary, $description, $colorHex, $sortOrder, $now, $now, $now]);
            }
            $sortOrder++;
        }

        // Google にない既存行を論理削除
        if (!empty($googleIds)) {
            $placeholders = implode(',', array_fill(0, count($googleIds), '?'));
            $params = array_merge([$now, $now, $userId], $googleIds);
            $delStmt = $this->pdo->prepare("
                UPDATE user_google_calendars
                   SET is_enabled = 0, deleted_at = ?, updated_at = ?
                 WHERE user_id = ?
                   AND calendar_id NOT IN ($placeholders)
                   AND deleted_at IS NULL
            ");
            $delStmt->execute($params);
        } else {
            // Google が空（理論上 primary が必ず返るので通常起こらない）
            $delStmt = $this->pdo->prepare("
                UPDATE user_google_calendars
                   SET is_enabled = 0, deleted_at = ?, updated_at = ?
                 WHERE user_id = ? AND deleted_at IS NULL
            ");
            $delStmt->execute([$now, $now, $userId]);
        }

        return $this->fetchCalendarRows($userId);
    }

    /**
     * `user_google_calendars` の現在の行を取得（論理削除済みは除外）。
     */
    public function fetchCalendarRows(string $userId): array {
        $stmt = $this->pdo->prepare("
            SELECT id, calendar_id, summary, description, color_hex, is_enabled, sort_order
              FROM user_google_calendars
             WHERE user_id = ? AND deleted_at IS NULL
             ORDER BY sort_order ASC, id ASC
        ");
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [];
        foreach ($rows as $r) {
            $result[] = [
                'id' => (int)$r['id'],
                'calendar_id' => $r['calendar_id'],
                'summary' => $r['summary'],
                'description' => $r['description'],
                'color_hex' => $r['color_hex'],
                'is_enabled' => (int)$r['is_enabled'] === 1,
                'sort_order' => (int)$r['sort_order'],
            ];
        }
        return $result;
    }

    /**
     * 有効カレンダー全件の events を curl_multi で並列取得し、合算して返す。
     * 各カレンダーは `external_events_cache` に calendar_id 別キーで個別キャッシュされる。
     *
     * @return array<int, array{
     *   id:string, event_id:string, calendar_id:string, color_hex:?string,
     *   start_at:int, end_at:int, all_day:int, title:?string, location:?string, html_link:?string
     * }>
     */
    public function getEvents(string $userId, int $fromTimestamp, int $toTimestamp): array {
        // 1. 有効カレンダー取得
        $stmt = $this->pdo->prepare("
            SELECT id, calendar_id, color_hex
              FROM user_google_calendars
             WHERE user_id = ? AND is_enabled = 1 AND deleted_at IS NULL
             ORDER BY sort_order ASC, id ASC
        ");
        $stmt->execute([$userId]);
        $calendars = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($calendars)) {
            return [];
        }

        // 2. access token を 1 回だけ取得（全カレンダーで共有）
        $accessToken = $this->refreshAccessToken($userId);

        // 3. curl_multi で events.list を並列取得（同時 5）
        $requests = [];
        foreach ($calendars as $cal) {
            $calendarId = $cal['calendar_id'];
            $url = self::CALENDAR_API . '/calendars/' . rawurlencode($calendarId) . '/events?' . http_build_query([
                'timeMin' => gmdate('Y-m-d\TH:i:s\Z', $fromTimestamp),
                'timeMax' => gmdate('Y-m-d\TH:i:s\Z', $toTimestamp),
                'singleEvents' => 'true',
                'orderBy' => 'startTime',
                'maxResults' => 250,
            ]);
            $requests[$calendarId] = [
                'method' => 'GET',
                'url' => $url,
                'options' => ['headers' => ["Authorization: Bearer $accessToken"]],
            ];
        }

        $responses = $this->http->requestMulti($requests, self::MULTI_CONCURRENCY);

        // 4. 結果を正規化＋カレンダー別キャッシュ更新
        $now = time();
        $colorByCalendar = [];
        foreach ($calendars as $cal) {
            $colorByCalendar[$cal['calendar_id']] = $cal['color_hex'];
        }

        $insStmt = $this->pdo->prepare("
            INSERT INTO external_events_cache (id, user_id, calendar_id, event_id, start_at, end_at, all_day, title, location, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                start_at = excluded.start_at,
                end_at = excluded.end_at,
                all_day = excluded.all_day,
                title = excluded.title,
                location = excluded.location,
                fetched_at = excluded.fetched_at
        ");
        $delPerCal = $this->pdo->prepare("
            DELETE FROM external_events_cache
             WHERE user_id = ? AND calendar_id = ? AND start_at >= ? AND start_at < ?
        ");

        $allEvents = [];
        foreach ($responses as $calendarId => $res) {
            if (($res['status'] ?? 0) !== 200) {
                // 個別カレンダーの失敗は warning ログのみ。他のカレンダーは続行
                error_log("GoogleCalendarService::getEvents: events.list failed for $calendarId: " . ($res['body'] ?? ''));
                continue;
            }
            $data = json_decode($res['body'], true);
            $items = $data['items'] ?? [];

            // このカレンダーの該当期間キャッシュを一旦クリア
            $delPerCal->execute([$userId, $calendarId, $fromTimestamp, $toTimestamp]);

            foreach ($items as $item) {
                if (($item['status'] ?? '') === 'cancelled') {
                    continue;
                }
                $eventId = $item['id'] ?? null;
                if (!$eventId) continue;

                $allDay = 0;
                $startAt = 0;
                $endAt = 0;
                if (isset($item['start']['dateTime'])) {
                    $startAt = strtotime($item['start']['dateTime']);
                    $endAt = strtotime($item['end']['dateTime'] ?? $item['start']['dateTime']);
                } elseif (isset($item['start']['date'])) {
                    $allDay = 1;
                    $startAt = strtotime($item['start']['date'] . ' 00:00:00');
                    $endAt = strtotime(($item['end']['date'] ?? $item['start']['date']) . ' 00:00:00');
                } else {
                    continue;
                }

                $rowId = 'google:' . $calendarId . ':' . $eventId;
                $insStmt->execute([
                    $rowId, $userId, $calendarId, $eventId,
                    $startAt, $endAt, $allDay,
                    $item['summary'] ?? null, $item['location'] ?? null, $now,
                ]);

                $allEvents[] = [
                    'id' => $rowId,
                    'event_id' => $eventId,
                    'calendar_id' => $calendarId,
                    'color_hex' => $colorByCalendar[$calendarId] ?? null,
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'all_day' => $allDay,
                    'title' => $item['summary'] ?? null,
                    'location' => $item['location'] ?? null,
                    'html_link' => $item['htmlLink'] ?? null,
                ];
            }
        }

        // 5. last_sync_at 更新
        $this->pdo->prepare("UPDATE user_google_oauth SET last_sync_at = ? WHERE user_id = ?")
            ->execute([$now, $userId]);

        // start_at 昇順で並べ替え
        usort($allEvents, fn($a, $b) => $a['start_at'] <=> $b['start_at']);

        return $allEvents;
    }

    /**
     * カレンダー行の is_enabled を切り替える。user_id でスコープを限定（他テナント保護）。
     * @return bool 更新成功（指定 user_id の行が存在し更新された）なら true、そうでなければ false
     */
    public function updateCalendarEnabled(string $userId, int $rowId, bool $isEnabled): bool {
        $stmt = $this->pdo->prepare("
            UPDATE user_google_calendars
               SET is_enabled = ?, updated_at = ?
             WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$isEnabled ? 1 : 0, time(), $rowId, $userId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * 認証状態（連携済みか・最終同期）を返す。設定画面 UI で使用。
     */
    public function getConnectionStatus(string $userId): ?array {
        $stmt = $this->pdo->prepare("SELECT primary_calendar_email, primary_calendar_id, last_sync_at, created_at FROM user_google_oauth WHERE user_id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        return [
            'connected' => true,
            'email' => $row['primary_calendar_email'],
            'calendar_id' => $row['primary_calendar_id'],
            'last_sync_at' => isset($row['last_sync_at']) ? (int)$row['last_sync_at'] : null,
            'connected_at' => (int)$row['created_at'],
        ];
    }
}
