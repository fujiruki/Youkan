<?php
/**
 * R-153 Beaver同期テスト（docs/SPEC/07_Beaver連携.md §4・§5）
 *
 * 受け入れ条件:
 * (a) 同じ external_project_id を2回同期してもプロジェクト・リンクが増えない
 * (b) baseline がitems行として生成されない（同期後のitemsはプロジェクト1行のみ）
 * (e) 同期がYoukan側の子タスク・タイトル以外のitemsカラム・metaを変更しない
 * (g) Beaver到達不能時に既存リンク・プロジェクトが消えず、last_errorが記録され、応答が縮退する
 * 追加: 除外ステータスの新規案件はリンク作成されない／fullで消えた案件が missing_upstream になる／
 *       クールダウン中の force=false がスキップされる／除外判定はリスト照合
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r153_sync_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../services/BeaverSyncService.php';
require_once __DIR__ . '/../IntegrationController.php';
require_once __DIR__ . '/../JWTService.php';
require_once __DIR__ . '/helpers/FakeHttpClient.php';

$passed = 0;
$failed = 0;
function assert_true($label, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label" . ($detail !== '' ? " ($detail)" : '') . "\n"; $failed++; }
}

function bvrProject(int $id, array $over = []): array {
    return array_merge([
        'source' => 'beaver',
        'external_project_id' => $id,
        'project_code' => sprintf('P%05d', $id),
        'name' => "案件{$id}",
        'customer_name' => "顧客{$id}",
        'status' => '受注済',
        'delivery_date' => '2026-09-10',
        'baseline_hours' => 20.0,
        'baseline_source' => 'manual',
        'baseline_updated_at' => '2026-08-25T09:00:00+09:00',
        'updated_at' => '2026-08-25T09:00:00+09:00',
    ], $over);
}

// --- データ準備 ---
$pdo = getDB();
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_bvr', '建具テナント', 0)");
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_a', 'a@example.com', password_hash('pw', PASSWORD_DEFAULT), 'A']);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_out', 'out@example.com', password_hash('pw', PASSWORD_DEFAULT), '部外者']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at, is_core) VALUES ('u_a', 't_bvr', 'owner', 0, 1)");
$pdo->exec("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES ('tok_out', 'u_out', 'sk_out', '部外者', 0)");

$config = [
    'api_base' => 'http://beaver.test',
    'api_token' => 'tkn',
    'tenant_id' => 't_bvr',
    'excluded_statuses' => BeaverSyncService::DEFAULT_EXCLUDED_STATUSES,
];

$countProjects = fn() => (int)$pdo->query("SELECT COUNT(*) FROM items WHERE tenant_id = 't_bvr' AND is_project = 1")->fetchColumn();
$countItems = fn() => (int)$pdo->query("SELECT COUNT(*) FROM items WHERE tenant_id = 't_bvr'")->fetchColumn();
$countLinks = fn() => (int)$pdo->query("SELECT COUNT(*) FROM external_project_links WHERE tenant_id = 't_bvr'")->fetchColumn();
$getLink = function ($extId) use ($pdo) {
    $stmt = $pdo->prepare("SELECT * FROM external_project_links WHERE tenant_id = 't_bvr' AND source_system = 'beaver' AND external_project_id = ?");
    $stmt->execute([(string)$extId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
};

echo "\n=== テスト1: 初回full同期（受注済1件＋除外1件） ===\n";
$http = new FakeHttpClient();
$svc = new BeaverSyncService($pdo, $config, $http);
$http->enqueue(200, ['data' => [
    bvrProject(901),
    bvrProject(902, ['status' => '納品済']),
], 'next_cursor' => null]);
$res = $svc->sync('full', true, 'u_a');
assert_true('created=1（除外案件は作られない）', ($res['created'] ?? null) === 1, json_encode($res, JSON_UNESCAPED_UNICODE));
assert_true('synced=2', ($res['synced'] ?? null) === 2);
assert_true('error=null', array_key_exists('error', $res) && $res['error'] === null);
assert_true('skipped=false', ($res['skipped'] ?? null) === false);
assert_true('(b) itemsはプロジェクト1行のみ（baselineはitems行にならない）', $countItems() === 1 && $countProjects() === 1, 'items=' . $countItems());
assert_true('リンクは1件のみ（除外案件のリンクなし）', $countLinks() === 1);
$link = $getLink(901);
assert_true('リンクにBeaver由来値が入る', $link !== null && $link['source_name'] === '案件901' && $link['source_status'] === '受注済' && (int)$link['baseline_minutes'] === 1200 && $link['baseline_source'] === 'manual' && $link['source_delivery_date'] === '2026-09-10', json_encode($link, JSON_UNESCAPED_UNICODE));
assert_true('sync_state=ok', ($link['sync_state'] ?? null) === 'ok');
$proj = $pdo->query("SELECT * FROM items WHERE id = " . $pdo->quote($link['youkan_project_id']))->fetch(PDO::FETCH_ASSOC);
assert_true('プロジェクトitemの内容（title/due_date/client_name/created_by）', $proj !== null && $proj['title'] === '案件901' && $proj['due_date'] === '2026-09-10' && $proj['client_name'] === '顧客901' && $proj['created_by'] === 'u_a' && (int)$proj['is_project'] === 1, json_encode($proj, JSON_UNESCAPED_UNICODE));
assert_true('除外案件902のリンク・itemは作られない', $getLink(902) === null);
$state = $svc->getSyncState();
assert_true('last_updated_after=最大updated_at', ($state['last_updated_after'] ?? null) === '2026-08-25T09:00:00+09:00', json_encode($state));
assert_true('last_synced_at が入る・last_error=null', !empty($state['last_synced_at']) && $state['last_error'] === null);

echo "\n=== テスト2: (a) 同じ案件の再同期で増殖しない ===\n";
$http->enqueue(200, ['data' => [bvrProject(901)], 'next_cursor' => null]);
$res = $svc->sync('full', true, 'u_a');
assert_true('updated=1 / created=0', ($res['updated'] ?? null) === 1 && ($res['created'] ?? null) === 0, json_encode($res));
assert_true('プロジェクト・リンクが増えない', $countProjects() === 1 && $countLinks() === 1);

echo "\n=== テスト3: (e) 同期はtitle/due_date/client_nameのみ更新し、ユーザー編集に触れない ===\n";
$projId = $link['youkan_project_id'];
$pdo->exec("UPDATE items SET meta = '{\"settings\":{\"type\":\"general\"},\"color\":\"red\"}', memo = 'ユーザーメモ', estimated_minutes = 999, assigned_to = 'u_a' WHERE id = " . $pdo->quote($projId));
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, project_id, estimated_minutes, created_at, updated_at) VALUES ('child_1', 't_bvr', '子タスク', 'todo', 'u_a', ?, 120, 0, 0)")->execute([$projId]);
$http->enqueue(200, ['data' => [bvrProject(901, [
    'name' => '案件901改',
    'delivery_date' => '2026-09-20',
    'customer_name' => '顧客901改',
    'baseline_hours' => 22.5,
    'updated_at' => '2026-08-26T09:00:00+09:00',
])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_a');
$proj = $pdo->query("SELECT * FROM items WHERE id = " . $pdo->quote($projId))->fetch(PDO::FETCH_ASSOC);
assert_true('title/due_date/client_nameはBeaver値で上書き', $proj['title'] === '案件901改' && $proj['due_date'] === '2026-09-20' && $proj['client_name'] === '顧客901改', json_encode($proj, JSON_UNESCAPED_UNICODE));
assert_true('meta/memo/estimated_minutes/assigned_toは変更されない', $proj['meta'] === '{"settings":{"type":"general"},"color":"red"}' && $proj['memo'] === 'ユーザーメモ' && (int)$proj['estimated_minutes'] === 999 && $proj['assigned_to'] === 'u_a', json_encode($proj, JSON_UNESCAPED_UNICODE));
$child = $pdo->query("SELECT * FROM items WHERE id = 'child_1'")->fetch(PDO::FETCH_ASSOC);
assert_true('子タスクは触られない', $child !== null && $child['title'] === '子タスク' && (int)$child['estimated_minutes'] === 120);
$link = $getLink(901);
assert_true('baseline_minutes=22.5h→1350分（四捨五入）', (int)$link['baseline_minutes'] === 1350);
$state = $svc->getSyncState();
assert_true('last_updated_afterが前進する', ($state['last_updated_after'] ?? null) === '2026-08-26T09:00:00+09:00', json_encode($state));

echo "\n=== テスト4: ページング（next_cursor） ===\n";
$http->enqueue(200, ['data' => [bvrProject(903)], 'next_cursor' => 903]);
$http->enqueue(200, ['data' => [bvrProject(904)], 'next_cursor' => null]);
$callsBefore = count($http->calls);
$res = $svc->sync('full', true, 'u_a');
assert_true('2ページで synced=2 / created=2', ($res['synced'] ?? null) === 2 && ($res['created'] ?? null) === 2, json_encode($res));
assert_true('2回目のリクエストURLに cursor=903', strpos($http->calls[$callsBefore + 1]['url'] ?? '', 'cursor=903') !== false, json_encode(array_column($http->calls, 'url')));

echo "\n=== テスト5: diff同期は updated_after を付ける ===\n";
$http->enqueue(200, ['data' => [], 'next_cursor' => null]);
$svc->sync('diff', true, 'u_a');
$lastUrl = end($http->calls)['url'];
assert_true('URLに updated_after（前回の最大updated_at）', strpos($lastUrl, 'updated_after=') !== false && strpos($lastUrl, rawurlencode('2026-08-26T09:00:00+09:00')) !== false, $lastUrl);
assert_true('Authorizationヘッダー', in_array('Authorization: Bearer tkn', end($http->calls)['options']['headers'] ?? [], true));

echo "\n=== テスト6: クールダウン（force=false・120秒以内はスキップ） ===\n";
$callsBefore = count($http->calls);
$res = $svc->sync('diff', false, 'u_a');
assert_true('skipped=true', ($res['skipped'] ?? null) === true, json_encode($res));
assert_true('HTTP呼び出しなし', count($http->calls) === $callsBefore);
assert_true('last_synced_atを返す', !empty($res['last_synced_at']));
$http->enqueue(200, ['data' => [], 'next_cursor' => null]);
$res = $svc->sync('diff', true, 'u_a');
assert_true('force=trueは常に実行', ($res['skipped'] ?? null) === false && count($http->calls) === $callsBefore + 1);

echo "\n=== テスト7: fullで消えた案件は missing_upstream（削除しない） ===\n";
$http->enqueue(200, ['data' => [bvrProject(903)], 'next_cursor' => null]); // 901,904が応答から消えた
$svc->sync('full', true, 'u_a');
assert_true('901が missing_upstream', ($getLink(901)['sync_state'] ?? null) === 'missing_upstream');
assert_true('904も missing_upstream', ($getLink(904)['sync_state'] ?? null) === 'missing_upstream');
assert_true('903は ok のまま', ($getLink(903)['sync_state'] ?? null) === 'ok');
assert_true('プロジェクト・子タスクは削除されない', $countProjects() === 3 && $pdo->query("SELECT COUNT(*) FROM items WHERE id = 'child_1'")->fetchColumn() == 1);
$http->enqueue(200, ['data' => [bvrProject(901, ['updated_at' => '2026-08-27T09:00:00+09:00'])], 'next_cursor' => null]);
$svc->sync('diff', true, 'u_a');
assert_true('再出現した901は ok に戻る（diffでは903/904は触らない）', ($getLink(901)['sync_state'] ?? null) === 'ok' && ($getLink(904)['sync_state'] ?? null) === 'missing_upstream');

echo "\n=== テスト8: (g) Beaver到達不能時の縮退 ===\n";
$linksBefore = $countLinks();
$projectsBefore = $countProjects();
$res = $svc->sync('full', true, 'u_a'); // キューが空 → FakeHttpClientが例外を投げる＝到達不能
assert_true('errorが返る', !empty($res['error']), json_encode($res));
assert_true('synced=0', ($res['synced'] ?? null) === 0);
assert_true('既存リンク・プロジェクトが消えない', $countLinks() === $linksBefore && $countProjects() === $projectsBefore);
$state = $svc->getSyncState();
assert_true('last_errorが記録される', !empty($state['last_error']), json_encode($state));
assert_true('sync_stateは変更されない（missing_upstream化しない）', ($getLink(903)['sync_state'] ?? null) === 'ok');
$http->enqueue(500, ['error' => 'boom']);
$res = $svc->sync('full', true, 'u_a');
assert_true('HTTP 500でも縮退（データ維持・error返却）', !empty($res['error']) && $countLinks() === $linksBefore);
$http->enqueue(200, ['data' => [], 'next_cursor' => null]);
$svc->sync('diff', true, 'u_a');
assert_true('成功で last_error がクリアされる', $svc->getSyncState()['last_error'] === null);

echo "\n=== テスト9: 除外ステータスへの変化でも削除しない ===\n";
$http->enqueue(200, ['data' => [bvrProject(903, ['status' => 'キャンセル', 'updated_at' => '2026-08-28T09:00:00+09:00'])], 'next_cursor' => null]);
$svc->sync('diff', true, 'u_a');
$link903 = $getLink(903);
assert_true('リンクは残り source_status が更新される', $link903 !== null && $link903['source_status'] === 'キャンセル');
assert_true('プロジェクトはアーカイブ・削除されない', $countProjects() === 3);

echo "\n=== テスト10: ゴミ箱入りプロジェクトは target_missing（再作成しない） ===\n";
$link904 = $getLink(904);
$pdo->exec("UPDATE items SET deleted_at = 100 WHERE id = " . $pdo->quote($link904['youkan_project_id']));
$http->enqueue(200, ['data' => [bvrProject(904, ['name' => '案件904改', 'updated_at' => '2026-08-29T09:00:00+09:00'])], 'next_cursor' => null]);
$svc->sync('diff', true, 'u_a');
$link904 = $getLink(904);
assert_true('sync_state=target_missing', ($link904['sync_state'] ?? null) === 'target_missing');
assert_true('プロジェクトは再作成されない', $countProjects() === 3);
$trashed = $pdo->query("SELECT title FROM items WHERE id = " . $pdo->quote($link904['youkan_project_id']))->fetchColumn();
assert_true('ゴミ箱内itemは更新されない', $trashed === '案件904');

echo "\n=== テスト11: 除外判定はリスト照合（順序に依存しない） ===\n";
assert_true('既定リストは 納品済/完了/請求済/キャンセル', BeaverSyncService::DEFAULT_EXCLUDED_STATUSES === ['納品済', '完了', '請求済', 'キャンセル']);
assert_true('請求済は除外', $svc->isExcludedStatus('請求済') === true);
assert_true('進行中は除外しない', $svc->isExcludedStatus('進行中') === false);
assert_true('未知ステータスは除外しない（負荷に含める）', $svc->isExcludedStatus('謎の新ステータス') === false);
$svcCustom = new BeaverSyncService($pdo, array_merge($config, ['excluded_statuses' => ['独自完了']]), $http);
assert_true('envで上書きしたリストが使われる', $svcCustom->isExcludedStatus('独自完了') === true && $svcCustom->isExcludedStatus('納品済') === false);

echo "\n=== テスト12: コントローラの認証・403・503 ===\n";
class ApiError extends Exception {
    public $payload;
    public function __construct($code, $payload) { parent::__construct(is_array($payload) ? ($payload['error'] ?? '') : $payload, $code); $this->payload = is_array($payload) ? $payload : ['error' => $payload]; }
}
class TestIntegrationController extends IntegrationController {
    public $lastResponse = null;
    public $input = [];
    public static $service = null;
    protected function sendJSON($data) { $this->lastResponse = $data; }
    protected function sendError($code, $message) { throw new ApiError($code, $message); }
    protected function sendErrorJson(int $code, array $payload) { throw new ApiError($code, $payload); }
    protected function getInput() { return $this->input; }
    protected function makeBeaverSyncService(): ?BeaverSyncService { return self::$service; }
}
function callBeaver($method, $path, array $input = []) {
    $_GET = [];
    $ctrl = new TestIntegrationController();
    $ctrl->input = $input;
    try {
        $ctrl->handleRequest($method, $path);
        return [200, $ctrl->lastResponse];
    } catch (ApiError $e) {
        return [$e->getCode(), $e->payload];
    }
}
$_COOKIE = [];
TestIntegrationController::$service = $svc;
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . JWTService::encrypt(['sub' => 'u_a', 'tenant_id' => 't_bvr', 'role' => 'owner', 'exp' => time() + 3600]);
$http->enqueue(200, ['data' => [], 'next_cursor' => null]);
[$code, $res] = callBeaver('POST', '/beaver/sync', ['mode' => 'full', 'force' => true]);
assert_true('メンバーのsyncは200', $code === 200 && array_key_exists('synced', $res ?? []), "code=$code " . json_encode($res));
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_out';
[$code] = callBeaver('POST', '/beaver/sync', ['mode' => 'diff']);
assert_true('対象テナント非所属は403', $code === 403, "code=$code");
[$code] = callBeaver('GET', '/beaver/overview');
assert_true('overviewも非所属は403', $code === 403, "code=$code");
TestIntegrationController::$service = null; // .env未設定相当
[$code] = callBeaver('POST', '/beaver/sync', []);
assert_true('.env未設定は503', $code === 503, "code=$code");
[$code] = callBeaver('GET', '/beaver/overview');
assert_true('overviewも503', $code === 503, "code=$code");
[$code] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 1]);
assert_true('capacity-checkも503', $code === 503, "code=$code");

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
