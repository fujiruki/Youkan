<?php
/**
 * R-154 (Y2) work_packages 同期テスト（docs/SPEC/08_Beaver連携Y2.md §4・§5）
 *
 * 受け入れ条件:
 * - work_packagesなし/1件/複数件の同期
 * - 同一 external_work_package_id の冪等upsert
 * - label変更時はitem.titleのみ更新、baseline変更時はリンクのみ更新
 * - 再同期でユーザー編集（子タスク）が保持される
 * - work_package消失 → missing_upstream（子タスク有無2パターン）、削除しない
 * - diffモードは欠落検知しない（§5.2）
 * - manual→estimate切替、estimate更新後の再同期
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r154_sync_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../services/BeaverSyncService.php';
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
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_wp', 'WPテナント', 0)");
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_wp', 'wp@example.com', password_hash('pw', PASSWORD_DEFAULT), 'WP太郎']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at, is_core) VALUES ('u_wp', 't_wp', 'owner', 0, 1)");

$config = [
    'api_base' => 'http://beaver.test',
    'api_token' => 'tkn',
    'tenant_id' => 't_wp',
    'excluded_statuses' => BeaverSyncService::DEFAULT_EXCLUDED_STATUSES,
];
$http = new FakeHttpClient();
$svc = new BeaverSyncService($pdo, $config, $http);

$countWpItems = fn() => (int)$pdo->query("SELECT COUNT(*) FROM items WHERE tenant_id = 't_wp' AND id IN (SELECT youkan_item_id FROM external_work_package_links WHERE tenant_id = 't_wp')")->fetchColumn();
$countWpLinks = fn() => (int)$pdo->query("SELECT COUNT(*) FROM external_work_package_links WHERE tenant_id = 't_wp'")->fetchColumn();
$getWpLink = function ($extId) use ($pdo) {
    $stmt = $pdo->prepare("SELECT * FROM external_work_package_links WHERE tenant_id = 't_wp' AND source_system = 'beaver' AND external_work_package_id = ?");
    $stmt->execute([$extId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
};

echo "\n=== テスト1: work_packagesなし案件（後方互換） ===\n";
$http->enqueue(200, ['data' => [bvrProject(1001)], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
assert_true('work_package item/linkが作られない', $countWpLinks() === 0);

echo "\n=== テスト2: work_package 1件の同期 ===\n";
$http->enqueue(200, ['data' => [bvrProject(1002, [bvrWp('ext-wp-1')])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
assert_true('work_package itemが1件作られる', $countWpLinks() === 1 && $countWpItems() === 1);
$wp1 = $getWpLink('ext-wp-1');
assert_true('リンクの内容', $wp1 !== null && $wp1['label'] === '明細ext-wp-1' && $wp1['category'] === 'factory'
    && (int)$wp1['baseline_minutes'] === 480 && (int)$wp1['source_voucher_id'] === 60 && (int)$wp1['source_line_id'] === 201
    && $wp1['sync_state'] === 'ok', json_encode($wp1, JSON_UNESCAPED_UNICODE));
$proj1002 = $pdo->query("SELECT youkan_project_id FROM external_project_links WHERE external_project_id = '1002' AND tenant_id = 't_wp'")->fetchColumn();
$wpItem1 = $pdo->query("SELECT * FROM items WHERE id = " . $pdo->quote($wp1['youkan_item_id']))->fetch(PDO::FETCH_ASSOC);
assert_true('work_package itemの表現（is_project=1, project_id=案件, parent_id=NULL, estimated_minutes=NULL）',
    $wpItem1 !== null && (int)$wpItem1['is_project'] === 1 && $wpItem1['project_id'] === $proj1002
    && $wpItem1['parent_id'] === null && $wpItem1['estimated_minutes'] === null && $wpItem1['title'] === '明細ext-wp-1',
    json_encode($wpItem1, JSON_UNESCAPED_UNICODE));

echo "\n=== テスト3: 複数work_packagesの同期 ===\n";
$http->enqueue(200, ['data' => [bvrProject(1003, [bvrWp('ext-wp-2'), bvrWp('ext-wp-3', ['category' => 'site'])])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
assert_true('2件のwork_packageが作られる', $getWpLink('ext-wp-2') !== null && $getWpLink('ext-wp-3') !== null);
assert_true('未知でないcategoryはそのまま保持', $getWpLink('ext-wp-3')['category'] === 'site');

echo "\n=== テスト4: 冪等upsert（複数回同期してもitem増加なし） ===\n";
$before = $countWpItems();
$http->enqueue(200, ['data' => [bvrProject(1002, [bvrWp('ext-wp-1')])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
assert_true('item数が変わらない', $countWpItems() === $before);
assert_true('リンクが増えない', $countWpLinks() === 3);

echo "\n=== テスト5: label変更でtitleのみ更新、子タスクは無変更 ===\n";
$wp1 = $getWpLink('ext-wp-1');
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, project_id, parent_id, estimated_minutes, created_at, updated_at) VALUES ('wp1_child', 't_wp', '子タスクA', 'todo', 'u_wp', NULL, ?, 90, 0, 0)")
    ->execute([$wp1['youkan_item_id']]);
$http->enqueue(200, ['data' => [bvrProject(1002, [bvrWp('ext-wp-1', ['label' => '建具A 製作'])])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
$wpItem1After = $pdo->query("SELECT * FROM items WHERE id = " . $pdo->quote($wp1['youkan_item_id']))->fetch(PDO::FETCH_ASSOC);
assert_true('titleがBeaver値で更新される', $wpItem1After['title'] === '建具A 製作', json_encode($wpItem1After, JSON_UNESCAPED_UNICODE));
$child = $pdo->query("SELECT * FROM items WHERE id = 'wp1_child'")->fetch(PDO::FETCH_ASSOC);
assert_true('子タスクは無変更', $child !== null && $child['title'] === '子タスクA' && (int)$child['estimated_minutes'] === 90);

echo "\n=== テスト6: 工数変更でリンクのみ更新、labelが同じならtitle無変更 ===\n";
$titleBefore = $pdo->query("SELECT title FROM items WHERE id = " . $pdo->quote($wp1['youkan_item_id']))->fetchColumn();
$http->enqueue(200, ['data' => [bvrProject(1002, [bvrWp('ext-wp-1', ['label' => '建具A 製作', 'estimated_hours' => 10.5])])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
$wp1After = $getWpLink('ext-wp-1');
assert_true('baseline_minutesが更新される（10.5h→630分）', (int)$wp1After['baseline_minutes'] === 630, json_encode($wp1After));
$titleAfter = $pdo->query("SELECT title FROM items WHERE id = " . $pdo->quote($wp1['youkan_item_id']))->fetchColumn();
assert_true('labelが同じならtitleは無変更', $titleAfter === $titleBefore);

echo "\n=== テスト7: 再同期でユーザー編集保持（担当・依存関係含む） ===\n";
$pdo->exec("UPDATE items SET assigned_to = 'u_wp', memo = 'メモ' WHERE id = 'wp1_child'");
$pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, project_id, parent_id, estimated_minutes, created_at, updated_at) VALUES ('wp1_child2', 't_wp', '子タスクB(依存)', 'todo', 'u_wp', NULL, ?, 30, 0, 0)")
    ->execute([$wp1['youkan_item_id']]);
$http->enqueue(200, ['data' => [bvrProject(1002, [bvrWp('ext-wp-1', ['label' => '建具A 製作', 'estimated_hours' => 10.5])])], 'next_cursor' => null]);
$svc->sync('diff', true, 'u_wp');
$child1 = $pdo->query("SELECT * FROM items WHERE id = 'wp1_child'")->fetch(PDO::FETCH_ASSOC);
$child2 = $pdo->query("SELECT * FROM items WHERE id = 'wp1_child2'")->fetch(PDO::FETCH_ASSOC);
assert_true('子タスクの担当・メモ・依存タスクとも保持', $child1['assigned_to'] === 'u_wp' && $child1['memo'] === 'メモ' && $child2 !== null && $child2['title'] === '子タスクB(依存)');

echo "\n=== テスト8: work_package消失（子タスクなし）→ missing_upstream ===\n";
$http->enqueue(200, ['data' => [bvrProject(1003, [bvrWp('ext-wp-2')])], 'next_cursor' => null]); // ext-wp-3 が消えた
$svc->sync('full', true, 'u_wp');
assert_true('ext-wp-3はmissing_upstream', ($getWpLink('ext-wp-3')['sync_state'] ?? null) === 'missing_upstream');
assert_true('ext-wp-2はok', ($getWpLink('ext-wp-2')['sync_state'] ?? null) === 'ok');
$wp3ItemId = $getWpLink('ext-wp-3')['youkan_item_id'];
assert_true('work_package itemは削除されない', $pdo->query("SELECT COUNT(*) FROM items WHERE id = " . $pdo->quote($wp3ItemId))->fetchColumn() == 1);

echo "\n=== テスト9: work_package消失（子タスクあり）→ missing_upstream、子タスクも削除されない ===\n";
$http->enqueue(200, ['data' => [bvrProject(1002, [])], 'next_cursor' => null]); // ext-wp-1 が消えた（空配列）
$svc->sync('full', true, 'u_wp');
assert_true('ext-wp-1はmissing_upstream（空配列でも個別消失と同じ扱い）', ($getWpLink('ext-wp-1')['sync_state'] ?? null) === 'missing_upstream');
assert_true('配下の子タスク2件は削除されない', $pdo->query("SELECT COUNT(*) FROM items WHERE id IN ('wp1_child','wp1_child2')")->fetchColumn() == 2);
assert_true('work_package item自体も削除されない', $pdo->query("SELECT COUNT(*) FROM items WHERE id = " . $pdo->quote($wp1['youkan_item_id']))->fetchColumn() == 1);

echo "\n=== テスト10: 再出現でok復帰、item/子タスクは作り直さない ===\n";
$before = $countWpItems();
$http->enqueue(200, ['data' => [bvrProject(1002, [bvrWp('ext-wp-1', ['label' => '建具A 製作', 'estimated_hours' => 12.0])])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
$wp1Restored = $getWpLink('ext-wp-1');
assert_true('ok に復帰し baseline が最新化', $wp1Restored['sync_state'] === 'ok' && (int)$wp1Restored['baseline_minutes'] === 720);
assert_true('item数が変わらない（作り直さない）', $countWpItems() === $before);
assert_true('youkan_item_idが同じ', $wp1Restored['youkan_item_id'] === $wp1['youkan_item_id']);

echo "\n=== テスト11: diffモードは欠落検知しない（§5.2） ===\n";
$before9State = $getWpLink('ext-wp-2')['sync_state'];
$http->enqueue(200, ['data' => [bvrProject(1003, [])], 'next_cursor' => null]); // ext-wp-2 が見えなくなった
$svc->sync('diff', true, 'u_wp');
assert_true('diffでは欠落検知しない（ext-wp-2はokのまま）', ($getWpLink('ext-wp-2')['sync_state'] ?? null) === 'ok', json_encode($getWpLink('ext-wp-2')));

echo "\n=== テスト12: manual→estimate切替（見積追加で初めてwork_packagesが現れる） ===\n";
$countBefore = $countWpLinks();
$http->enqueue(200, ['data' => [bvrProject(1001, [bvrWp('ext-wp-manual-1')])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
assert_true('新規にwork_packageが取り込まれる', $getWpLink('ext-wp-manual-1') !== null && $countWpLinks() === $countBefore + 1);

echo "\n=== テスト13: estimate更新後の再同期でwork_package baselineのみ更新 ===\n";
$manualWp = $getWpLink('ext-wp-manual-1');
$http->enqueue(200, ['data' => [bvrProject(1001, [bvrWp('ext-wp-manual-1', ['estimated_hours' => 3.0])])], 'next_cursor' => null]);
$svc->sync('full', true, 'u_wp');
$manualWpAfter = $getWpLink('ext-wp-manual-1');
assert_true('baselineのみ更新', (int)$manualWpAfter['baseline_minutes'] === 180 && $manualWpAfter['youkan_item_id'] === $manualWp['youkan_item_id']);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
