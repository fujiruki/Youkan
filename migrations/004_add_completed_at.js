/**
 * Migration: itemsテーブルにcompleted_atカラムを追加
 * completed_at: status=doneに変更した瞬間のUnixタイムスタンプ
 */
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.argv[2] || 'backend/jbwos.sqlite';
const db = new DatabaseSync(dbPath);

try {
  const columns = db.prepare("PRAGMA table_info(items)").all();
  const hasColumn = columns.some(c => c.name === 'completed_at');

  if (hasColumn) {
    console.log('completed_at カラムは既に存在します。スキップします。');
  } else {
    db.exec("ALTER TABLE items ADD COLUMN completed_at INTEGER");
    console.log('completed_at カラムを追加しました。');
  }

  // 確認
  const updated = db.prepare("PRAGMA table_info(items)").all();
  const found = updated.find(c => c.name === 'completed_at');
  if (found) {
    console.log(`確認OK: completed_at (type: ${found.type})`);
  } else {
    console.error('エラー: completed_at カラムが見つかりません');
    process.exit(1);
  }
} finally {
  db.close();
}
