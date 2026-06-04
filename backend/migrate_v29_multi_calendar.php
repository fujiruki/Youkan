<?php
// backend/migrate_v29_multi_calendar.php
// R-041: 複数 Google カレンダー対応のための新規テーブル `user_google_calendars`
//
// 設計:
//   - 1 ユーザーが連携しているすべての Google カレンダーをローカル DB で管理
//   - is_enabled で表示 ON/OFF（前提: 初回連携時は全 ON）
//   - Google 側で削除されたカレンダーは deleted_at を立て論理削除し、行は残す
//   - calendarList.list のレスポンスに `backgroundColor` が含まれるため color_hex に保存
//   - sort_order は v1 では Google 返却順を採用（並べ替え機能は R-043 で対応）
//
// 既存 `external_events_cache` のキャッシュ key 戦略は GoogleCalendarService::getEvents() で
// `google:{calendar_id}:{event_id}` に変更（カレンダー別に分離キャッシュ）。テーブル定義は変更不要。
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v29 (Multi Google Calendar support)...\n";

    $tables = [];
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $tables[] = $row['name'];
    }

    if (!in_array('user_google_calendars', $tables)) {
        echo "Creating user_google_calendars table...\n";
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS user_google_calendars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                calendar_id TEXT NOT NULL,
                summary TEXT,
                description TEXT,
                color_hex TEXT,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0,
                last_synced_at INTEGER,
                deleted_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(user_id, calendar_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_user_google_calendars_user ON user_google_calendars(user_id, is_enabled)");
        echo "user_google_calendars table created.\n";
    } else {
        echo "user_google_calendars table already exists.\n";
        // 既存テーブルが旧スキーマの場合に備え、不足カラムを追加（idempotent）
        $cols = [];
        $stmt = $pdo->query("PRAGMA table_info(user_google_calendars)");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { $cols[] = $row['name']; }
        $needed = [
            'description' => 'TEXT',
            'color_hex' => 'TEXT',
            'is_enabled' => 'INTEGER NOT NULL DEFAULT 1',
            'sort_order' => 'INTEGER NOT NULL DEFAULT 0',
            'last_synced_at' => 'INTEGER',
            'deleted_at' => 'INTEGER',
        ];
        foreach ($needed as $col => $def) {
            if (!in_array($col, $cols)) {
                $pdo->exec("ALTER TABLE user_google_calendars ADD COLUMN $col $def");
                echo "  added column: $col\n";
            }
        }
    }

    echo "Migration v29 completed successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
