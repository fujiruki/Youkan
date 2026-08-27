<?php
/**
 * R-154 (Y2) 一覧混入対策テスト（docs/SPEC/08_Beaver連携Y2.md §3）
 *
 * work_package item（is_project=1, external_work_package_links を持つ）が
 * GET /projects（ProjectController::index 4スコープ）の一覧に混入しないことを確認する。
 * 既存のプロジェクト同士の親子ネスト（is_project=1同士）は引き続き一覧に残ることも確認する
 * （project_id IS NULL 条件を追加してはならない、という仕様上の制約の回帰防止）。
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r154_registry_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ProjectController.php';

$passed = 0;
$failed = 0;
function assert_true($label, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label" . ($detail !== '' ? " ($detail)" : '') . "\n"; $failed++; }
}

class TestProjectController extends ProjectController {
    public static $userId;
    public static $tenantId;
    public static $joined = [];
    public function authenticate() {
        $this->currentUserId = self::$userId;
        $this->currentTenantId = self::$tenantId;
        $this->joinedTenants = self::$joined;
    }
    protected function sendJSON($data) { echo json_encode($data); }
}

function callIndex(string $scope): array {
    $_GET = ['scope' => $scope];
    ob_start();
    $ctrl = new TestProjectController();
    $ctrl->handleRequest('GET');
    $out = ob_get_clean();
    return json_decode($out, true);
}

$pdo = getDB();
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_reg', '登録テナント', 0)");
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_reg', 'reg@example.com', password_hash('pw', PASSWORD_DEFAULT), '登録太郎']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at, is_core) VALUES ('u_reg', 't_reg', 'owner', 0, 1)");

// 通常プロジェクト（会社）
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, assigned_to, is_project, is_archived, created_at, updated_at) VALUES (?,?,?,?,?,?,1,0,0,0)")
    ->execute(['prj_reg_1', 't_reg', '通常案件1', 'inbox', 'u_reg', 'u_reg']);

// 既存機能: プロジェクト同士の親子ネスト（子プロジェクト。is_project=1同士、project_idで親子）
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, assigned_to, is_project, project_id, is_archived, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,0,0,0)")
    ->execute(['prj_reg_child', 't_reg', '子プロジェクト', 'inbox', 'u_reg', 'u_reg', 'prj_reg_1']);

// work_package item（Beaver由来。案件prj_reg_1配下）
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, assigned_to, is_project, project_id, is_archived, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,0,0,0)")
    ->execute(['wp_reg_1', 't_reg', '建具A', 'inbox', 'u_reg', 'u_reg', 'prj_reg_1']);
$pdo->exec("INSERT INTO external_project_links (id, tenant_id, source_system, external_project_id, youkan_project_id, source_name, source_status, baseline_minutes, baseline_source, sync_state, last_synced_at, created_at) VALUES ('epl_reg_1','t_reg','beaver','9001','prj_reg_1','通常案件1','受注済',1200,'estimate','ok',0,0)");
$pdo->exec("INSERT INTO external_work_package_links (id, tenant_id, source_system, external_work_package_id, external_project_id, youkan_project_id, youkan_item_id, label, category, baseline_minutes, sync_state, last_synced_at, created_at) VALUES ('ewpl_reg_1','t_reg','beaver','ext-wp-reg-1','9001','prj_reg_1','wp_reg_1','建具A','factory',600,'ok',0,0)");

// 個人プロジェクト（personal scope検証用）
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, assigned_to, is_project, is_archived, created_at, updated_at) VALUES (?,'',?,?,?,?,1,0,0,0)")
    ->execute(['prj_personal_1', '個人案件1', 'inbox', 'u_reg', 'u_reg']);
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, assigned_to, is_project, project_id, is_archived, created_at, updated_at) VALUES (?,'',?,?,?,?,1,?,0,0,0)")
    ->execute(['wp_personal_1', '個人建具A', 'inbox', 'u_reg', 'u_reg', 'prj_personal_1']);
$pdo->exec("INSERT INTO external_project_links (id, tenant_id, source_system, external_project_id, youkan_project_id, source_name, source_status, baseline_minutes, baseline_source, sync_state, last_synced_at, created_at) VALUES ('epl_reg_2','','beaver','9002','prj_personal_1','個人案件1','受注済',600,'estimate','ok',0,0)");
$pdo->exec("INSERT INTO external_work_package_links (id, tenant_id, source_system, external_work_package_id, external_project_id, youkan_project_id, youkan_item_id, label, category, baseline_minutes, sync_state, last_synced_at, created_at) VALUES ('ewpl_reg_2','','beaver','ext-wp-personal-1','9002','prj_personal_1','wp_personal_1','個人建具A','factory',300,'ok',0,0)");

TestProjectController::$userId = 'u_reg';
TestProjectController::$tenantId = 't_reg';
TestProjectController::$joined = ['t_reg'];

echo "\n=== company スコープ ===\n";
$res = callIndex('company');
$ids = array_column($res, 'id');
assert_true('通常案件・子プロジェクトは含まれる', in_array('prj_reg_1', $ids) && in_array('prj_reg_child', $ids), json_encode($ids));
assert_true('work_package item は含まれない', !in_array('wp_reg_1', $ids), json_encode($ids));

echo "\n=== dashboard スコープ ===\n";
$res = callIndex('dashboard');
$ids = array_column($res, 'id');
assert_true('work_package item は含まれない', !in_array('wp_reg_1', $ids) && !in_array('wp_personal_1', $ids), json_encode($ids));

echo "\n=== aggregated スコープ ===\n";
$res = callIndex('aggregated');
$ids = array_column($res, 'id');
assert_true('通常案件は含まれる', in_array('prj_reg_1', $ids) && in_array('prj_personal_1', $ids), json_encode($ids));
assert_true('work_package item は含まれない', !in_array('wp_reg_1', $ids) && !in_array('wp_personal_1', $ids), json_encode($ids));

echo "\n=== personal スコープ ===\n";
$res = callIndex('personal');
$ids = array_column($res, 'id');
assert_true('個人案件は含まれる', in_array('prj_personal_1', $ids), json_encode($ids));
assert_true('個人work_package item は含まれない', !in_array('wp_personal_1', $ids), json_encode($ids));

echo "\n=== 件数が変わらないこと（work_package追加前後の回帰） ===\n";
$countCompanyBefore = count(callIndex('company'));
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, assigned_to, is_project, project_id, is_archived, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,0,0,0)")
    ->execute(['wp_reg_2', 't_reg', '建具B', 'inbox', 'u_reg', 'u_reg', 'prj_reg_1']);
$pdo->exec("INSERT INTO external_work_package_links (id, tenant_id, source_system, external_work_package_id, external_project_id, youkan_project_id, youkan_item_id, label, category, baseline_minutes, sync_state, last_synced_at, created_at) VALUES ('ewpl_reg_3','t_reg','beaver','ext-wp-reg-2','9001','prj_reg_1','wp_reg_2','建具B','factory',300,'ok',0,0)");
$countCompanyAfter = count(callIndex('company'));
assert_true('work_package作成後もcompany一覧の件数が変わらない', $countCompanyBefore === $countCompanyAfter, "before=$countCompanyBefore after=$countCompanyAfter");

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
