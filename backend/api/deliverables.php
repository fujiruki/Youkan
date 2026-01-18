<?php
/**
 * Manufacturing Plugin - Deliverables API Handler
 * 
 * 成果物（Deliverable）のCRUD API
 */

require_once __DIR__ . '/../db.php';

/**
 * 成果物テーブルを作成（存在しない場合）
 */
function ensureDeliverableTable(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS deliverables (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            linked_item_id TEXT,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'product',
            estimated_work_minutes INTEGER DEFAULT 0,
            estimated_site_minutes INTEGER DEFAULT 0,
            actual_work_minutes INTEGER,
            actual_site_minutes INTEGER,
            material_cost REAL,
            labor_cost REAL,
            outsource_cost REAL,
            status TEXT DEFAULT 'pending',
            requires_site_installation INTEGER DEFAULT 1,
            plugin_id TEXT,
            plugin_data TEXT,
            memo TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    ");
    
    // インデックス作成
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_deliverables_project ON deliverables(project_id)");
}

/**
 * プロジェクトの成果物一覧を取得
 */
function getDeliverables(PDO $pdo, string $projectId): array {
    $stmt = $pdo->prepare("SELECT * FROM deliverables WHERE project_id = :projectId ORDER BY created_at");
    $stmt->execute([':projectId' => $projectId]);
    return array_map('dbRowToDeliverable', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

/**
 * 成果物を取得
 */
function getDeliverable(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare("SELECT * FROM deliverables WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? dbRowToDeliverable($row) : null;
}

/**
 * 成果物を作成
 */
function createDeliverable(PDO $pdo, array $data): array {
    $id = 'dlv_' . bin2hex(random_bytes(8));
    $now = time() * 1000;
    
    $stmt = $pdo->prepare("
        INSERT INTO deliverables (
            id, project_id, linked_item_id, name, type,
            estimated_work_minutes, estimated_site_minutes,
            actual_work_minutes, actual_site_minutes,
            material_cost, labor_cost, outsource_cost,
            status, requires_site_installation, plugin_id, plugin_data, memo,
            created_at, updated_at
        ) VALUES (
            :id, :projectId, :linkedItemId, :name, :type,
            :estimatedWorkMinutes, :estimatedSiteMinutes,
            :actualWorkMinutes, :actualSiteMinutes,
            :materialCost, :laborCost, :outsourceCost,
            :status, :requiresSiteInstallation, :pluginId, :pluginData, :memo,
            :createdAt, :updatedAt
        )
    ");
    
    $stmt->execute([
        ':id' => $id,
        ':projectId' => $data['projectId'],
        ':linkedItemId' => $data['linkedItemId'] ?? null,
        ':name' => $data['name'],
        ':type' => $data['type'] ?? 'product',
        ':estimatedWorkMinutes' => $data['estimatedWorkMinutes'] ?? 0,
        ':estimatedSiteMinutes' => $data['estimatedSiteMinutes'] ?? 0,
        ':actualWorkMinutes' => $data['actualWorkMinutes'] ?? null,
        ':actualSiteMinutes' => $data['actualSiteMinutes'] ?? null,
        ':materialCost' => $data['materialCost'] ?? null,
        ':laborCost' => $data['laborCost'] ?? null,
        ':outsourceCost' => $data['outsourceCost'] ?? null,
        ':status' => $data['status'] ?? 'pending',
        ':requiresSiteInstallation' => ($data['requiresSiteInstallation'] ?? true) ? 1 : 0,
        ':pluginId' => $data['pluginId'] ?? null,
        ':pluginData' => isset($data['pluginData']) ? json_encode($data['pluginData']) : null,
        ':memo' => $data['memo'] ?? null,
        ':createdAt' => $now,
        ':updatedAt' => $now
    ]);
    
    return getDeliverable($pdo, $id);
}

/**
 * 成果物を更新
 */
function updateDeliverable(PDO $pdo, string $id, array $data): ?array {
    $existing = getDeliverable($pdo, $id);
    if (!$existing) return null;
    
    $now = time() * 1000;
    
    $fields = [];
    $bindings = [':id' => $id, ':updatedAt' => $now];
    
    $allowedFields = [
        'name' => 'name',
        'type' => 'type',
        'linkedItemId' => 'linked_item_id',
        'estimatedWorkMinutes' => 'estimated_work_minutes',
        'estimatedSiteMinutes' => 'estimated_site_minutes',
        'actualWorkMinutes' => 'actual_work_minutes',
        'actualSiteMinutes' => 'actual_site_minutes',
        'materialCost' => 'material_cost',
        'laborCost' => 'labor_cost',
        'outsourceCost' => 'outsource_cost',
        'status' => 'status',
        'memo' => 'memo'
    ];
    
    foreach ($allowedFields as $jsonKey => $dbColumn) {
        if (array_key_exists($jsonKey, $data)) {
            $fields[] = "$dbColumn = :$jsonKey";
            $bindings[":$jsonKey"] = $data[$jsonKey];
        }
    }
    
    // Boolean field
    if (array_key_exists('requiresSiteInstallation', $data)) {
        $fields[] = "requires_site_installation = :requiresSiteInstallation";
        $bindings[':requiresSiteInstallation'] = $data['requiresSiteInstallation'] ? 1 : 0;
    }
    
    // JSON field
    if (array_key_exists('pluginData', $data)) {
        $fields[] = "plugin_data = :pluginData";
        $bindings[':pluginData'] = json_encode($data['pluginData']);
    }
    
    if (empty($fields)) return $existing;
    
    $fields[] = "updated_at = :updatedAt";
    $sql = "UPDATE deliverables SET " . implode(', ', $fields) . " WHERE id = :id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindings);
    
    return getDeliverable($pdo, $id);
}

/**
 * 成果物を削除
 */
function deleteDeliverable(PDO $pdo, string $id): bool {
    $stmt = $pdo->prepare("DELETE FROM deliverables WHERE id = :id");
    $stmt->execute([':id' => $id]);
    return $stmt->rowCount() > 0;
}

/**
 * プロジェクトの集計情報を取得
 */
function getProjectSummary(PDO $pdo, string $projectId): array {
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as deliverable_count,
            COALESCE(SUM(estimated_work_minutes), 0) as total_estimated_work_minutes,
            COALESCE(SUM(estimated_site_minutes), 0) as total_estimated_site_minutes,
            COALESCE(SUM(actual_work_minutes), 0) as total_actual_work_minutes,
            COALESCE(SUM(actual_site_minutes), 0) as total_actual_site_minutes,
            COALESCE(SUM(material_cost), 0) as total_material_cost,
            COALESCE(SUM(labor_cost), 0) as total_labor_cost,
            COALESCE(SUM(outsource_cost), 0) as total_outsource_cost,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
        FROM deliverables 
        WHERE project_id = :projectId
    ");
    $stmt->execute([':projectId' => $projectId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    return [
        'projectId' => $projectId,
        'deliverableCount' => intval($row['deliverable_count']),
        'totalEstimatedWorkMinutes' => intval($row['total_estimated_work_minutes']),
        'totalEstimatedSiteMinutes' => intval($row['total_estimated_site_minutes']),
        'totalActualWorkMinutes' => intval($row['total_actual_work_minutes']),
        'totalActualSiteMinutes' => intval($row['total_actual_site_minutes']),
        'totalMaterialCost' => floatval($row['total_material_cost']),
        'totalLaborCost' => floatval($row['total_labor_cost']),
        'totalOutsourceCost' => floatval($row['total_outsource_cost']),
        'completedCount' => intval($row['completed_count']),
        'inProgressCount' => intval($row['in_progress_count']),
        'pendingCount' => intval($row['pending_count'])
    ];
}

/**
 * DBの行をJSON形式に変換
 */
function dbRowToDeliverable(array $row): array {
    return [
        'id' => $row['id'],
        'projectId' => $row['project_id'],
        'linkedItemId' => $row['linked_item_id'],
        'name' => $row['name'],
        'type' => $row['type'],
        'estimatedWorkMinutes' => intval($row['estimated_work_minutes']),
        'estimatedSiteMinutes' => intval($row['estimated_site_minutes']),
        'actualWorkMinutes' => $row['actual_work_minutes'] !== null ? intval($row['actual_work_minutes']) : null,
        'actualSiteMinutes' => $row['actual_site_minutes'] !== null ? intval($row['actual_site_minutes']) : null,
        'materialCost' => $row['material_cost'] !== null ? floatval($row['material_cost']) : null,
        'laborCost' => $row['labor_cost'] !== null ? floatval($row['labor_cost']) : null,
        'outsourceCost' => $row['outsource_cost'] !== null ? floatval($row['outsource_cost']) : null,
        'status' => $row['status'],
        'requiresSiteInstallation' => (bool)$row['requires_site_installation'],
        'pluginId' => $row['plugin_id'],
        'pluginData' => $row['plugin_data'] ? json_decode($row['plugin_data'], true) : null,
        'memo' => $row['memo'],
        'createdAt' => intval($row['created_at']),
        'updatedAt' => intval($row['updated_at'])
    ];
}

// --- リクエスト処理 ---
function handleDeliverableRequest(PDO $pdo, string $method, ?string $id, array $params, $body): void {
    ensureDeliverableTable($pdo);
    
    header('Content-Type: application/json');
    
    try {
        // Summary endpoint
        if ($id === 'summary' && !empty($params['projectId'])) {
            echo json_encode(getProjectSummary($pdo, $params['projectId']));
            return;
        }
        
        switch ($method) {
            case 'GET':
                if ($id && $id !== 'summary') {
                    $deliverable = getDeliverable($pdo, $id);
                    if (!$deliverable) {
                        http_response_code(404);
                        echo json_encode(['error' => 'Deliverable not found']);
                        return;
                    }
                    echo json_encode($deliverable);
                } else {
                    if (empty($params['projectId'])) {
                        http_response_code(400);
                        echo json_encode(['error' => 'projectId is required']);
                        return;
                    }
                    echo json_encode(getDeliverables($pdo, $params['projectId']));
                }
                break;
                
            case 'POST':
                if (empty($body['projectId']) || empty($body['name'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'projectId and name are required']);
                    return;
                }
                echo json_encode(createDeliverable($pdo, $body));
                break;
                
            case 'PUT':
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Deliverable ID is required']);
                    return;
                }
                $deliverable = updateDeliverable($pdo, $id, $body);
                if (!$deliverable) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Deliverable not found']);
                    return;
                }
                echo json_encode($deliverable);
                break;
                
            case 'DELETE':
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Deliverable ID is required']);
                    return;
                }
                if (deleteDeliverable($pdo, $id)) {
                    echo json_encode(['success' => true]);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Deliverable not found']);
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
