<?php
// backend/SideMemoController.php

class SideMemoController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getAll() {
        // No sort, just chronological order of creation? Or insertion order?
        // Spec says: "No sort". Default DB order is fine or created_at DESC.
        return $this->pdo->query("SELECT * FROM side_memos ORDER BY created_at ASC")->fetchAll(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        $content = $data['content'] ?? '';
        if (empty($content)) {
            throw new Exception("Content is required");
        }

        $id = uniqid('memo_', true);
        $stmt = $this->pdo->prepare("INSERT INTO side_memos (id, content, created_at) VALUES (?, ?, ?)");
        $stmt->execute([$id, $content, time()]);

        return ['id' => $id, 'content' => $content];
    }

    public function delete($id) {
        $stmt = $this->pdo->prepare("DELETE FROM side_memos WHERE id = ?");
        $stmt->execute([$id]);
        return ['success' => true, 'id' => $id];
    }
    
    // Move to Inbox logic could be just Client: Copy text -> Create Item -> Delete Memo.
    // Or Server API:
    public function moveToInbox($id) {
        $this->pdo->beginTransaction();
        try {
            // 1. Get Memo Content
            $stmt = $this->pdo->prepare("SELECT content FROM side_memos WHERE id = ?");
            $stmt->execute([$id]);
            $memo = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$memo) {
                throw new Exception("Memo not found");
            }

            // 2. Create Inbox Item
            $itemId = uniqid('item_', true);
            $now = time();
            $stmt = $this->pdo->prepare("INSERT INTO items (id, title, status, created_at, updated_at) VALUES (?, ?, 'inbox', ?, ?)");
            $stmt->execute([$itemId, $memo['content'], $now, $now]);

            // 3. Delete Memo
            $this->delete($id);

            $this->pdo->commit();
            return ['success' => true, 'new_item_id' => $itemId];
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
