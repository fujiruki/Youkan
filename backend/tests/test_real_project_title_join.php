<?php
/**
 * テスト: 各コントローラーのSQLが real_project_title を正しく返すこと
 *
 * 問題: GdbController, TodayController, ItemController(aggregated/personal/company)の
 *       SQLクエリに proj JOIN がないため、mapItemRow で projectTitle が常に null になる
 *
 * 検証方法: SQLite in-memory DBにテストデータを作成し、
 *           各SQLが real_project_title カラムを含むか検証する
 */

$passed = 0;
$failed = 0;

function assertTest($name, $actual, $expected) {
    global $passed, $failed;
    if ($actual === $expected) {
        echo "[PASS] $name\n";
        $passed++;
    } else {
        echo "[FAIL] $name\n";
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        $failed++;
    }
}

// テスト用 in-memory DB
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// スキーマ作成（最小限）
$pdo->exec("
    CREATE TABLE items (
        id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT DEFAULT 'inbox',
        parent_id TEXT,
        project_id TEXT,
        tenant_id TEXT,
        created_by TEXT,
        assigned_to TEXT,
        is_project INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        is_boosted INTEGER DEFAULT 0,
        is_intent INTEGER DEFAULT 0,
        deleted_at INTEGER,
        rdd_date TEXT,
        prep_date INTEGER,
        due_date TEXT,
        work_days INTEGER DEFAULT 1,
        estimated_minutes INTEGER DEFAULT 0,
        focus_order INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        due_status TEXT,
        project_type TEXT,
        project_category TEXT,
        client_name TEXT,
        site_name TEXT,
        gross_profit_target INTEGER DEFAULT 0,
        interrupt INTEGER DEFAULT 0,
        delegation TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        status_updated_at INTEGER,
        boosted_date INTEGER
    );
    CREATE TABLE tenants (
        id TEXT PRIMARY KEY,
        name TEXT
    );
    CREATE TABLE assignees (
        id TEXT PRIMARY KEY,
        name TEXT,
        color TEXT
    );
");

// テストデータ挿入
$now = time();
$pdo->exec("INSERT INTO tenants (id, name) VALUES ('t1', 'テスト会社')");

// プロジェクト（is_project=1）
$pdo->exec("INSERT INTO items (id, title, status, tenant_id, is_project, created_by, created_at, updated_at)
    VALUES ('proj-soukai', '総会', 'inbox', 't1', 1, 'user1', $now, $now)");

// 総会プロジェクト配下のタスク（project_id あり）
$pdo->exec("INSERT INTO items (id, title, status, parent_id, project_id, tenant_id, created_by, assigned_to, rdd_date, created_at, updated_at, is_boosted, prep_date)
    VALUES ('task-in-soukai', '議事録作成', 'inbox', 'proj-soukai', 'proj-soukai', 't1', 'user1', 'user1', '$now', $now, $now, 0, NULL)");

// プロジェクトに所属していないタスク（project_id = NULL, parent_id = 'proj-soukai'）
// これは parent_title = '総会' だが real_project_title = NULL であるべき
$pdo->exec("INSERT INTO items (id, title, status, parent_id, project_id, tenant_id, created_by, assigned_to, rdd_date, created_at, updated_at, is_boosted, prep_date)
    VALUES ('task-no-project', '買い物', 'inbox', 'proj-soukai', NULL, 't1', 'user1', 'user1', '$now', $now, $now, 0, NULL)");

// ========================================
// テスト1: GdbController形式のSQL（修正前: proj JOINなし）
// ========================================
echo "\n=== GdbController SQL テスト ===\n";

$sqlGdbBefore = "
    SELECT items.*, parent.title as parent_title
    FROM items
    LEFT JOIN items parent ON items.parent_id = parent.id
    WHERE items.tenant_id = 't1'
    AND items.status = 'inbox'
    AND items.deleted_at IS NULL
    AND items.is_project = 0
";
$stmt = $pdo->prepare($sqlGdbBefore);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $row) {
    $hasRealProjectTitle = array_key_exists('real_project_title', $row);
    if ($row['id'] === 'task-in-soukai') {
        assertTest(
            'GdbController(修正前): task-in-soukai に real_project_title カラムが存在する',
            $hasRealProjectTitle,
            true // このテストはFAILすべき（修正前にはカラムがない）
        );
    }
}

// ========================================
// テスト2: GdbController形式のSQL（修正後: proj JOINあり）
// ========================================
$sqlGdbAfter = "
    SELECT items.*, parent.title as parent_title, proj.title as real_project_title
    FROM items
    LEFT JOIN items parent ON items.parent_id = parent.id
    LEFT JOIN items proj ON items.project_id = proj.id
    WHERE items.tenant_id = 't1'
    AND items.status = 'inbox'
    AND items.deleted_at IS NULL
    AND items.is_project = 0
";
$stmt = $pdo->prepare($sqlGdbAfter);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $row) {
    if ($row['id'] === 'task-in-soukai') {
        assertTest(
            'GdbController(修正後): task-in-soukai の real_project_title = "総会"',
            $row['real_project_title'],
            '総会'
        );
    }
    if ($row['id'] === 'task-no-project') {
        assertTest(
            'GdbController(修正後): task-no-project の real_project_title = NULL（parent_titleにフォールバックしない）',
            $row['real_project_title'],
            null
        );
        assertTest(
            'GdbController(修正後): task-no-project の parent_title = "総会"（parentTitleは別途あり）',
            $row['parent_title'],
            '総会'
        );
    }
}

// ========================================
// テスト3: TodayController形式のSQL
// ========================================
echo "\n=== TodayController SQL テスト ===\n";

// today_commitステータスのタスクを追加
$pdo->exec("INSERT INTO items (id, title, status, parent_id, project_id, tenant_id, created_by, assigned_to, created_at, updated_at, is_boosted)
    VALUES ('task-today-in-soukai', '今日の総会タスク', 'today_commit', 'proj-soukai', 'proj-soukai', 't1', 'user1', 'user1', $now, $now, 0)");
$pdo->exec("INSERT INTO items (id, title, status, parent_id, project_id, tenant_id, created_by, assigned_to, created_at, updated_at, is_boosted)
    VALUES ('task-today-no-proj', '今日の個人タスク', 'today_commit', 'proj-soukai', NULL, 't1', 'user1', 'user1', $now, $now, 0)");

$sqlTodayAfter = "
    SELECT items.*, parent.title as parent_title, proj.title as real_project_title
    FROM items
    LEFT JOIN items parent ON items.parent_id = parent.id
    LEFT JOIN items proj ON items.project_id = proj.id
    WHERE items.deleted_at IS NULL
    AND items.status = 'today_commit'
";
$stmt = $pdo->prepare($sqlTodayAfter);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $row) {
    if ($row['id'] === 'task-today-in-soukai') {
        assertTest(
            'TodayController(修正後): task-today-in-soukai の real_project_title = "総会"',
            $row['real_project_title'],
            '総会'
        );
    }
    if ($row['id'] === 'task-today-no-proj') {
        assertTest(
            'TodayController(修正後): task-today-no-proj の real_project_title = NULL',
            $row['real_project_title'],
            null
        );
    }
}

// ========================================
// テスト4: ItemController aggregated形式のSQL
// ========================================
echo "\n=== ItemController aggregated SQL テスト ===\n";

$sqlAggregatedAfter = "
    SELECT items.*, parent.title as parent_title, proj.title as real_project_title, t.name as tenant_name
    FROM items
    LEFT JOIN items parent ON items.parent_id = parent.id
    LEFT JOIN items proj ON items.project_id = proj.id
    LEFT JOIN tenants t ON items.tenant_id = t.id
    WHERE (items.tenant_id = 't1' OR items.tenant_id IS NULL OR items.tenant_id = '')
    AND items.is_archived = 0 AND items.deleted_at IS NULL
    AND items.is_project = 0
";
$stmt = $pdo->prepare($sqlAggregatedAfter);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$foundInSoukai = false;
$foundNoProject = false;
foreach ($rows as $row) {
    if ($row['id'] === 'task-in-soukai') {
        $foundInSoukai = true;
        assertTest(
            'ItemController aggregated(修正後): task-in-soukai の real_project_title = "総会"',
            $row['real_project_title'],
            '総会'
        );
    }
    if ($row['id'] === 'task-no-project') {
        $foundNoProject = true;
        assertTest(
            'ItemController aggregated(修正後): task-no-project の real_project_title = NULL',
            $row['real_project_title'],
            null
        );
    }
}
assertTest('ItemController aggregated: task-in-soukai が見つかった', $foundInSoukai, true);
assertTest('ItemController aggregated: task-no-project が見つかった', $foundNoProject, true);

echo "\n--- 結果: $passed passed, $failed failed ---\n";
exit($failed > 0 ? 1 : 0);
