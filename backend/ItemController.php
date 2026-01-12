<?php
// backend/ItemController.php

class ItemController {
    
    public static function getAll($db) {
        $stmt = $db->query("SELECT * FROM items");
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // SQLite stores booleans as 0/1, convert back if needed
        foreach ($items as &$item) {
            $item['interrupt'] = (bool)$item['interrupt'];
        }
        return $items;
    }

    public static function create($db, $data) {
        $sql = "INSERT INTO items (id, title, status, created_at, updated_at, status_updated_at) VALUES (:id, :title, :status, :now, :now, :now)";
        $stmt = $db->prepare($sql);
        
        $id = $data['id'] ?? uniqid('item_', true); // Basic ID gen if not provided
        $now = time();
        
        $stmt->execute([
            ':id' => $id,
            ':title' => $data['title'],
            ':status' => $data['status'] ?? 'inbox',
            ':now' => $now
        ]);
        
        return ['id' => $id, 'success' => true];
    }

    public static function update($db, $id, $data) {
        $fields = [];
        $params = [':id' => $id];
        
        if (isset($data['title'])) {
            $fields[] = "title = :title";
            $params[':title'] = $data['title'];
        }
        if (isset($data['status'])) {
            $fields[] = "status = :status";
            $params[':status'] = $data['status'];
            $fields[] = "status_updated_at = :now";
            $params[':now'] = time();
        }
        if (isset($data['memo'])) {
            $fields[] = "memo = :memo";
            $params[':memo'] = $data['memo'];
        }
        if (array_key_exists('due_date', $data)) {
            $fields[] = "due_date = :due_date";
            $params[':due_date'] = $data['due_date'];
        }
        if (array_key_exists('due_status', $data)) {
            $fields[] = "due_status = :due_status";
            $params[':due_status'] = $data['due_status'];
        }
        
        $fields[] = "updated_at = " . time();
        
        if (empty($fields)) return ['success' => true, 'changed' => false];
        
        $sql = "UPDATE items SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        return ['success' => true];
    }

    public static function delete($db, $id) {
        $stmt = $db->prepare("DELETE FROM items WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return ['success' => true];
    }
}
