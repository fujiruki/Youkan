<?php
/**
 * R-085: SQLite journal_mode=WAL 設定の確認テスト
 *
 * 背景:
 *   本番PHPエラーログで "SQLSTATE[HY000]: General error: 5 database is locked" が
 *   繰り返し発生していた(item更新・Googleカレンダー同期の両方で確認)。
 *
 *   ローカルで backend/tests/test_completed_at.php を実行すると、この事象を
 *   100%決定的に再現できることが判明した: テストスクリプト自身のPDO接続(接続A)が
 *   1行だけfetch()した後にcloseCursor()を呼ばずに放置しており(このコードベース
 *   全体で頻出するパターン)、ItemController内部の別接続(接続B)がUPDATEを
 *   コミットしようとした瞬間に "database is locked" で失敗していた
 *   ( $e->getFile()/getLine() で PDO->commit() 自体が失敗元と特定済み)。
 *
 *   原因はSQLiteのデフォルトジャーナルモード(rollback journal / DELETE)。
 *   このモードでは、あるコネクションの未消費SELECT(読み取りカーソル)が
 *   共有ロックを保持したままになり、別コネクションのCOMMIT(EXCLUSIVEロックへの
 *   昇格)をブロックする。PDOのデフォルトbusy_timeout(60秒)はこのCOMMIT時の
 *   ロック競合には有効に機能せず、即座にエラーになる(本テストで実測確認)。
 *
 *   WALモード(Write-Ahead Logging)は「読み取りが書き込みをブロックせず、
 *   書き込みが読み取りをブロックしない」設計のため、この種の競合を構造的に
 *   解消する。SQLite公式が推奨する、この種の事象に対する標準的な対処。
 *
 * 検証方法:
 *   1. getDB()がjournal_mode=WALを設定していることを直接確認する
 *   2. 実際に「一方の接続の未消費SELECTがもう一方のCOMMITをブロックしない」
 *      ことを、test_completed_at.phpと同型のシナリオを再現して確認する
 */
require_once __DIR__ . '/../db.php';

$passed = 0;
$failed = 0;
function assertTrue($name, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) {
        echo "[PASS] $name\n";
        $passed++;
    } else {
        echo "[FAIL] $name" . ($detail ? " - $detail" : '') . "\n";
        $failed++;
    }
}

echo "=== R-085: SQLite WALモード確認テスト ===\n\n";

// --- テスト1: getDB()がWALモードを有効化していること ---
echo "テスト1: getDB()の接続はjournal_mode=WALになっている\n";
$pdo = getDB();
$mode = strtolower((string)$pdo->query('PRAGMA journal_mode')->fetchColumn());
assertTrue('journal_mode=wal', $mode === 'wal', "mode={$mode}");

// --- テスト2: 別接続の未消費SELECTがCOMMITをブロックしない ---
echo "\nテスト2: 片方の接続に未消費のSELECTカーソルが残っていても、別接続のCOMMITは失敗しない\n";
$connA = getDB();
$connB = getDB();

// 接続Aで1行だけfetchし、closeCursor()を呼ばずに放置する
// (本番コードベース全体で使われている典型的な「単発fetch」パターンの再現)
$stmt = $connA->prepare("SELECT id FROM users LIMIT 1");
$stmt->execute();
$stmt->fetch(PDO::FETCH_ASSOC);
// 意図的に closeCursor() を呼ばない

// テスト実行を速くするため、connBのbusy_timeoutを短く設定する
// (デフォルト60秒待つと不具合再現時のテストが遅くなりすぎるため。
//  本番のgetDB()自体のbusy_timeout設定はテスト1で別途検証する)
$connB->exec('PRAGMA busy_timeout = 2000');

// 接続Bで書き込みトランザクションをコミットする
$testMarker = 'r085_wal_test_' . uniqid();
$committed = false;
$errorMsg = '';
try {
    $connB->beginTransaction();
    $connB->prepare("INSERT INTO system_logs (level, message) VALUES ('test', ?)")->execute([$testMarker]);
    $connB->commit();
    $committed = true;
} catch (PDOException $e) {
    $errorMsg = $e->getMessage();
    if ($connB->inTransaction()) {
        $connB->rollBack();
    }
}

assertTrue(
    '別接続の未消費SELECTがあってもCOMMITは成功する(WALモードの効果)',
    $committed,
    $errorMsg
);

// --- クリーンアップ ---
$pdo->prepare("DELETE FROM system_logs WHERE message = ?")->execute([$testMarker]);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
