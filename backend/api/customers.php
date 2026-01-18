<?php
/**
 * Customer Plugin - API Handler
 * 
 * 顧客管理のCRUD API
 */

require_once __DIR__ . '/../db.php';

/**
 * 顧客テーブルを作成（存在しない場合）
 */
function ensureCustomerTable(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_kana TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            closing_day INTEGER,
            payment_type TEXT DEFAULT 'credit',
            carry_over REAL DEFAULT 0,
            memo TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    ");
}

/**
 * 顧客一覧を取得
 */
function getCustomers(PDO $pdo, array $params): array {
    $sql = "SELECT * FROM customers WHERE 1=1";
    $bindings = [];
    
    // 検索クエリ
    if (!empty($params['query'])) {
        $sql .= " AND (name LIKE :query OR name_kana LIKE :query)";
        $bindings[':query'] = '%' . $params['query'] . '%';
    }
    
    // 支払タイプフィルタ
    if (!empty($params['paymentType'])) {
        $sql .= " AND payment_type = :paymentType";
        $bindings[':paymentType'] = $params['paymentType'];
    }
    
    $sql .= " ORDER BY name_kana, name";
    
    // ページネーション
    if (!empty($params['limit'])) {
        $sql .= " LIMIT " . intval($params['limit']);
        if (!empty($params['offset'])) {
            $sql .= " OFFSET " . intval($params['offset']);
        }
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindings);
    
    return array_map('dbRowToCustomer', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

/**
 * 顧客を取得
 */
function getCustomer(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare("SELECT * FROM customers WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    return $row ? dbRowToCustomer($row) : null;
}

/**
 * 顧客を作成
 */
function createCustomer(PDO $pdo, array $data): array {
    $id = 'cust_' . bin2hex(random_bytes(8));
    $now = time() * 1000; // ミリ秒
    
    $stmt = $pdo->prepare("
        INSERT INTO customers (id, name, name_kana, address, phone, email, closing_day, payment_type, carry_over, memo, created_at, updated_at)
        VALUES (:id, :name, :nameKana, :address, :phone, :email, :closingDay, :paymentType, :carryOver, :memo, :createdAt, :updatedAt)
    ");
    
    $stmt->execute([
        ':id' => $id,
        ':name' => $data['name'],
        ':nameKana' => $data['nameKana'] ?? null,
        ':address' => $data['address'] ?? null,
        ':phone' => $data['phone'] ?? null,
        ':email' => $data['email'] ?? null,
        ':closingDay' => $data['closingDay'] ?? null,
        ':paymentType' => $data['paymentType'] ?? 'credit',
        ':carryOver' => $data['carryOver'] ?? 0,
        ':memo' => $data['memo'] ?? null,
        ':createdAt' => $now,
        ':updatedAt' => $now
    ]);
    
    return getCustomer($pdo, $id);
}

/**
 * 顧客を更新
 */
function updateCustomer(PDO $pdo, string $id, array $data): ?array {
    $existing = getCustomer($pdo, $id);
    if (!$existing) return null;
    
    $now = time() * 1000;
    
    $fields = [];
    $bindings = [':id' => $id, ':updatedAt' => $now];
    
    $allowedFields = [
        'name' => 'name',
        'nameKana' => 'name_kana',
        'address' => 'address',
        'phone' => 'phone',
        'email' => 'email',
        'closingDay' => 'closing_day',
        'paymentType' => 'payment_type',
        'carryOver' => 'carry_over',
        'memo' => 'memo'
    ];
    
    foreach ($allowedFields as $jsonKey => $dbColumn) {
        if (array_key_exists($jsonKey, $data)) {
            $fields[] = "$dbColumn = :$jsonKey";
            $bindings[":$jsonKey"] = $data[$jsonKey];
        }
    }
    
    if (empty($fields)) return $existing;
    
    $fields[] = "updated_at = :updatedAt";
    $sql = "UPDATE customers SET " . implode(', ', $fields) . " WHERE id = :id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindings);
    
    return getCustomer($pdo, $id);
}

/**
 * 顧客を削除
 */
function deleteCustomer(PDO $pdo, string $id): bool {
    $stmt = $pdo->prepare("DELETE FROM customers WHERE id = :id");
    $stmt->execute([':id' => $id]);
    return $stmt->rowCount() > 0;
}

/**
 * DBの行をJSON形式に変換
 */
function dbRowToCustomer(array $row): array {
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'nameKana' => $row['name_kana'],
        'address' => $row['address'],
        'phone' => $row['phone'],
        'email' => $row['email'],
        'closingDay' => $row['closing_day'] !== null ? intval($row['closing_day']) : null,
        'paymentType' => $row['payment_type'] ?? 'credit',
        'carryOver' => $row['carry_over'] !== null ? floatval($row['carry_over']) : null,
        'memo' => $row['memo'],
        'createdAt' => intval($row['created_at']),
        'updatedAt' => intval($row['updated_at'])
    ];
}

// --- リクエスト処理 ---
function handleCustomerRequest(PDO $pdo, string $method, ?string $id, array $params, $body): void {
    ensureCustomerTable($pdo);
    
    header('Content-Type: application/json');
    
    try {
        switch ($method) {
            case 'GET':
                if ($id) {
                    $customer = getCustomer($pdo, $id);
                    if (!$customer) {
                        http_response_code(404);
                        echo json_encode(['error' => 'Customer not found']);
                        return;
                    }
                    echo json_encode($customer);
                } else {
                    echo json_encode(getCustomers($pdo, $params));
                }
                break;
                
            case 'POST':
                if (empty($body['name'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Name is required']);
                    return;
                }
                echo json_encode(createCustomer($pdo, $body));
                break;
                
            case 'PUT':
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Customer ID is required']);
                    return;
                }
                $customer = updateCustomer($pdo, $id, $body);
                if (!$customer) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Customer not found']);
                    return;
                }
                echo json_encode($customer);
                break;
                
            case 'DELETE':
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Customer ID is required']);
                    return;
                }
                if (deleteCustomer($pdo, $id)) {
                    echo json_encode(['success' => true]);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Customer not found']);
                }
                break;
                
            default:
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
