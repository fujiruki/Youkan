<?php
/**
 * R-140 番頭連携API テスト
 *
 * 1. GET /integrations/digest: api_token Bearer で 200、他ユーザーのアイテムを含まない、JWT でも同結果
 * 2. /user/api-tokens: 発行 → そのトークンで digest 200 → 一覧（平文なし）→ 失効 → 401、他人のトークンは 404
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r140_test_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../IntegrationController.php';
require_once __DIR__ . '/../UserController.php';
require_once __DIR__ . '/../JWTService.php';

$passed = 0;
$failed = 0;
function assert_true($label, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label" . ($detail !== '' ? " ($detail)" : '') . "\n"; $failed++; }
}

class ApiError extends Exception {}

trait CaptureResponse {
    public $lastResponse = null;
    protected function sendJSON($data) { $this->lastResponse = $data; }
    protected function sendError($code, $message) { throw new ApiError($message, $code); }
}
class TestIntegrationController extends IntegrationController { use CaptureResponse; }
class TestUserController extends UserController {
    use CaptureResponse;
    public $input = [];
    protected function getInput() { return $this->input; }
}

function callDigest(array $query = []) {
    $_GET = $query;
    $ctrl = new TestIntegrationController();
    try {
        $ctrl->handleRequest('GET', '/digest');
        return [200, $ctrl->lastResponse];
    } catch (ApiError $e) {
        return [$e->getCode(), ['error' => $e->getMessage()]];
    }
}

function callUser($method, $path, array $input = []) {
    $_GET = [];
    $ctrl = new TestUserController();
    $ctrl->input = $input;
    try {
        $ctrl->handleRequest($method, $path);
        return [200, $ctrl->lastResponse];
    } catch (ApiError $e) {
        return [$e->getCode(), ['error' => $e->getMessage()]];
    }
}

// --- データ準備 ---
$pdo = getDB();
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_a', 'テナントA', 0)");
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_a', 'a@example.com', password_hash('pw', PASSWORD_DEFAULT), 'A']);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_b', 'b@example.com', password_hash('pw', PASSWORD_DEFAULT), 'B']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES ('u_a', 't_a', 'owner', 0)");
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES ('u_b', 't_a', 'member', 0)");
$pdo->exec("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES ('tok_a', 'u_a', 'sk_a_secret', '番頭', 0)");
$pdo->exec("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES ('tok_b', 'u_b', 'sk_b_secret', 'Bの', 0)");

$TODAY = '2026-08-18'; // 火曜。週は 08-17(月) 始まり
$mondayTs = strtotime('2026-08-17 09:00:00');
$lastWeekTs = strtotime('2026-08-10 09:00:00');
$now = time();
$ins = $pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, is_project, project_id, client_name, due_date, review_date, estimated_minutes, status_updated_at, meta, sort_order, created_at, updated_at)
                      VALUES (?, ?, ?, 't_a', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$rows = [
    // id, title, status, created_by, assigned_to, is_project, project_id, client_name, due_date, review_date, est, status_updated_at, meta, sort_order
    ['proj_a',    '案件A',            'todo',      'u_a', null,  1, null,     '得意先X', '2026-08-01', null,         0,   0, null, 0],
    ['a_od1',     'A超過 案件A 30分',  'inbox',     'u_a', null,  0, 'proj_a', '得意先X', '2026-08-10', null,         30,  0, null, 0],
    ['a_od2',     'A超過 案件A 60分',  'todo',      'u_a', null,  0, 'proj_a', '得意先X', '2026-08-05', null,         60,  0, null, 0],
    ['a_od_none', 'A超過 案件なし',    'inbox',     'u_a', null,  0, null,     null,      '2026-08-12', null,         15,  0, null, 0],
    ['a_od_ct',   'A超過 連絡済み',    'inbox',     'u_a', null,  0, null,     null,      '2026-08-01', null,         10,  0, '{"contacted_at":"2026-08-17"}', 0],
    ['a_review',  'A再確認到来',       'pending',   'u_a', null,  0, null,     null,      null,         '2026-08-18', 5,   0, null, 0],
    ['a_focus1',  'A focus 手動2',     'focus',     'u_a', null,  0, 'proj_a', null,      null,         null,         20,  0, null, 2],
    ['a_focus2',  'A focus 手動1',     'focus',     null,  'u_a', 0, null,     null,      '2026-08-20', null,         40,  0, null, 1],
    ['a_decl1',   'A断った今週',       'cancelled', 'u_a', null,  0, null,     null,      '2026-08-01', null,         0,   $mondayTs, null, 0],
    ['a_decl_old','A断った先週',       'cancelled', 'u_a', null,  0, null,     null,      '2026-08-01', null,         0,   $lastWeekTs, null, 0],
    ['a_future',  'A未来',             'inbox',     'u_a', null,  0, null,     null,      '2026-08-25', null,         0,   0, null, 0],
    ['b_od',      'B超過',             'inbox',     'u_b', null,  0, null,     null,      '2026-08-01', null,         5,   0, null, 0],
    ['b_focus',   'B focus',           'focus',     'u_b', null,  0, null,     null,      null,         null,         5,   0, null, 0],
];
foreach ($rows as $r) {
    $ins->execute(array_merge($r, [$now, $now]));
}

$_COOKIE = [];

// ========== 1. digest ==========
echo "\n=== テスト1: api_token Bearer で digest ===\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_a_secret';
[$code, $res] = callDigest(['date' => $TODAY, 'limit' => '2']);
assert_true('200 が返る', $code === 200, "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));

$queueIds = array_map(fn($i) => $i['id'], $res['review_queue']['items'] ?? []);
assert_true('review_queue.total = 5（超過4件＋再確認1件、連絡済みも含む）', ($res['review_queue']['total'] ?? null) === 5, 'total=' . json_encode($res['review_queue']['total'] ?? null));
assert_true('review_queue.items は limit=2 件', count($queueIds) === 2, json_encode($queueIds));
assert_true('先頭は再確認到来 → 次に目安の短い超過(a_od_ct 10分)', $queueIds === ['a_review', 'a_od_ct'], json_encode($queueIds));
$first = $res['review_queue']['items'][1] ?? [];
assert_true('items の各要素に必要なキーが揃う', isset($first['id'], $first['title'], $first['status'], $first['estimated_minutes']) && array_key_exists('project_title', $first) && array_key_exists('due_date', $first) && array_key_exists('prep_date', $first) && array_key_exists('review_date', $first) && array_key_exists('overdue_days', $first), json_encode($first, JSON_UNESCAPED_UNICODE));
assert_true('overdue_days は今日と有効締切の差（a_od_ct: 8/1 → 17日）', ($first['overdue_days'] ?? null) === 17, json_encode($first['overdue_days'] ?? null));

[$code, $resAll] = callDigest(['date' => $TODAY, 'limit' => '20']);
$allIds = array_map(fn($i) => $i['id'], $resAll['review_queue']['items']);
assert_true('他ユーザー(u_b)のアイテムを含まない', !in_array('b_od', $allIds, true), json_encode($allIds));
assert_true('review_queue 全件の並び', $allIds === ['a_review', 'a_od_ct', 'a_od_none', 'a_od1', 'a_od2'], json_encode($allIds));

$wl = $res['week_load'] ?? [];
assert_true('week_load は calcWeekLoad のキーをそのまま持つ', isset($wl['capacity_minutes'], $wl['need_minutes'], $wl['shortfall_minutes'], $wl['week_end'], $wl['over_candidates']), json_encode($wl));
assert_true('week_load.week_end = 2026-08-23', ($wl['week_end'] ?? null) === '2026-08-23');
assert_true('week_load.need_minutes は超過分＋今週分（30+60+15+10+40=155）', ($wl['need_minutes'] ?? null) === 155, json_encode($wl['need_minutes'] ?? null));

$uo = $res['uncontacted_overdue'] ?? null;
assert_true('uncontacted_overdue は案件別2件（案件A・案件なし）', is_array($uo) && count($uo) === 2, json_encode($uo, JSON_UNESCAPED_UNICODE));
assert_true('案件A: count=2 total_minutes=90 oldest_due_date=2026-08-05 client_name=得意先X', ($uo[0]['project_id'] ?? null) === 'proj_a' && ($uo[0]['project_title'] ?? null) === '案件A' && ($uo[0]['client_name'] ?? null) === '得意先X' && ($uo[0]['count'] ?? null) === 2 && ($uo[0]['total_minutes'] ?? null) === 90 && ($uo[0]['oldest_due_date'] ?? null) === '2026-08-05', json_encode($uo[0] ?? null, JSON_UNESCAPED_UNICODE));
assert_true('案件なしは最後（project_id=null, count=1, 連絡済みは含まない）', array_key_exists('project_id', $uo[1] ?? []) && $uo[1]['project_id'] === null && ($uo[1]['count'] ?? null) === 1 && ($uo[1]['oldest_due_date'] ?? null) === '2026-08-12', json_encode($uo[1] ?? null, JSON_UNESCAPED_UNICODE));

assert_true('declined_this_week = 1（先週分は含まない）', ($res['declined_this_week'] ?? null) === 1, json_encode($res['declined_this_week'] ?? null));

$focusIds = array_map(fn($i) => $i['id'], $res['focus'] ?? []);
assert_true('focus は本人分のみ・既存 focus 並び順（sort_order 昇順）', $focusIds === ['a_focus2', 'a_focus1'], json_encode($focusIds));
$f0 = $res['focus'][0] ?? [];
assert_true('focus の各要素のキー', isset($f0['id'], $f0['title'], $f0['estimated_minutes']) && array_key_exists('project_title', $f0) && array_key_exists('due_date', $f0), json_encode($f0, JSON_UNESCAPED_UNICODE));

echo "\n=== テスト2: JWT でも同結果 ===\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . JWTService::encrypt(['sub' => 'u_a', 'tenant_id' => 't_a', 'role' => 'owner', 'exp' => time() + 3600]);
[$code2, $res2] = callDigest(['date' => $TODAY, 'limit' => '2']);
assert_true('JWT で 200', $code2 === 200, "code=$code2");
assert_true('JWT と api_token で同一レスポンス', $res2 === $res, json_encode([$res2, $res], JSON_UNESCAPED_UNICODE));

echo "\n=== テスト3: date 省略・limit 上限・不正トークン ===\n";
[$code3, $res3] = callDigest([]);
assert_true('date 省略で 200', $code3 === 200);
[$code3b, $res3b] = callDigest(['date' => $TODAY, 'limit' => '999']);
assert_true('limit は上限20に丸める（total<=20 のため全件）', count($res3b['review_queue']['items']) === 5);
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_nobody';
[$code4] = callDigest(['date' => $TODAY]);
assert_true('不正トークンは 401', $code4 === 401, "code=$code4");

// ========== 2. api-tokens ==========
echo "\n=== テスト4: 発行 → 利用 → 一覧 → 失効 → 401 ===\n";
$jwtA = 'Bearer ' . JWTService::encrypt(['sub' => 'u_a', 'tenant_id' => 't_a', 'role' => 'owner', 'exp' => time() + 3600]);
$_SERVER['HTTP_AUTHORIZATION'] = $jwtA;
[$c, $created] = callUser('POST', '/api-tokens', ['label' => '番頭2']);
assert_true('POST /user/api-tokens が 200 で id/label/token を返す', $c === 200 && !empty($created['id']) && ($created['label'] ?? null) === '番頭2' && !empty($created['token']), json_encode($created));
assert_true('token は 64桁hex', is_string($created['token'] ?? null) && preg_match('/^[0-9a-f]{64}$/', $created['token']) === 1);

$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $created['token'];
[$c2] = callDigest(['date' => $TODAY]);
assert_true('発行したトークンで digest 200', $c2 === 200, "code=$c2");

$_SERVER['HTTP_AUTHORIZATION'] = $jwtA;
[$c3, $list] = callUser('GET', '/api-tokens');
assert_true('GET /user/api-tokens が本人分（tok_a＋新規）を返す', $c3 === 200 && count($list) === 2, json_encode($list, JSON_UNESCAPED_UNICODE));
$new = array_values(array_filter($list, fn($t) => $t['id'] === $created['id']))[0] ?? null;
assert_true('一覧に平文 token を含まず id/label/created_at/last_used_at を持つ', $new !== null && !array_key_exists('token', $new) && array_key_exists('created_at', $new) && array_key_exists('last_used_at', $new), json_encode($new));
assert_true('利用後は last_used_at が入る', !empty($new['last_used_at']));

[$c4, $del] = callUser('DELETE', '/api-tokens/' . $created['id']);
assert_true('DELETE /user/api-tokens/{id} が 200', $c4 === 200, "code=$c4 " . json_encode($del));
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $created['token'];
[$c5] = callDigest(['date' => $TODAY]);
assert_true('失効後は 401', $c5 === 401, "code=$c5");

$_SERVER['HTTP_AUTHORIZATION'] = $jwtA;
[$c6] = callUser('DELETE', '/api-tokens/tok_b');
assert_true('他人のトークンは 404', $c6 === 404, "code=$c6");
assert_true('他人のトークンは消えていない', (int)$pdo->query("SELECT COUNT(*) FROM api_tokens WHERE id = 'tok_b'")->fetchColumn() === 1);
[$c7] = callUser('POST', '/api-tokens', ['label' => '']);
assert_true('label 空は 400', $c7 === 400, "code=$c7");

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
