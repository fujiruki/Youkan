<?php
/**
 * R-154 (Y2) 再帰的 effective_total 計算テスト（docs/SPEC/08_Beaver連携Y2.md §6・§7・§10）
 *
 * 受け入れ条件:
 * - 案件baseline/work_packages合計の3パターン（未満・一致・超過）
 * - work_package baseline/子タスク合計の3パターン（未満・一致・超過。overageはbaselineを書き換えない）
 * - 完了済み子タスクがcompletedに算入される
 * - 日付あり/なしタスクがplaced/unplacedに正しく算入される
 * - EDF二重計上なし（work_package層を挟んでもunplacedが1回だけ計上される）
 * - 除外ステータス案件はwork_packagesも含め負荷0
 * - work_packagesなし案件でY1と数学的に同一結果（後方互換）
 * - overview応答にwork_packages配列（§10のJSON契約）
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r154_cap_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../services/BeaverCapacityService.php';

$passed = 0;
$failed = 0;
function assert_true($label, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label" . ($detail !== '' ? " ($detail)" : '') . "\n"; $failed++; }
}

$TODAY = '2026-08-24';
$pdo = getDB();
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_wpc', 't_wpc', 0)");
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_wpc', 'wpc@example.com', password_hash('pw', PASSWORD_DEFAULT), 'WPC太郎']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at, is_core, daily_capacity_minutes) VALUES ('u_wpc', 't_wpc', 'owner', 0, 1, 480)");

$insItem = $pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, is_project, project_id, parent_id, estimated_minutes, due_date, created_at, updated_at) VALUES (?,?,?,?,'u_wpc',?,?,?,?,?,0,0)");
$item = function ($id, $tenant, $title, $status, $isProject, $projectId, $parentId, $est, $due) use ($insItem) {
    $insItem->execute([$id, $tenant, $title, $status, $isProject, $projectId, $parentId, $est, $due]);
};
$insLink = $pdo->prepare("INSERT INTO external_project_links (id, tenant_id, source_system, external_project_id, youkan_project_id, source_name, source_status, source_delivery_date, baseline_minutes, baseline_source, sync_state, last_synced_at, created_at) VALUES (?,?,'beaver',?,?,?,?,?,?,?,'ok',0,0)");
$link = function ($id, $tenant, $extId, $projId, $name, $status, $delivery, $baselineMin) use ($insLink) {
    $insLink->execute([$id, $tenant, (string)$extId, $projId, $name, $status, $delivery, $baselineMin, $baselineMin === null ? 'none' : 'manual']);
};
$insWp = $pdo->prepare("INSERT INTO external_work_package_links (id, tenant_id, source_system, external_work_package_id, external_project_id, youkan_project_id, youkan_item_id, label, category, baseline_minutes, sync_state, last_synced_at, created_at) VALUES (?,?,'beaver',?,?,?,?,?,?,?,'ok',0,0)");
$wp = function ($id, $tenant, $extWpId, $extProjId, $projId, $itemId, $label, $category, $baselineMin) use ($insWp) {
    $insWp->execute([$id, $tenant, $extWpId, (string)$extProjId, $projId, $itemId, $label, $category, $baselineMin]);
};
$excluded = ['納品済', '完了', '請求済', 'キャンセル'];

// --- S1: 案件baseline > work_packages合計（未分解残量あり） ---
$item('prj_401', 't_wpc', '案件401', 'inbox', 1, null, null, 0, null);
$link('l_401', 't_wpc', 401, 'prj_401', '案件401', '受注済', '2026-09-01', 1200); // 20h
$item('wp401a_item', 't_wpc', '建具A', 'inbox', 1, 'prj_401', null, null, null);
$wp('wp401a', 't_wpc', 'wp-401-a', 401, 'prj_401', 'wp401a_item', '建具A', 'factory', 600); // 10h, baseline未満

// --- S2: 案件baseline = work_packages合計 ---
$item('prj_402', 't_wpc', '案件402', 'inbox', 1, null, null, 0, null);
$link('l_402', 't_wpc', 402, 'prj_402', '案件402', '受注済', '2026-09-01', 600);
$item('wp402a_item', 't_wpc', '建具B', 'inbox', 1, 'prj_402', null, null, null);
$wp('wp402a', 't_wpc', 'wp-402-a', 402, 'prj_402', 'wp402a_item', '建具B', 'factory', 600);

// --- S3: 案件baseline < work_packages合計（超過。baselineは書き換えない） ---
$item('prj_403', 't_wpc', '案件403', 'inbox', 1, null, null, 0, null);
$link('l_403', 't_wpc', 403, 'prj_403', '案件403', '受注済', '2026-09-01', 600);
$item('wp403a_item', 't_wpc', '建具C', 'inbox', 1, 'prj_403', null, null, null);
$wp('wp403a', 't_wpc', 'wp-403-a', 403, 'prj_403', 'wp403a_item', '建具C', 'factory', 900);

// --- S4: work_package baseline vs 子タスク合計（未満/一致/超過）＋完了済み・日付あり/なし ---
$item('prj_404', 't_wpc', '案件404', 'inbox', 1, null, null, 0, null);
$link('l_404', 't_wpc', 404, 'prj_404', '案件404', '受注済', '2026-08-28', 3000); // 案件baselineは大きく、wp単位の検証に集中
$item('wp404a_item', 't_wpc', '建具D 製作', 'inbox', 1, 'prj_404', null, null, null);
$wp('wp404a', 't_wpc', 'wp-404-a', 404, 'prj_404', 'wp404a_item', '建具D 製作', 'factory', 480); // 8h baseline
// 子タスク合計 = 120(完了/日付なし) + 60(日付あり/未完了) = 180 < baseline480 → virtual_residual=300
$item('c404a_1', 't_wpc', '子404a-1完了', 'done', 0, null, 'wp404a_item', 120, null);
$item('c404a_2', 't_wpc', '子404a-2配置済', 'todo', 0, null, 'wp404a_item', 60, '2026-08-25');

$item('wp404b_item', 't_wpc', '建具D 取付', 'inbox', 1, 'prj_404', null, null, null);
$wp('wp404b', 't_wpc', 'wp-404-b', 404, 'prj_404', 'wp404b_item', '建具D 取付', 'site', 120); // 2h baseline
// 子タスク合計 = 120 == baseline
$item('c404b_1', 't_wpc', '子404b-1', 'todo', 0, null, 'wp404b_item', 120, null);

$item('wp404c_item', 't_wpc', '建具E', 'inbox', 1, 'prj_404', null, null, null);
$wp('wp404c', 't_wpc', 'wp-404-c', 404, 'prj_404', 'wp404c_item', '建具E', 'factory', 60); // 1h baseline
// 子タスク合計 = 180 > baseline60（超過。overage=120）
$item('c404c_1', 't_wpc', '子404c-1', 'todo', 0, null, 'wp404c_item', 90, null);
$item('c404c_2', 't_wpc', '子404c-2', 'todo', 0, null, 'wp404c_item', 90, null);

// --- S5: 除外ステータス案件（Beaver由来のbaseline=work_packagesも含めて0。ただし実在の分解済み子タスクはY1同様に残る） ---
$item('prj_405', 't_wpc', '納品済案件', 'inbox', 1, null, null, 0, null);
$link('l_405', 't_wpc', 405, 'prj_405', '納品済案件', '納品済', '2026-09-01', 1200);
// 未分解（子タスクなし）のwork_package: baselineのみのため除外ステータスでは完全に0になる
$item('wp405a_item', 't_wpc', '建具F', 'inbox', 1, 'prj_405', null, null, null);
$wp('wp405a', 't_wpc', 'wp-405-a', 405, 'prj_405', 'wp405a_item', '建具F', 'factory', 600);
// 分解済みのwork_package: 配下の実タスクはBeaver由来ではないのでY1同様に負荷として残る
$item('wp405b_item', 't_wpc', '建具G', 'inbox', 1, 'prj_405', null, null, null);
$wp('wp405b', 't_wpc', 'wp-405-b', 405, 'prj_405', 'wp405b_item', '建具G', 'factory', 900);
$item('c405b_1', 't_wpc', '請求処理', 'todo', 0, null, 'wp405b_item', 300, '2026-08-24');

// --- S6: work_packagesなし案件（既存Y1案件。後方互換） ---
$item('prj_406', 't_wpc', '案件406', 'inbox', 1, null, null, 0, null);
$link('l_406', 't_wpc', 406, 'prj_406', '案件406', '受注済', '2026-09-01', 600);
$item('c406_1', 't_wpc', '子406-1', 'todo', 0, 'prj_406', null, 200, '2026-08-24');
$item('c406_2', 't_wpc', '子406-2', 'done', 0, 'prj_406', null, 100, null);

$svc = new BeaverCapacityService($pdo, 't_wpc', $excluded, $TODAY);
$ov = $svc->buildOverview();
$byExt = [];
foreach ($ov['links'] as $l) { $byExt[$l['external_project_id']] = $l; }

echo "\n=== S1: 案件baseline(20h) > wp合計(10h) ===\n";
$l401 = $byExt[401];
assert_true('decomposed=600 / effective_total=1200（baseline側が勝つ）', $l401['load']['decomposed'] === 600 && $l401['load']['effective_total'] === 1200, json_encode($l401['load']));
assert_true('unplaced=1200（子タスクなし＝全量未配置の仮想残量）', $l401['load']['unplaced'] === 1200, json_encode($l401['load']));

echo "\n=== S2: 案件baseline(10h) = wp合計(10h) ===\n";
$l402 = $byExt[402];
assert_true('decomposed=600 / effective_total=600', $l402['load']['decomposed'] === 600 && $l402['load']['effective_total'] === 600, json_encode($l402['load']));

echo "\n=== S3: 案件baseline(10h) < wp合計(15h)（超過） ===\n";
$l403 = $byExt[403];
assert_true('decomposed=900 / effective_total=900（wp合計が勝つ、baselineは書き換えない）', $l403['load']['decomposed'] === 900 && $l403['load']['effective_total'] === 900, json_encode($l403['load']));
$link403row = $pdo->query("SELECT baseline_minutes FROM external_project_links WHERE external_project_id='403'")->fetchColumn();
assert_true('baseline_minutes自体は600のまま', (int)$link403row === 600);

echo "\n=== S4: work_package単位のbaseline比較・完了済み・日付有無・EDF ===\n";
$l404 = $byExt[404];
$wpByExt = [];
foreach ($l404['work_packages'] as $w) { $wpByExt[$w['external_work_package_id']] = $w; }
assert_true('overview応答にwork_packages配列がある', count($l404['work_packages']) === 3, json_encode($l404['work_packages'], JSON_UNESCAPED_UNICODE));

$a = $wpByExt['wp-404-a'];
assert_true('wp-a: baseline未満 → decomposed=180 / effective_total=480(baseline) / virtual_residual=300 / overage=0',
    $a['baseline_minutes'] === 480 && $a['decomposed_minutes'] === 180 && $a['effective_total_minutes'] === 480
    && $a['virtual_residual_minutes'] === 300 && $a['overage_minutes'] === 0, json_encode($a, JSON_UNESCAPED_UNICODE));

$b = $wpByExt['wp-404-b'];
assert_true('wp-b: baseline一致 → decomposed=120 / effective_total=120 / virtual_residual=0 / overage=0',
    $b['baseline_minutes'] === 120 && $b['decomposed_minutes'] === 120 && $b['effective_total_minutes'] === 120
    && $b['virtual_residual_minutes'] === 0 && $b['overage_minutes'] === 0, json_encode($b, JSON_UNESCAPED_UNICODE));

$c = $wpByExt['wp-404-c'];
assert_true('wp-c: 超過 → decomposed=180 / effective_total=180(子合計が勝つ) / virtual_residual=0 / overage=120。baselineは60のまま',
    $c['baseline_minutes'] === 60 && $c['decomposed_minutes'] === 180 && $c['effective_total_minutes'] === 180
    && $c['virtual_residual_minutes'] === 0 && $c['overage_minutes'] === 120, json_encode($c, JSON_UNESCAPED_UNICODE));

// 案件404合計: decomposed(root) = children_sum(root) = wpA.effective(480) + wpB.effective(120) + wpC.effective(180) = 780
// baseline=3000 → effective_total(root)=max(3000,780)=3000
assert_true('案件レベル: decomposed=780(各wpのeffective_totalの合計) / effective_total=3000(案件baselineが勝つ)',
    $l404['load']['decomposed'] === 780 && $l404['load']['effective_total'] === 3000, json_encode($l404['load']));
// completed: c404a_1(120,done)のみ
assert_true('completed=120（完了済み子タスクのみ算入）', $l404['load']['completed'] === 120, json_encode($l404['load']));
// placed: c404a_2(60,日付あり,未完了) + c404b_1は日付なし(0) + c404c_1/c2は日付なし(0) => placed=60
assert_true('placed=60（日付あり・未完了のみ算入）', $l404['load']['placed'] === 60, json_encode($l404['load']));
// remaining = max(0, 3000-120) = 2880 ; unplaced = max(0, 2880-60) = 2820
assert_true('remaining=2880 / unplaced=2820（EDF入力の二重計上なし）', $l404['load']['remaining'] === 2880 && $l404['load']['unplaced'] === 2820, json_encode($l404['load']));

echo "\n=== S5: 除外ステータス（Beaver由来baselineはwork_packagesも含め0。実在の分解済みタスクはY1同様に残る） ===\n";
$l405 = $byExt[405];
assert_true('root baseline=0', $l405['load']['baseline'] === 0, json_encode($l405['load']));
$wp405ByExt = [];
foreach ($l405['work_packages'] as $w) { $wp405ByExt[$w['external_work_package_id']] = $w; }
$wp405a = $wp405ByExt['wp-405-a'];
assert_true('未分解work_package(wp-a): baseline_minutesは生値600を保持（表示用）だがeffective_totalは0（除外ステータスで虚仮baseline分は消える）',
    $wp405a['baseline_minutes'] === 600 && $wp405a['effective_total_minutes'] === 0 && $wp405a['decomposed_minutes'] === 0, json_encode($wp405a, JSON_UNESCAPED_UNICODE));
$wp405b = $wp405ByExt['wp-405-b'];
assert_true('分解済みwork_package(wp-b): 実タスク300分の負荷はexcludedでも残る（Y1「消えるのはBeaver由来の基準負荷だけ」を継承）',
    $wp405b['decomposed_minutes'] === 300 && $wp405b['effective_total_minutes'] === 300, json_encode($wp405b, JSON_UNESCAPED_UNICODE));
assert_true('root effective_total=300（wp-a=0 + wp-b=300。Beaver由来baselineは消えるが実タスクは残る）', $l405['load']['effective_total'] === 300, json_encode($l405['load']));

echo "\n=== S6: work_packagesなし案件（後方互換。Y1の2階層ロジックと数学的に同一） ===\n";
$l406 = $byExt[406];
assert_true('work_packages配列は空', $l406['work_packages'] === []);
// Y1式: decomposed=300(200+100) / effective_total=max(600,300)=600 / completed=100 / remaining=500 / placed=200 / unplaced=300
assert_true('Y1と同一の計算結果', $l406['load']['baseline'] === 600 && $l406['load']['decomposed'] === 300 && $l406['load']['effective_total'] === 600
    && $l406['load']['completed'] === 100 && $l406['load']['remaining'] === 500 && $l406['load']['placed'] === 200 && $l406['load']['unplaced'] === 300,
    json_encode($l406['load']));

echo "\n=== EDF: work_package層を挟んでも unplaced が正しく1回だけ充当される ===\n";
$check404 = $l404['check'];
assert_true('capacity-check側もroot.unplacedのみを消費（フィールドは既存のまま）', $check404['unplaced_minutes'] === 2820 && $check404['required_minutes'] === 2880, json_encode($check404, JSON_UNESCAPED_UNICODE));

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
