<?php
// backend/GoogleCalendarController.php
// R-034 Phase 2: Google カレンダー連携 API
//
// エンドポイント:
//   POST   /api/google/oauth/start       → { authUrl }
//   GET    /api/google/oauth/callback    → トークン交換、リダイレクト
//   GET    /api/google/oauth/status      → 連携状態
//   DELETE /api/google/oauth             → 連携解除
//   POST   /api/google/calendar/refresh  → 手動更新（60 秒クールダウン）
//   GET    /api/google/calendar/events   → キャッシュから期間取得
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/services/CryptoService.php';
require_once __DIR__ . '/services/GoogleCalendarService.php';

class GoogleCalendarController extends BaseController {
    protected GoogleCalendarService $service;

    public const REFRESH_COOLDOWN_SEC = 60;

    public function __construct() {
        parent::__construct();
        // 環境変数が未設定でもクラスロード自体は通すため、メソッド呼び出し時に遅延初期化
        $this->service = $this->buildService();
    }

    protected function buildService(): GoogleCalendarService {
        return GoogleCalendarService::fromEnv($this->pdo);
    }

    // --- エンドポイントハンドラ ---

    /** POST /google/oauth/start */
    public function oauthStart(): void {
        $this->authenticate();
        // CSRF 対策: ランダム state を発行し、セッションまたは短命キャッシュに保存。
        // Youkan はステートレスなため、user_id を HMAC で署名した state を発行する。
        $state = $this->signState($this->currentUserId);
        $url = $this->service->getAuthorizationUrl($state);
        $this->sendJSON(['authUrl' => $url]);
    }

    /** GET /google/oauth/callback?code=...&state=... */
    public function oauthCallback(): void {
        $code = $_GET['code'] ?? null;
        $state = $_GET['state'] ?? null;
        $error = $_GET['error'] ?? null;

        if ($error) {
            $this->renderHtmlClose("Google 認証がキャンセルされました: " . htmlspecialchars($error));
            return;
        }
        if (!$code || !$state) {
            $this->sendError(400, 'code と state が必要です');
        }

        $userId = $this->verifyState($state);
        if (!$userId) {
            $this->sendError(400, 'state が無効です');
        }

        try {
            $result = $this->service->exchangeCodeForTokens($userId, $code);
        } catch (\Throwable $e) {
            error_log('OAuth callback failed: ' . $e->getMessage());
            $this->renderHtmlClose("Google 連携に失敗しました: " . htmlspecialchars($e->getMessage()));
            return;
        }

        // 連携完了画面 → window を閉じる or 設定画面へ戻る
        $this->renderHtmlClose("Google カレンダー連携が完了しました（{$result['email']}）", true);
    }

    /** GET /google/oauth/status */
    public function status(): void {
        $this->authenticate();
        $info = $this->service->getConnectionStatus($this->currentUserId);
        if (!$info) {
            $this->sendJSON(['connected' => false]);
            return;
        }
        $this->sendJSON($info);
    }

    /** DELETE /google/oauth */
    public function revoke(): void {
        $this->authenticate();
        $this->service->revoke($this->currentUserId);
        $this->sendJSON(['success' => true]);
    }

    /** POST /google/calendar/refresh */
    public function refresh(): void {
        $this->authenticate();

        // クールダウンチェック
        $stmt = $this->pdo->prepare("SELECT last_sync_at FROM user_google_oauth WHERE user_id = ?");
        $stmt->execute([$this->currentUserId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            $this->sendError(404, 'Google カレンダーが未連携です');
        }
        $lastSync = (int)($row['last_sync_at'] ?? 0);
        $now = time();
        if ($lastSync > 0 && ($now - $lastSync) < self::REFRESH_COOLDOWN_SEC) {
            $remaining = self::REFRESH_COOLDOWN_SEC - ($now - $lastSync);
            $this->sendError(429, "更新クールダウン中です（あと {$remaining} 秒）");
        }

        // 期間: 今月 ± 1 ヶ月
        $from = isset($_GET['from']) ? strtotime($_GET['from']) : strtotime('-1 month');
        $to = isset($_GET['to']) ? strtotime($_GET['to'] . ' 23:59:59') : strtotime('+2 months');

        try {
            $events = $this->service->fetchEvents($this->currentUserId, $from, $to);
        } catch (\Throwable $e) {
            error_log('refresh failed: ' . $e->getMessage());
            $this->sendError(500, 'Google から取得に失敗: ' . $e->getMessage());
        }

        $this->sendJSON([
            'success' => true,
            'count' => count($events),
            'synced_at' => time(),
        ]);
    }

    /** GET /google/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD */
    public function getEvents(): void {
        $this->authenticate();
        $from = isset($_GET['from']) ? strtotime($_GET['from'] . ' 00:00:00') : strtotime('today');
        $to = isset($_GET['to']) ? strtotime($_GET['to'] . ' 23:59:59') : strtotime('+30 days');

        if ($from === false || $to === false) {
            $this->sendError(400, 'from / to は YYYY-MM-DD 形式で指定してください');
        }

        $events = $this->service->getCachedEvents($this->currentUserId, $from, $to);
        $this->sendJSON([
            'events' => $events,
            'from' => date('Y-m-d', $from),
            'to' => date('Y-m-d', $to),
        ]);
    }

    // --- state 署名（CSRF 対策の最小実装）---

    private function signState(string $userId): string {
        $nonce = bin2hex(random_bytes(8));
        $ts = (string)time();
        $payload = "$userId|$ts|$nonce";
        $sig = hash_hmac('sha256', $payload, $this->getStateSecret());
        return base64_encode($payload . '|' . $sig);
    }

    private function verifyState(string $state): ?string {
        $raw = base64_decode($state, true);
        if (!$raw) return null;
        $parts = explode('|', $raw);
        if (count($parts) !== 4) return null;
        [$userId, $ts, $nonce, $sig] = $parts;
        $expected = hash_hmac('sha256', "$userId|$ts|$nonce", $this->getStateSecret());
        if (!hash_equals($expected, $sig)) return null;
        // 10 分以内のみ有効
        if (time() - (int)$ts > 600) return null;
        return $userId;
    }

    private function getStateSecret(): string {
        $val = CryptoService::loadEnvKey('YOUKAN_ENCRYPTION_KEY');
        return $val ?? 'fallback-state-secret';
    }

    private function renderHtmlClose(string $message, bool $success = false): void {
        header('Content-Type: text/html; charset=UTF-8');
        $color = $success ? '#2e7d32' : '#c62828';
        $msg = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        echo "<!doctype html><html lang=ja><head><meta charset=utf-8><title>Google 連携</title></head><body style=\"font-family:sans-serif;text-align:center;padding:48px;background:#fafafa\"><h2 style=\"color:$color\">$msg</h2><p>このウィンドウを閉じて Youkan に戻ってください。</p><script>setTimeout(function(){window.close();}, 2000);</script></body></html>";
        exit;
    }
}
