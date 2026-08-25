<?php
/**
 * R-153 負荷モデル（§6）・EDF仮想充当（§7）・capacity-check API（契約）テスト
 *
 * 受け入れ条件:
 * (c) 子分解が基準未満/超過の両ケースで effective_total = max(baseline, 分解済み合計)
 * (d) 日付未配置の仕事量（仮想残量＋日付なしタスク）がcapacity-check結果に反映される
 *     （納期に入らないケースで feasible=false・shortage>0）
 * (f) 除外ステータスでbaseline負荷が0になり、Youkan側の通常タスク負荷は残る
 * 契約: Beaver再取得失敗時は前回同期値で200＋message注記、リンクなしなら502、
 *       Beaver 404はreason=not_found、除外新規はreason=excluded_status
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r153_cap_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../services/BeaverSyncService.php';
require_once __DIR__ . '/../services/BeaverCapacityService.php';
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

$TODAY = '2026-08-24'; // 月曜。会社キャパは平日480分・土日0（core 1名・profileなし）

// --- データ準備 ---
$pdo = getDB();
foreach (['t_cap', 't_cap2', 't_cap3'] as $t) {
    $pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('$t', '$t', 0)");
}
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_cap', 'cap@example.com', password_hash('pw', PASSWORD_DEFAULT), 'キャパ太郎']);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_out', 'out@example.com', password_hash('pw', PASSWORD_DEFAULT), '部外者']);
foreach (['t_cap', 't_cap2', 't_cap3'] as $t) {
    $pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at, is_core, daily_capacity_minutes) VALUES ('u_cap', '$t', 'owner', 0, 1, 480)");
}
$pdo->exec("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES ('tok_cap', 'u_cap', 'sk_cap', 'B2', 0)");
$pdo->exec("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES ('tok_out', 'u_out', 'sk_out2', '部外者', 0)");

$insItem = $pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, is_project, project_id, parent_id, estimated_minutes, due_date, created_at, updated_at) VALUES (?,?,?,?,'u_cap',?,?,?,?,?,0,0)");
$item = function ($id, $tenant, $title, $status, $isProject, $projectId, $parentId, $est, $due) use ($insItem) {
    $insItem->execute([$id, $tenant, $title, $status, $isProject, $projectId, $parentId, $est, $due]);
};
$insLink = $pdo->prepare("INSERT INTO external_project_links (id, tenant_id, source_system, external_project_id, youkan_project_id, source_name, source_status, source_delivery_date, baseline_minutes, baseline_source, sync_state, last_synced_at, created_at) VALUES (?,?,'beaver',?,?,?,?,?,?,?,'ok',0,0)");
$link = function ($id, $tenant, $extId, $projId, $name, $status, $delivery, $baselineMin) use ($insLink) {
    $insLink->execute([$id, $tenant, (string)$extId, $projId, $name, $status, $delivery, $baselineMin, $baselineMin === null ? 'none' : 'manual']);
};

// S1（t_cap）: 仮想残量のみ・納期に入らない
$item('prj_101', 't_cap', '案件101', 'inbox', 1, null, null, 0, null);
$link('l_101', 't_cap', 101, 'prj_101', '案件101', '受注済', '2026-08-26', 1800);
$pdo->exec("INSERT INTO external_sync_state (tenant_id, source_system, last_updated_after, last_synced_at, last_error) VALUES ('t_cap', 'beaver', '2026-08-25T09:00:00+09:00', 1756000000, NULL)");

// S2（t_cap2）: 分解あり・配置済み負荷あり・日付なしタスクあり
$item('prj_201', 't_cap2', '案件201', 'inbox', 1, null, null, 0, null);
$link('l_201', 't_cap2', 201, 'prj_201', '案件201', '受注済', '2026-08-25', 600);
$item('c1', 't_cap2', '子1配置済', 'todo', 0, 'prj_201', null, 120, '2026-08-25');
$item('c2', 't_cap2', '子2完了', 'done', 0, 'prj_201', null, 60, null);
$item('c3', 't_cap2', '子3未配置', 'todo', 0, 'prj_201', null, 60, null);
$item('prj_202', 't_cap2', '案件202', 'inbox', 1, null, null, 0, null);
$link('l_202', 't_cap2', 202, 'prj_202', '案件202', '受注済', null, 300);
$item('c4', 't_cap2', '子4超過', 'todo', 0, 'prj_202', null, 360, null);
$item('n1', 't_cap2', '通常タスク配置済', 'todo', 0, null, null, 240, '2026-08-24');
$item('n2', 't_cap2', '通常タスク日付なし', 'todo', 0, null, null, 300, null);

// S3（t_cap3）: 除外ステータス
$item('prj_301', 't_cap3', '納品済案件', 'inbox', 1, null, null, 0, null);
$link('l_301', 't_cap3', 301, 'prj_301', '納品済案件', '納品済', '2026-08-26', 600);
$item('t1', 't_cap3', '請求処理', 'todo', 0, 'prj_301', null, 30, '2026-08-24');
$item('prj_302', 't_cap3', '案件302', 'inbox', 1, null, null, 0, null);
$link('l_302', 't_cap3', 302, 'prj_302', '案件302', '受注済', '2026-08-24', 480);

$excluded = BeaverSyncService::DEFAULT_EXCLUDED_STATUSES;

echo "\n=== テスト1: S1 仮想残量のみ・納期に入らない（(d)相当の中核） ===\n";
$svc1 = new BeaverCapacityService($pdo, 't_cap', $excluded, $TODAY);
$check = $svc1->checkProject(101);
assert_true('required=1800（基準30hの仮想残量）', ($check['required_minutes'] ?? null) === 1800, json_encode($check, JSON_UNESCAPED_UNICODE));
assert_true('placed=0 / unplaced=1800', ($check['placed_minutes'] ?? null) === 0 && ($check['unplaced_minutes'] ?? null) === 1800);
assert_true('feasible=false', ($check['feasible'] ?? null) === false);
assert_true('deadline=2026-08-26', ($check['deadline'] ?? null) === '2026-08-26');
assert_true('shortage=360（8/26までの空き1440に対し1800）', ($check['shortage_minutes'] ?? null) === 360, json_encode($check['shortage_minutes'] ?? null));
assert_true('earliest_completion_date=2026-08-27', ($check['earliest_completion_date'] ?? null) === '2026-08-27');
assert_true('saturated_through=2026-08-26', ($check['saturated_through'] ?? null) === '2026-08-26');
assert_true('message=「8/26納期では6h不足（8/27なら入る）」', ($check['message'] ?? null) === '8/26納期では6h不足（8/27なら入る）', json_encode($check['message'] ?? null, JSON_UNESCAPED_UNICODE));

echo "\n=== テスト2: S2 (c)基準未満・(d)日付なしタスク・EDF ===\n";
$svc2 = new BeaverCapacityService($pdo, 't_cap2', $excluded, $TODAY);
$ov = $svc2->buildOverview();
$byExt = [];
foreach ($ov['links'] as $l) { $byExt[$l['external_project_id']] = $l; }
assert_true('external_project_idは整数で返る', isset($byExt[201]) && is_int($ov['links'][0]['external_project_id']), json_encode(array_keys($byExt)));
$load = $byExt[201]['load'] ?? [];
assert_true('(c)基準未満: baseline=600 / decomposed=240 / effective_total=600', ($load['baseline'] ?? null) === 600 && ($load['decomposed'] ?? null) === 240 && ($load['effective_total'] ?? null) === 600, json_encode($load));
assert_true('completed=60 / remaining=540', ($load['completed'] ?? null) === 60 && ($load['remaining'] ?? null) === 540, json_encode($load));
assert_true('placed=120 / unplaced=420（仮想残量300＋日付なし子60...ではなく remaining-placed）', ($load['placed'] ?? null) === 120 && ($load['unplaced'] ?? null) === 420, json_encode($load));
$check201 = $byExt[201]['check'] ?? [];
assert_true('201: feasible=true（配置済240＋空きで8/25までに入る）', ($check201['feasible'] ?? null) === true, json_encode($check201, JSON_UNESCAPED_UNICODE));
assert_true('201: earliest=2026-08-25 / shortage=0 / saturated_through=2026-08-24', ($check201['earliest_completion_date'] ?? null) === '2026-08-25' && ($check201['shortage_minutes'] ?? null) === 0 && ($check201['saturated_through'] ?? null) === '2026-08-24', json_encode($check201));
assert_true('201: message=「入ります」', ($check201['message'] ?? null) === '入ります');
$load202 = $byExt[202]['load'] ?? [];
assert_true('(c)超過: baseline=300 / decomposed=360 / effective_total=360（基準は上書きしない）', ($load202['baseline'] ?? null) === 300 && ($load202['decomposed'] ?? null) === 360 && ($load202['effective_total'] ?? null) === 360, json_encode($load202));
$check202 = $byExt[202]['check'] ?? [];
assert_true('202: 納期なしは feasible=false / shortage=0', ($check202['feasible'] ?? null) === false && ($check202['shortage_minutes'] ?? null) === 0 && array_key_exists('deadline', $check202) && $check202['deadline'] === null, json_encode($check202));
assert_true('202: EDFで201の後に充当され earliest=2026-08-26', ($check202['earliest_completion_date'] ?? null) === '2026-08-26', json_encode($check202));
assert_true('202: message=「納期未設定・残り6h」', ($check202['message'] ?? null) === '納期未設定・残り6h', json_encode($check202['message'] ?? null, JSON_UNESCAPED_UNICODE));
assert_true('overviewに last_synced_at / last_error', array_key_exists('last_synced_at', $ov) && array_key_exists('last_error', $ov));

echo "\n=== テスト3: S3 (f)除外ステータス ===\n";
$svc3 = new BeaverCapacityService($pdo, 't_cap3', $excluded, $TODAY);
$ov3 = $svc3->buildOverview();
$byExt3 = [];
foreach ($ov3['links'] as $l) { $byExt3[$l['external_project_id']] = $l; }
$load301 = $byExt3[301]['load'] ?? [];
assert_true('(f) 納品済のbaselineは0', ($load301['baseline'] ?? null) === 0, json_encode($load301));
assert_true('(f) 通常タスク（請求処理30分）の負荷は残る: effective=30 / placed=30 / unplaced=0', ($load301['effective_total'] ?? null) === 30 && ($load301['placed'] ?? null) === 30 && ($load301['unplaced'] ?? null) === 0, json_encode($load301));
$check301 = $byExt3[301]['check'] ?? [];
assert_true('301: unplaced=0で feasible=true・「入ります」', ($check301['feasible'] ?? null) === true && ($check301['message'] ?? null) === '入ります', json_encode($check301, JSON_UNESCAPED_UNICODE));
$check302 = $byExt3[302]['check'] ?? [];
assert_true('(f) 請求処理30分が空きを削る: 302は8/24納期に0.5h不足', ($check302['feasible'] ?? null) === false && ($check302['shortage_minutes'] ?? null) === 30 && ($check302['earliest_completion_date'] ?? null) === '2026-08-25', json_encode($check302, JSON_UNESCAPED_UNICODE));
assert_true('302: message=「8/24納期では0.5h不足（8/25なら入る）」', ($check302['message'] ?? null) === '8/24納期では0.5h不足（8/25なら入る）', json_encode($check302['message'] ?? null, JSON_UNESCAPED_UNICODE));

echo "\n=== テスト4: capacity-check エンドポイント（契約） ===\n";
class ApiError extends Exception {
    public $payload;
    public function __construct($code, $payload) { parent::__construct(is_array($payload) ? ($payload['error'] ?? '') : $payload, $code); $this->payload = is_array($payload) ? $payload : ['error' => $payload]; }
}
class TestIntegrationController extends IntegrationController {
    public $lastResponse = null;
    public $input = [];
    public static $service = null;
    public static $today = null;
    protected function sendJSON($data) { $this->lastResponse = $data; }
    protected function sendError($code, $message) { throw new ApiError($code, $message); }
    protected function sendErrorJson(int $code, array $payload) { throw new ApiError($code, $payload); }
    protected function getInput() { return $this->input; }
    protected function makeBeaverSyncService(): ?BeaverSyncService { return self::$service; }
    protected function makeBeaverCapacityService(BeaverSyncService $svc): BeaverCapacityService {
        return new BeaverCapacityService($this->pdo, $svc->getTenantId(), $svc->getExcludedStatuses(), self::$today);
    }
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
$http = new FakeHttpClient();
TestIntegrationController::$service = new BeaverSyncService($pdo, [
    'api_base' => 'http://beaver.test',
    'api_token' => 'tkn',
    'tenant_id' => 't_cap',
    'excluded_statuses' => $excluded,
], $http);
TestIntegrationController::$today = $TODAY;
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_cap'; // B2想定: api_token認証

// 判定前にBeaver単体GETで再取得（最新のbaseline/deliveryで判定）
$http->enqueue(200, [
    'source' => 'beaver',
    'external_project_id' => 101,
    'project_code' => 'P00101',
    'name' => '案件101',
    'customer_name' => '顧客101',
    'status' => '受注済',
    'delivery_date' => '2026-08-26',
    'baseline_hours' => 30.0,
    'baseline_source' => 'manual',
    'baseline_updated_at' => '2026-08-25T09:00:00+09:00',
    'updated_at' => '2026-08-25T09:00:00+09:00',
]);
[$code, $res] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 101]);
assert_true('200が返る', $code === 200, "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
assert_true('Beaver単体GETが呼ばれる', strpos(end($http->calls)['url'] ?? '', '/integrations/youkan/projects/101') !== false, json_encode(array_column($http->calls, 'url')));
assert_true('S1と同じ判定結果', ($res['external_project_id'] ?? null) === 101 && ($res['feasible'] ?? null) === false && ($res['shortage_minutes'] ?? null) === 360 && ($res['earliest_completion_date'] ?? null) === '2026-08-27', json_encode($res, JSON_UNESCAPED_UNICODE));
assert_true('evaluated_atはJSTオフセット付き', is_string($res['evaluated_at'] ?? null) && str_ends_with($res['evaluated_at'], '+09:00'), json_encode($res['evaluated_at'] ?? null));

echo "\n=== テスト5: Beaver再取得失敗 → 前回同期値で200＋message注記 ===\n";
// キューを空にしたまま呼ぶ＝到達不能
[$code, $res] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 101]);
assert_true('200で縮退', $code === 200, "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
assert_true('message末尾に注記', is_string($res['message'] ?? null) && str_ends_with($res['message'], '（Beaver再取得失敗・前回同期値で判定）'), json_encode($res['message'] ?? null, JSON_UNESCAPED_UNICODE));
assert_true('判定値は前回同期値ベース', ($res['shortage_minutes'] ?? null) === 360);

echo "\n=== テスト6: リンクなし＋到達不能は502、Beaver 404はnot_found、除外新規はexcluded_status ===\n";
[$code, $res] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 999]);
assert_true('リンクなし＋到達不能は502', $code === 502, "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
$http->enqueue(404, ['error' => 'Not found']);
[$code, $res] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 998]);
assert_true('Beaver 404はreason=not_found', $code === 404 && ($res['reason'] ?? null) === 'not_found', "code=$code " . json_encode($res));
$http->enqueue(200, [
    'external_project_id' => 555, 'name' => '完了済案件', 'customer_name' => null,
    'status' => '納品済', 'delivery_date' => null, 'baseline_hours' => 10.0,
    'baseline_source' => 'manual', 'baseline_updated_at' => null, 'updated_at' => null,
]);
[$code, $res] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 555]);
assert_true('除外ステータスの新規はreason=excluded_status', $code === 404 && ($res['reason'] ?? null) === 'excluded_status', "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
$noLink = $pdo->prepare("SELECT COUNT(*) FROM external_project_links WHERE tenant_id = 't_cap' AND external_project_id = '555'");
$noLink->execute();
assert_true('除外新規はリンクを作らない', (int)$noLink->fetchColumn() === 0);

echo "\n=== テスト7: 未同期案件はその場で取り込んでから判定 ===\n";
$http->enqueue(200, [
    'external_project_id' => 601, 'project_code' => null, 'name' => '新規案件601', 'customer_name' => '新客',
    'status' => '受注済', 'delivery_date' => '2026-12-01', 'baseline_hours' => 8.0,
    'baseline_source' => 'estimate', 'baseline_updated_at' => '2026-08-25T10:00:00+09:00', 'updated_at' => '2026-08-25T10:00:00+09:00',
]);
[$code, $res] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 601]);
assert_true('200で判定される', $code === 200 && ($res['feasible'] ?? null) === true, "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
$q = $pdo->prepare("SELECT COUNT(*) FROM external_project_links WHERE tenant_id = 't_cap' AND external_project_id = '601'");
$q->execute();
assert_true('リンクとプロジェクトが作られる', (int)$q->fetchColumn() === 1);

echo "\n=== テスト8: 入力検証・認証 ===\n";
[$code] = callBeaver('POST', '/beaver/capacity-check', []);
assert_true('external_project_idなしは400', $code === 400, "code=$code");
[$code] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 'abc']);
assert_true('整数でなければ400', $code === 400, "code=$code");
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_unknown';
[$code] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 101]);
assert_true('不正トークンは401', $code === 401, "code=$code");
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_out2';
[$code] = callBeaver('POST', '/beaver/capacity-check', ['external_project_id' => 101]);
assert_true('対象テナント非所属トークンは403', $code === 403, "code=$code");

echo "\n=== テスト9: overview エンドポイント ===\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . JWTService::encrypt(['sub' => 'u_cap', 'tenant_id' => 't_cap', 'role' => 'owner', 'exp' => time() + 3600]);
[$code, $res] = callBeaver('GET', '/beaver/overview');
assert_true('200でlinks配列', $code === 200 && is_array($res['links'] ?? null), "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
$l101 = null;
foreach ($res['links'] as $l) { if ($l['external_project_id'] === 101) $l101 = $l; }
assert_true('各リンクにload/check/sync_stateがある', $l101 !== null && isset($l101['load'], $l101['check']) && ($l101['sync_state'] ?? null) === 'ok', json_encode($l101, JSON_UNESCAPED_UNICODE));
assert_true('last_synced_atが返る', !empty($res['last_synced_at']));

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
