<?php
// backend/DependencyController.php
require_once 'BaseController.php';

class DependencyController extends BaseController {

    public function handleRequest($method, $id = null) {
        $this->authenticate();

        if ($method === 'GET') {
            $this->index();
        } elseif ($method === 'POST') {
            $this->create();
        } elseif ($method === 'DELETE' && $id) {
            $this->delete($id);
        } else {
            $this->sendError(405, 'Method Not Allowed');
        }
    }

    private function index() {
        $itemId = $_GET['item_id'] ?? null;
        $deps = $this->getDependenciesDirect($itemId);
        $this->sendJSON(['dependencies' => $deps]);
    }

    private function create() {
        $data = $this->getInput();
        $sourceItemId = $data['source_item_id'] ?? null;
        $targetItemId = $data['target_item_id'] ?? null;

        if (!$sourceItemId || !$targetItemId) {
            $this->sendError(400, 'source_item_id and target_item_id are required');
        }

        if ($this->hasCycle($sourceItemId, $targetItemId)) {
            $this->sendError(400, 'Circular dependency detected');
        }

        $result = $this->createDependencyDirect($sourceItemId, $targetItemId);
        if ($result === null) {
            $this->sendError(409, 'Dependency already exists');
        }

        $this->sendJSON(['dependency' => $result]);
    }

    private function delete($id) {
        $result = $this->deleteDependencyDirect($id);
        if (!$result) {
            $this->sendError(404, 'Dependency not found or access denied');
        }
        $this->sendJSON(['success' => true]);
    }

    /**
     * 循環参照チェック（深さ優先探索）
     * source → target の依存を追加した場合に循環が生じるか判定
     */
    protected function hasCycle($sourceItemId, $targetItemId) {
        // 自己参照
        if ($sourceItemId === $targetItemId) {
            return true;
        }

        // target から到達可能なノードに source が含まれるか（DFS）
        $visited = [];
        $stack = [$targetItemId];

        while (!empty($stack)) {
            $current = array_pop($stack);
            if ($current === $sourceItemId) {
                return true;
            }
            if (isset($visited[$current])) {
                continue;
            }
            $visited[$current] = true;

            // current を source とする既存の依存関係を取得
            $stmt = $this->pdo->prepare(
                "SELECT target_item_id FROM item_dependencies WHERE source_item_id = ?"
            );
            $stmt->execute([$current]);
            $targets = $stmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($targets as $t) {
                if (!isset($visited[$t])) {
                    $stack[] = $t;
                }
            }
        }

        return false;
    }

    /**
     * 依存関係を直接作成（テスト用にprotected）
     */
    protected function createDependencyDirect($sourceItemId, $targetItemId) {
        $id = 'dep_' . uniqid() . '_' . bin2hex(random_bytes(4));
        $now = time();

        try {
            $stmt = $this->pdo->prepare(
                "INSERT INTO item_dependencies (id, tenant_id, source_item_id, target_item_id, created_at) VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([$id, $this->currentTenantId, $sourceItemId, $targetItemId, $now]);
        } catch (PDOException $e) {
            // UNIQUE制約違反 = 重複
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                return null;
            }
            throw $e;
        }

        return [
            'id' => $id,
            'sourceItemId' => $sourceItemId,
            'targetItemId' => $targetItemId,
            'createdAt' => $now,
        ];
    }

    /**
     * 依存関係を取得（テスト用にprotected）
     */
    protected function getDependenciesDirect($itemId = null) {
        $tenantIds = $this->joinedTenants;

        if ($itemId) {
            if (!empty($tenantIds)) {
                $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
                $sql = "SELECT * FROM item_dependencies WHERE (source_item_id = ? OR target_item_id = ?) AND tenant_id IN ($placeholders) ORDER BY created_at ASC";
                $params = array_merge([$itemId, $itemId], $tenantIds);
            } else {
                $sql = "SELECT * FROM item_dependencies WHERE (source_item_id = ? OR target_item_id = ?) AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '') ORDER BY created_at ASC";
                $params = [$itemId, $itemId, $this->currentTenantId];
            }
        } else {
            if (!empty($tenantIds)) {
                $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
                $sql = "SELECT * FROM item_dependencies WHERE tenant_id IN ($placeholders) ORDER BY created_at ASC";
                $params = $tenantIds;
            } else {
                $sql = "SELECT * FROM item_dependencies WHERE (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '') ORDER BY created_at ASC";
                $params = [$this->currentTenantId];
            }
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            return [
                'id' => $row['id'],
                'sourceItemId' => $row['source_item_id'],
                'targetItemId' => $row['target_item_id'],
                'createdAt' => (int)$row['created_at'],
            ];
        }, $rows);
    }

    /**
     * 依存関係を削除（テスト用にprotected）
     */
    protected function deleteDependencyDirect($id) {
        $tenantIds = $this->joinedTenants;

        if (!empty($tenantIds)) {
            $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
            $sql = "DELETE FROM item_dependencies WHERE id = ? AND tenant_id IN ($placeholders)";
            $params = array_merge([$id], $tenantIds);
        } else {
            $sql = "DELETE FROM item_dependencies WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')";
            $params = [$id, $this->currentTenantId];
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount() > 0;
    }
}
