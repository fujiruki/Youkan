<?php
/**
 * R-0161 Beaver標準事務タスク（見積・請求）テスト（docs/SPEC/14_Beaver標準事務タスク.md §10）
 *
 * 受け入れ条件（仕様書§10、1〜15。16・17は既存回帰ファイルで担保、18はフロントのため対象外）:
 * 1. 初回同期で見積・請求タスクが生成される
 * 2. 再同期で重複生成しない
 * 3. manual baseline案件でも生成される
 * 4. estimate baseline案件（work_packagesあり）でも生成される
 * 5. 標準タスクとwork_packageが混在してもchildren_sumが正しい
 * 6. 初期estimated_minutesが.env既定値と一致する
 * 7. .envの標準工数変更後、新規生成タスクに反映される
 * 8. 標準タスク工数をユーザーが変更後、effective_totalに反映される
 * 9. baselineとの二重計上がない
 * 10. work_packageとの二重計上がない
 * 11. 子タスク分解後も二重計上がない（既存Y2ロジックの回帰）
 * 12. 納品前: 請求タスクはpending・effective_total/unplacedに算入
 * 13. 納品済: baseline=0・請求タスクがtodoに活性化・工数は残る
 * 14. 請求済: 請求タスクがdoneになる
 * 15. キャンセル: 未完了なら両タスクcancelled・容量除外。doneは変更しない
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r0161_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);
putenv('BEAVER_STANDARD_ESTIMATE_MINUTES');
putenv('BEAVER_STANDARD_INVOICE_MINUTES');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../services/BeaverSyncService.php';
require_once __DIR__ . '/../services/BeaverCapacityService.php';
require_once __DIR__ . '/helpers/FakeHttpClient.php';

$passed = 0;
$failed = 0;
function assert_true($label, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label" . ($detail !== '' ? " ($detail)" : '') . "\n"; $failed++; }
}

function bvrProject(int $id, array $wps = [], array $over = []): array {
    return array_merge([
        'source' => 'beaver',
        'external_project_id' => $id,
        'project_code' => sprintf('P%05d', $id),
        'name' => "案件{$id}",
        'customer_name' => "顧客{$id}",
        'status' => '受注済',
        'delivery_date' => '2026-09-10',
        'baseline_hours' => 20.0,
        'baseline_source' => empty($wps) ? 'manual' : 'estimate',
        'baseline_updated_at' => '2026-08-25T09:00:00+09:00',
        'updated_at' => '2026-08-25T09:00:00+09:00',
        'work_packages' => $wps,
    ], $over);
}

function bvrWp(string $extId, array $over = []): array {
    return array_merge([
        'external_work_package_id' => $extId,
        'label' => "明細{$extId}",
        'category' => 'factory',
        'estimated_hours' => 8.0,
        'source_voucher_id' => 60,
        'source_line_id' => 201,
        'source_updated_at' => '2026-08-25T09:00:00+09:00',
    ], $over);
}

$pdo = getDB();
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_161', 't_161', 0)");
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_161', 'u161@example.com', password_hash('pw', PASSWORD_DEFAULT), 'R0161太郎']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at, is_core, daily_capacity_minutes) VALUES ('u_161', 't_161', 'owner', 0, 1, 480)");

$config = [
    'api_base' => 'http://beaver.test',
    'api_token' => 'tkn',
    'tenant_id' => 't_161',
    'excluded_statuses' => BeaverSyncService::DEFAULT_EXCLUDED_STATUSES,
];
$http = new FakeHttpClient();
$svc = new BeaverSyncService($pdo, $config, $http);

function projectIdOf($pdo, $extId) {
    return $pdo->query("SELECT youkan_project_id FROM external_project_links WHERE tenant_id = 't_161' AND external_project_id = " . $pdo->quote((string)$extId))->fetchColumn();
}
function taskLinks($pdo, $projectId) {
    $stmt = $pdo->prepare("SELECT * FROM generated_task_links WHERE youkan_project_id = ?");
    $stmt->execute([$projectId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $byRole = [];
    foreach ($rows as $r) $byRole[$r['task_role']] = $r;
    return $byRole;
}
function itemOf($pdo, $itemId) {
    return $pdo->query("SELECT * FROM items WHERE id = " . $pdo->quote($itemId))->fetch(PDO::FETCH_ASSOC);
}

echo "\n=== テスト1・3: 初回同期（manual baseline）で見積・請求タスクが生成される ===\n";
// status=見積中（受注前）を使い、以降の再同期で見積が意図せずdoneへ自動遷移しないようにする
// （受注済等は§5.3で「見積フェーズを超えた」とみなされ即done遷移するため、他テストとの分離用）
$http->enqueue(200, ['data' => [bvrProject(1, [], ['status' => '見積中'])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_161');
$proj1 = projectIdOf($pdo, 1);
$links1 = taskLinks($pdo, $proj1);
assert_true('generated_task_linksに見積・請求の2件', isset($links1['estimate'], $links1['invoice']), json_encode($links1));
$estimate1 = itemOf($pdo, $links1['estimate']['youkan_item_id']);
$invoice1 = itemOf($pdo, $links1['invoice']['youkan_item_id']);
assert_true('見積タスク: title=見積・status=todo・is_project=0', $estimate1['title'] === '見積' && $estimate1['status'] === 'todo' && (int)$estimate1['is_project'] === 0, json_encode($estimate1, JSON_UNESCAPED_UNICODE));
assert_true('請求タスク: title=請求・status=pending・pending_conditionあり', $invoice1['title'] === '請求' && $invoice1['status'] === 'pending' && !empty($invoice1['pending_condition']), json_encode($invoice1, JSON_UNESCAPED_UNICODE));
assert_true('両タスクとも案件直下（project_id=案件, parent_id=NULL）', $estimate1['project_id'] === $proj1 && $estimate1['parent_id'] === null && $invoice1['project_id'] === $proj1 && $invoice1['parent_id'] === null);

echo "\n=== テスト6: 初期estimated_minutesが.env既定値(60/30)と一致する ===\n";
assert_true('見積=60分（既定）', (int)$estimate1['estimated_minutes'] === 60, (string)$estimate1['estimated_minutes']);
assert_true('請求=30分（既定）', (int)$invoice1['estimated_minutes'] === 30, (string)$invoice1['estimated_minutes']);

echo "\n=== テスト2: 再同期で重複生成しない ===\n";
$http->enqueue(200, ['data' => [bvrProject(1, [], ['status' => '見積中'])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_161');
$countLinks1 = (int)$pdo->query("SELECT COUNT(*) FROM generated_task_links WHERE youkan_project_id = " . $pdo->quote($proj1))->fetchColumn();
assert_true('generated_task_linksは2件のまま', $countLinks1 === 2, (string)$countLinks1);
$itemsCount1 = (int)$pdo->query("SELECT COUNT(*) FROM items WHERE tenant_id = 't_161' AND title IN ('見積','請求')")->fetchColumn();
assert_true('items側も増えない', $itemsCount1 === 2, (string)$itemsCount1);

echo "\n=== テスト4・5・10: estimate baseline案件（work_packagesあり）でも生成され、children_sumが正しい ===\n";
$http->enqueue(200, ['data' => [bvrProject(2, [bvrWp('ext-wp-2-1')], ['baseline_hours' => 3.0])], 'next_cursor' => null]); // 180分。wp+標準タスクの合計より小さくする
$svc->sync('full', true, 'u_161');
$proj2 = projectIdOf($pdo, 2);
$links2 = taskLinks($pdo, $proj2);
assert_true('work_packagesありでも見積・請求タスクが生成される', isset($links2['estimate'], $links2['invoice']));
$capSvc2 = new BeaverCapacityService($pdo, 't_161', BeaverSyncService::DEFAULT_EXCLUDED_STATUSES, '2026-08-31');
$ov2 = $capSvc2->buildOverview();
$l2 = null;
foreach ($ov2['links'] as $l) { if ($l['external_project_id'] === 2) $l2 = $l; }
// wp(8h=480分, 子タスクなし)のeffective_total=480。見積60+請求30=90。children_sum(root)=480+60+30=600
assert_true('children_sum=570（wp480 + 見積60 + 請求30 の合算で二重計上なし）', $l2['load']['decomposed'] === 570, json_encode($l2['load']));
assert_true('effective_total=570（baseline180 < children_sum570のためchildren_sumが勝つ）', $l2['load']['effective_total'] === 570, json_encode($l2['load']));

echo "\n=== テスト9: baselineとの二重計上がない ===\n";
// プロジェクト1（baseline=20h=1200分、work_packagesなし）: 見積60+請求30=90 だが baseline(1200) がbaseline側に含まれないためeffective_totalは1200のまま（1290にならない）
$capSvc1 = new BeaverCapacityService($pdo, 't_161', BeaverSyncService::DEFAULT_EXCLUDED_STATUSES, '2026-08-31');
$ov1 = $capSvc1->buildOverview();
$l1 = null;
foreach ($ov1['links'] as $l) { if ($l['external_project_id'] === 1) $l1 = $l; }
assert_true('decomposed=90（見積60+請求30）', $l1['load']['decomposed'] === 90, json_encode($l1['load']));
assert_true('effective_total=1200（baselineがそのまま勝つ。1290に膨らまない＝二重計上なし）', $l1['load']['effective_total'] === 1200, json_encode($l1['load']));

echo "\n=== テスト7: .envの標準工数変更後、新規生成タスクに反映される ===\n";
putenv('BEAVER_STANDARD_ESTIMATE_MINUTES=90');
putenv('BEAVER_STANDARD_INVOICE_MINUTES=45');
$http->enqueue(200, ['data' => [bvrProject(3)], 'next_cursor' => null]);
$svc->sync('full', true, 'u_161');
$proj3 = projectIdOf($pdo, 3);
$links3 = taskLinks($pdo, $proj3);
$estimate3 = itemOf($pdo, $links3['estimate']['youkan_item_id']);
$invoice3 = itemOf($pdo, $links3['invoice']['youkan_item_id']);
assert_true('新規案件の見積=90分（.env上書き反映）', (int)$estimate3['estimated_minutes'] === 90, (string)$estimate3['estimated_minutes']);
assert_true('新規案件の請求=45分（.env上書き反映）', (int)$invoice3['estimated_minutes'] === 45, (string)$invoice3['estimated_minutes']);
assert_true('既存案件1の見積は60分のまま（生成後の変更は遡及しない）', (int)itemOf($pdo, $links1['estimate']['youkan_item_id'])['estimated_minutes'] === 60);
putenv('BEAVER_STANDARD_ESTIMATE_MINUTES');
putenv('BEAVER_STANDARD_INVOICE_MINUTES');

echo "\n=== テスト8: 標準タスク工数をユーザーが変更後、effective_totalに反映される ===\n";
$pdo->prepare("UPDATE items SET estimated_minutes = 999 WHERE id = ?")->execute([$links1['estimate']['youkan_item_id']]);
$ov1b = (new BeaverCapacityService($pdo, 't_161', BeaverSyncService::DEFAULT_EXCLUDED_STATUSES, '2026-08-31'))->buildOverview();
$l1b = null;
foreach ($ov1b['links'] as $l) { if ($l['external_project_id'] === 1) $l1b = $l; }
assert_true('decomposed=999+30=1029に反映される', $l1b['load']['decomposed'] === 1029, json_encode($l1b['load']));
$pdo->prepare("UPDATE items SET estimated_minutes = 60 WHERE id = ?")->execute([$links1['estimate']['youkan_item_id']]); // 元に戻す

echo "\n=== テスト11: 子タスク分解後も二重計上がない（既存Y2ロジックの回帰） ===\n";
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, parent_id, estimated_minutes, created_at, updated_at) VALUES ('c161_est_a', 't_161', '見積の内訳A', 'todo', 'u_161', ?, 40, 0, 0)")
    ->execute([$links1['estimate']['youkan_item_id']]);
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, parent_id, estimated_minutes, created_at, updated_at) VALUES ('c161_est_b', 't_161', '見積の内訳B', 'todo', 'u_161', ?, 60, 0, 0)")
    ->execute([$links1['estimate']['youkan_item_id']]);
$ov1c = (new BeaverCapacityService($pdo, 't_161', BeaverSyncService::DEFAULT_EXCLUDED_STATUSES, '2026-08-31'))->buildOverview();
$l1c = null;
foreach ($ov1c['links'] as $l) { if ($l['external_project_id'] === 1) $l1c = $l; }
// 見積タスク自身はbaselineノードではないため、分解後は子合計(40+60=100)のみが通る（自身の60分は加算されない＝Y2既存ロジック）
assert_true('見積タスクの分解後は子合計100分のみ通り、自身の60分と二重計上しない → decomposed=100(見積)+30(請求)=130', $l1c['load']['decomposed'] === 130, json_encode($l1c['load']));
$pdo->exec("DELETE FROM items WHERE id IN ('c161_est_a','c161_est_b')");

echo "\n=== テスト12: 納品前: 請求タスクはpending・effective_total/unplacedに算入される ===\n";
assert_true('請求タスクはpending（Today候補に出ない設計）', itemOf($pdo, $links1['invoice']['youkan_item_id'])['status'] === 'pending');
assert_true('見積は依然todo', itemOf($pdo, $links1['estimate']['youkan_item_id'])['status'] === 'todo');
$ov1pre = (new BeaverCapacityService($pdo, 't_161', BeaverSyncService::DEFAULT_EXCLUDED_STATUSES, '2026-08-31'))->buildOverview();
$l1pre = null;
foreach ($ov1pre['links'] as $l) { if ($l['external_project_id'] === 1) $l1pre = $l; }
assert_true('unplacedに請求分の負荷が算入される（decomposed=90に請求30が含まれる）', $l1pre['load']['decomposed'] === 90 && $l1pre['load']['unplaced'] >= 30, json_encode($l1pre['load']));

echo "\n=== テスト13: 納品済 → baseline=0・請求タスクがtodoに活性化・工数は残る ===\n";
$http->enqueue(200, ['data' => [bvrProject(1, [], ['status' => '納品済', 'updated_at' => '2026-08-26T09:00:00+09:00'])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_161');
$estimate1After = itemOf($pdo, $links1['estimate']['youkan_item_id']);
$invoice1After = itemOf($pdo, $links1['invoice']['youkan_item_id']);
assert_true('見積タスクは自動でdoneへ遷移（見積フェーズを超えたため）', $estimate1After['status'] === 'done', json_encode($estimate1After, JSON_UNESCAPED_UNICODE));
assert_true('請求タスクは自動でtodoへ活性化', $invoice1After['status'] === 'todo', json_encode($invoice1After, JSON_UNESCAPED_UNICODE));
$ov1d = (new BeaverCapacityService($pdo, 't_161', BeaverSyncService::DEFAULT_EXCLUDED_STATUSES, '2026-08-31'))->buildOverview();
$l1d = null;
foreach ($ov1d['links'] as $l) { if ($l['external_project_id'] === 1) $l1d = $l; }
assert_true('baselineは0になる（納品済は除外ステータス）', $l1d['load']['baseline'] === 0, json_encode($l1d['load']));
assert_true('請求タスクの工数(30分)はeffective_totalに残り続ける', $l1d['load']['effective_total'] === 90, json_encode($l1d['load']));

echo "\n=== テスト14: 請求済 → 請求タスクがdoneになる ===\n";
$http->enqueue(200, ['data' => [bvrProject(1, [], ['status' => '請求済', 'updated_at' => '2026-08-27T09:00:00+09:00'])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_161');
$invoice1Final = itemOf($pdo, $links1['invoice']['youkan_item_id']);
assert_true('請求タスクがdoneになる', $invoice1Final['status'] === 'done', json_encode($invoice1Final, JSON_UNESCAPED_UNICODE));
$estimate1Final = itemOf($pdo, $links1['estimate']['youkan_item_id']);
assert_true('見積タスクはdoneのまま（単調前進、巻き戻りなし）', $estimate1Final['status'] === 'done');

echo "\n=== テスト15: キャンセル → 未完了なら両タスクcancelled・容量除外。done済みは変更しない ===\n";
$http->enqueue(200, ['data' => [bvrProject(4, [], ['status' => '受注済'])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_161');
$proj4 = projectIdOf($pdo, 4);
$links4 = taskLinks($pdo, $proj4);
$http->enqueue(200, ['data' => [bvrProject(4, [], ['status' => 'キャンセル', 'updated_at' => '2026-08-28T09:00:00+09:00'])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_161');
$estimate4 = itemOf($pdo, $links4['estimate']['youkan_item_id']);
$invoice4 = itemOf($pdo, $links4['invoice']['youkan_item_id']);
assert_true('未完了だった見積・請求タスクはcancelledになる', $estimate4['status'] === 'cancelled' && $invoice4['status'] === 'cancelled', json_encode([$estimate4, $invoice4], JSON_UNESCAPED_UNICODE));
$ov4 = (new BeaverCapacityService($pdo, 't_161', BeaverSyncService::DEFAULT_EXCLUDED_STATUSES, '2026-08-31'))->buildOverview();
$l4 = null;
foreach ($ov4['links'] as $l) { if ($l['external_project_id'] === 4) $l4 = $l; }
assert_true('cancelled化により容量計算から除外される（effective_total=0）', $l4['load']['effective_total'] === 0, json_encode($l4['load']));
// 既にdoneだった案件1の請求タスクがキャンセル案件に巻き込まれないことも確認（別案件のため独立）
$http->enqueue(200, ['data' => [bvrProject(1, [], ['status' => 'キャンセル', 'updated_at' => '2026-08-29T09:00:00+09:00'])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_161');
$invoice1AfterCancel = itemOf($pdo, $links1['invoice']['youkan_item_id']);
$estimate1AfterCancel = itemOf($pdo, $links1['estimate']['youkan_item_id']);
assert_true('既にdoneだった請求タスクはキャンセルに巻き込まれず変更されない', $invoice1AfterCancel['status'] === 'done', json_encode($invoice1AfterCancel, JSON_UNESCAPED_UNICODE));
assert_true('既にdoneだった見積タスクも変更されない', $estimate1AfterCancel['status'] === 'done');

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
