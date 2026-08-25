<?php
// backend/services/BeaverSyncService.php
// R-153: Beaver案件のdiff/full同期（docs/SPEC/07_Beaver連携.md §3〜§5）
//
// 設計方針:
//   - 照合キーは (tenant_id, 'beaver', external_project_id) のみ。案件名では照合しない
//   - baselineはitems行として生成せず external_project_links に持つ
//   - 同期が触るのはリンクテーブルと、プロジェクトitemの title / due_date / client_name のみ
//   - Beaver到達不能時は既存データを消さず external_sync_state.last_error へ記録して縮退する

require_once __DIR__ . '/CryptoService.php';
require_once __DIR__ . '/HttpClient.php';

class BeaverSyncService {
    public const COOLDOWN_SECONDS = 120;
    public const PAGE_LIMIT = 200;
    public const DEFAULT_EXCLUDED_STATUSES = ['納品済', '完了', '請求済', 'キャンセル'];

    private PDO $pdo;
    private array $config; // [api_base, api_token, tenant_id, excluded_statuses]
    private $http; // HttpClient | FakeHttpClient

    public function __construct(PDO $pdo, array $config, $http = null) {
        foreach (['api_base', 'api_token', 'tenant_id'] as $k) {
            if (empty($config[$k])) {
                throw new \InvalidArgumentException("BeaverSyncService: config['$k'] is required");
            }
        }
        $this->pdo = $pdo;
        $this->config = $config;
        $this->config['excluded_statuses'] = $config['excluded_statuses'] ?? self::DEFAULT_EXCLUDED_STATUSES;
        $this->http = $http ?? new HttpClient();
    }

    /**
     * `.env` から構築する。BEAVER_API_BASE / BEAVER_API_TOKEN / BEAVER_TENANT_ID が
     * 未設定なら null（呼び出し元が503にする。Google連携と同じ縮退パターン）。
     */
    public static function fromEnv(PDO $pdo, $http = null): ?self {
        $base = CryptoService::loadEnvKey('BEAVER_API_BASE');
        $token = CryptoService::loadEnvKey('BEAVER_API_TOKEN');
        $tenantId = CryptoService::loadEnvKey('BEAVER_TENANT_ID');
        if (!$base || !$token || !$tenantId) {
            return null;
        }
        $excluded = CryptoService::loadEnvKey('BEAVER_EXCLUDED_STATUSES');
        return new self($pdo, [
            'api_base' => $base,
            'api_token' => $token,
            'tenant_id' => $tenantId,
            'excluded_statuses' => $excluded !== null
                ? array_values(array_filter(array_map('trim', explode(',', $excluded)), fn($s) => $s !== ''))
                : self::DEFAULT_EXCLUDED_STATUSES,
        ], $http);
    }

    public function getTenantId(): string {
        return $this->config['tenant_id'];
    }

    public function getExcludedStatuses(): array {
        return $this->config['excluded_statuses'];
    }

    /** 除外は順序依存ではなく明示リストで判定。未知の値は除外しない（負荷に含める） */
    public function isExcludedStatus(?string $status): bool {
        return $status !== null && in_array($status, $this->config['excluded_statuses'], true);
    }

    public function getSyncState(): array {
        $stmt = $this->pdo->prepare("SELECT last_updated_after, last_synced_at, last_error FROM external_sync_state WHERE tenant_id = ? AND source_system = 'beaver'");
        $stmt->execute([$this->getTenantId()]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return [
            'last_updated_after' => $row['last_updated_after'] ?? null,
            'last_synced_at' => isset($row['last_synced_at']) && $row['last_synced_at'] !== null ? (int)$row['last_synced_at'] : null,
            'last_error' => $row['last_error'] ?? null,
        ];
    }

    /**
     * §5.1: diff/full同期。force=false かつ前回成功同期から120秒以内なら実行せずスキップ。
     */
    public function sync(string $mode, bool $force, string $userId): array {
        $state = $this->getSyncState();
        if (!$force && $state['last_synced_at'] !== null && (time() - $state['last_synced_at']) < self::COOLDOWN_SECONDS) {
            return [
                'synced' => 0, 'created' => 0, 'updated' => 0,
                'skipped' => true, 'last_synced_at' => $state['last_synced_at'], 'error' => null,
            ];
        }

        // 全ページ取得（next_cursor がnullになるまで）
        $projects = [];
        $cursor = null;
        do {
            $params = ['limit' => self::PAGE_LIMIT];
            if ($mode === 'diff' && $state['last_updated_after'] !== null) {
                $params['updated_after'] = $state['last_updated_after'];
            }
            if ($cursor !== null) {
                $params['cursor'] = $cursor;
            }
            $url = rtrim($this->config['api_base'], '/') . '/integrations/youkan/projects?' . http_build_query($params);
            try {
                $res = $this->http->request('GET', $url, [
                    'headers' => ['Authorization: Bearer ' . $this->config['api_token']],
                ]);
            } catch (\Throwable $e) {
                return $this->failSync('Beaver到達不能: ' . $e->getMessage(), $state);
            }
            if ($res['status'] !== 200) {
                return $this->failSync('Beaver API HTTP ' . $res['status'], $state);
            }
            $body = json_decode($res['body'], true);
            if (!is_array($body) || !isset($body['data']) || !is_array($body['data'])) {
                return $this->failSync('Beaver APIの応答形式が不正', $state);
            }
            foreach ($body['data'] as $p) {
                $projects[] = $p;
            }
            $cursor = $body['next_cursor'] ?? null;
        } while ($cursor !== null);

        $created = 0;
        $updated = 0;
        $maxUpdatedAt = $state['last_updated_after'];
        $seenIds = [];

        $this->pdo->beginTransaction();
        try {
            foreach ($projects as $p) {
                if (!isset($p['external_project_id'])) {
                    continue;
                }
                $seenIds[] = (string)$p['external_project_id'];
                $result = $this->upsertProject($p, $userId);
                if ($result === 'created') $created++;
                if ($result === 'updated') $updated++;
                $u = $p['updated_at'] ?? null;
                if (is_string($u) && ($maxUpdatedAt === null || strcmp($u, $maxUpdatedAt) > 0)) {
                    $maxUpdatedAt = $u;
                }
            }

            // fullのみが欠落を検知できる: 応答に含まれなかった既知リンクを missing_upstream にする
            if ($mode === 'full') {
                $placeholders = empty($seenIds) ? "''" : implode(',', array_fill(0, count($seenIds), '?'));
                $sql = "UPDATE external_project_links SET sync_state = 'missing_upstream'
                        WHERE tenant_id = ? AND source_system = 'beaver' AND external_project_id NOT IN ($placeholders)";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute(array_merge([$this->getTenantId()], $seenIds));
            }

            $now = time();
            $this->pdo->prepare("
                INSERT INTO external_sync_state (tenant_id, source_system, last_updated_after, last_synced_at, last_error)
                VALUES (?, 'beaver', ?, ?, NULL)
                ON CONFLICT(tenant_id, source_system) DO UPDATE SET
                    last_updated_after = excluded.last_updated_after,
                    last_synced_at = excluded.last_synced_at,
                    last_error = NULL
            ")->execute([$this->getTenantId(), $maxUpdatedAt, $now]);

            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            return $this->failSync('同期処理エラー: ' . $e->getMessage(), $state);
        }

        return [
            'synced' => count($projects), 'created' => $created, 'updated' => $updated,
            'skipped' => false, 'last_synced_at' => $now, 'error' => null,
        ];
    }

    private function failSync(string $error, array $state): array {
        $this->pdo->prepare("
            INSERT INTO external_sync_state (tenant_id, source_system, last_updated_after, last_synced_at, last_error)
            VALUES (?, 'beaver', ?, ?, ?)
            ON CONFLICT(tenant_id, source_system) DO UPDATE SET last_error = excluded.last_error
        ")->execute([$this->getTenantId(), $state['last_updated_after'], $state['last_synced_at'], $error]);
        error_log("[R-153] Beaver sync failed: $error");
        return [
            'synced' => 0, 'created' => 0, 'updated' => 0,
            'skipped' => false, 'last_synced_at' => $state['last_synced_at'], 'error' => $error,
        ];
    }

    /**
     * Beaver単体GET（capacity-checkの判定前再取得用）。
     * @return array{ok: bool, status: ?int, project: ?array, error: ?string}
     */
    public function fetchProject(int $externalProjectId): array {
        $url = rtrim($this->config['api_base'], '/') . '/integrations/youkan/projects/' . $externalProjectId;
        try {
            $res = $this->http->request('GET', $url, [
                'headers' => ['Authorization: Bearer ' . $this->config['api_token']],
            ]);
        } catch (\Throwable $e) {
            return ['ok' => false, 'status' => null, 'project' => null, 'error' => $e->getMessage()];
        }
        if ($res['status'] === 200) {
            $body = json_decode($res['body'], true);
            if (is_array($body) && isset($body['external_project_id'])) {
                return ['ok' => true, 'status' => 200, 'project' => $body, 'error' => null];
            }
            return ['ok' => false, 'status' => 200, 'project' => null, 'error' => '応答形式が不正'];
        }
        return ['ok' => false, 'status' => $res['status'], 'project' => null, 'error' => 'HTTP ' . $res['status']];
    }

    /**
     * §5.2: 案件1件のupsert。冪等（同じ案件を何度同期してもプロジェクトは増えない）。
     * @return string 'created' | 'updated' | 'skipped_excluded'
     */
    public function upsertProject(array $p, string $userId): string {
        $tenantId = $this->getTenantId();
        $extId = (string)$p['external_project_id'];
        $status = $p['status'] ?? null;
        $baselineMinutes = isset($p['baseline_hours']) && $p['baseline_hours'] !== null
            ? (int)round((float)$p['baseline_hours'] * 60)
            : null;
        $now = time();

        $stmt = $this->pdo->prepare("SELECT * FROM external_project_links WHERE tenant_id = ? AND source_system = 'beaver' AND external_project_id = ?");
        $stmt->execute([$tenantId, $extId]);
        $link = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$link) {
            // 除外ステータスの新規案件は取り込まない（過去の完了・キャンセル案件の大量取り込み防止）
            if ($this->isExcludedStatus($status)) {
                return 'skipped_excluded';
            }
            // プロジェクトitemを新規作成（ProjectControllerの作成慣習に合わせる）
            $projId = uniqid('prj-', true);
            $meta = json_encode([
                'settings' => ['type' => 'general'],
                'dxf_config' => [],
                'view_mode' => 'internal',
                'color' => 'blue',
            ]);
            $this->pdo->prepare("
                INSERT INTO items (id, tenant_id, title, project_type, client_name, meta, status, created_at, updated_at, created_by, assigned_to, due_date, is_project)
                VALUES (?, ?, ?, 'general', ?, ?, 'inbox', ?, ?, ?, ?, ?, 1)
            ")->execute([
                $projId, $tenantId, $p['name'] ?? "Beaver案件 $extId",
                $p['customer_name'] ?? '', $meta, $now, $now, $userId, $userId,
                $p['delivery_date'] ?? null,
            ]);
            $this->pdo->prepare("
                INSERT INTO external_project_links (
                    id, tenant_id, source_system, external_project_id, youkan_project_id,
                    source_name, source_code, source_customer_name, source_status, source_delivery_date,
                    baseline_minutes, baseline_source, baseline_updated_at, source_updated_at,
                    sync_state, last_synced_at, created_at
                ) VALUES (?, ?, 'beaver', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', ?, ?)
            ")->execute([
                uniqid('epl-', true), $tenantId, $extId, $projId,
                $p['name'] ?? null, $p['project_code'] ?? null, $p['customer_name'] ?? null,
                $status, $p['delivery_date'] ?? null,
                $baselineMinutes, $p['baseline_source'] ?? ($baselineMinutes === null ? 'none' : 'manual'),
                $p['baseline_updated_at'] ?? null, $p['updated_at'] ?? null,
                $now, $now,
            ]);
            return 'created';
        }

        // リンク先プロジェクトの状態確認（ゴミ箱内なら target_missing。再作成しない＝増殖防止）
        $stmt = $this->pdo->prepare("SELECT id, deleted_at FROM items WHERE id = ?");
        $stmt->execute([$link['youkan_project_id']]);
        $proj = $stmt->fetch(PDO::FETCH_ASSOC);
        $syncState = (!$proj || $proj['deleted_at'] !== null) ? 'target_missing' : 'ok';

        $this->pdo->prepare("
            UPDATE external_project_links SET
                source_name = ?, source_code = ?, source_customer_name = ?, source_status = ?, source_delivery_date = ?,
                baseline_minutes = ?, baseline_source = ?, baseline_updated_at = ?, source_updated_at = ?,
                sync_state = ?, last_synced_at = ?
            WHERE id = ?
        ")->execute([
            $p['name'] ?? null, $p['project_code'] ?? null, $p['customer_name'] ?? null,
            $status, $p['delivery_date'] ?? null,
            $baselineMinutes, $p['baseline_source'] ?? ($baselineMinutes === null ? 'none' : 'manual'),
            $p['baseline_updated_at'] ?? null, $p['updated_at'] ?? null,
            $syncState, $now, $link['id'],
        ]);

        if ($syncState === 'ok') {
            // Beaverが正本のカラムのみ上書き。子タスク・meta・その他ユーザー編集には一切触れない
            $this->pdo->prepare("UPDATE items SET title = COALESCE(?, title), due_date = ?, client_name = ?, updated_at = ? WHERE id = ?")
                ->execute([
                    $p['name'] ?? null, $p['delivery_date'] ?? null, $p['customer_name'] ?? '',
                    $now, $link['youkan_project_id'],
                ]);
        }
        return 'updated';
    }
}
