<?php
/**
 * R-096: Youkan の既存ユーザーを auth-hub へ登録し、users.auth_user_id で紐づける。
 *
 * 使い方（既定はドライラン。--apply を付けたときだけ書き込む）:
 *   php backend/scripts/migrate_users_to_auth_hub.php --auth-db=/path/to/auth.sqlite
 *   php backend/scripts/migrate_users_to_auth_hub.php --auth-db=/path/to/auth.sqlite --apply
 *
 * パスワードハッシュは PHP 標準の password_hash() 出力で、文字列自体にアルゴリズムが
 * 埋め込まれている。auth-hub 側の検証も password_verify() のため、bcrypt のハッシュを
 * そのまま移設すれば既存のパスワードで引き続きログインできる（作り直し・リセット不要）。
 *
 * Youkan 側の users.password_hash は削除しない。従来のJWTログインは併存させる方針のため。
 */

$options = getopt('', ['auth-db:', 'apply']);
if (!isset($options['auth-db'])) {
    fwrite(STDERR, "--auth-db=<auth-hubのsqliteパス> を指定してください\n");
    exit(1);
}

$authDbPath = $options['auth-db'];
$apply = isset($options['apply']);

if (!file_exists($authDbPath)) {
    fwrite(STDERR, "auth-hub のDBが見つかりません: $authDbPath\n");
    exit(1);
}

$youkanDbPath = getenv('YOUKAN_DB_PATH') ?: __DIR__ . '/../jbwos.sqlite';

$youkan = new PDO('sqlite:' . $youkanDbPath);
$youkan->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$auth = new PDO('sqlite:' . $authDbPath);
$auth->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$now = gmdate('Y-m-d\TH:i:s\Z');

echo ($apply ? '[APPLY]' : '[DRY-RUN]') . " Youkan: $youkanDbPath -> auth-hub: $authDbPath\n\n";

$rows = $youkan->query("SELECT id, email, display_name, password_hash, auth_user_id FROM users")->fetchAll(PDO::FETCH_ASSOC);

$linked = 0;
$skipped = 0;

if ($apply) {
    $auth->beginTransaction();
    $youkan->beginTransaction();
}

foreach ($rows as $row) {
    $label = $row['id'] . ' (' . $row['email'] . ')';

    if ($row['auth_user_id'] !== null) {
        echo "SKIP  $label: 既に auth_user_id={$row['auth_user_id']} で紐づけ済み\n";
        $skipped++;
        continue;
    }

    $email = strtolower(trim((string)$row['email']));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo "SKIP  $label: メールアドレスが不正\n";
        $skipped++;
        continue;
    }

    // password_hash() の出力でないもの（テスト用のダミー値等）は移設対象にしない
    if (password_get_info((string)$row['password_hash'])['algo'] === null) {
        echo "SKIP  $label: password_hash が正規のハッシュではない\n";
        $skipped++;
        continue;
    }

    $st = $auth->prepare("SELECT id FROM users WHERE email = ?");
    $st->execute([$email]);
    $authUserId = $st->fetchColumn();

    if ($authUserId === false) {
        $name = trim((string)$row['display_name']) ?: explode('@', $email)[0];
        echo "CREATE $label: auth-hub に users を新規作成（name={$name}）\n";
        if ($apply) {
            $auth->prepare("INSERT INTO users (email, name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)")
                ->execute([$email, $name, $now, $now]);
            $authUserId = (int)$auth->lastInsertId();
        }
    } else {
        $authUserId = (int)$authUserId;
        echo "REUSE $label: auth-hub の既存ユーザー id=$authUserId を使う\n";
    }

    if ($apply) {
        // 既に別経路（管理者登録・Google）でidentityがある場合は上書きしない
        $auth->prepare("INSERT OR IGNORE INTO auth_identities (user_id, provider, provider_uid, secret_hash, created_at, updated_at) VALUES (?, 'password', ?, ?, ?, ?)")
            ->execute([$authUserId, $email, $row['password_hash'], $now, $now]);
        $youkan->prepare("UPDATE users SET auth_user_id = ? WHERE id = ?")
            ->execute([$authUserId, $row['id']]);
    }

    $linked++;
}

if ($apply) {
    $auth->commit();
    $youkan->commit();
}

echo "\n紐づけ: $linked 件 / スキップ: $skipped 件\n";
if (!$apply) {
    echo "書き込みは行っていません。実行するには --apply を付けてください。\n";
}
