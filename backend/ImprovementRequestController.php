<?php
// backend/ImprovementRequestController.php
// R-071: 改善要望送信フォーム（画像添付付き）
//
// DBテーブルは追加せず、送信内容をサーバーローカルの backend/data/requests_sub.md に
// 直接追記する。画像は backend/data/requests_sub_uploads/{uuid}.{ext} に保存する。
// backend/data/ はデプロイ除外・Git管理外(.gitignore)の環境固有データ。
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/Uuidv7.php';

class ImprovementRequestController extends BaseController {
    private const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

    // MIME type => 許可する拡張子の対応表(拡張子・content-typeの両方を検証する)
    private const ALLOWED_MIME_EXTENSIONS = [
        'image/png' => ['png'],
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/webp' => ['webp'],
    ];

    public function create() {
        $this->authenticate();

        $content = trim($_POST['content'] ?? '');
        if ($content === '') {
            $this->sendError(400, '本文を入力してください');
            return;
        }

        $imageRelativePath = null;
        if (isset($_FILES['image']) && $_FILES['image']['error'] !== UPLOAD_ERR_NO_FILE) {
            $imageRelativePath = $this->handleImageUpload($_FILES['image']);
        }

        $this->appendRequestEntry($content, $imageRelativePath);

        $this->sendJSON(['success' => true]);
    }

    /**
     * アップロード画像を検証し、backend/data/requests_sub_uploads/ へ保存する。
     * 検証に失敗した場合は sendError() で処理を終了する(exitする)。
     *
     * @return string 保存先への相対パス（requests_sub.md からの参照用）
     */
    private function handleImageUpload(array $file): string {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $this->sendError(400, '画像のアップロードに失敗しました（サイズ上限を超えている可能性があります）');
        }

        if ($file['size'] > self::MAX_IMAGE_SIZE) {
            $this->sendError(400, '画像サイズは5MBまでです');
        }

        $mimeType = $file['type'] ?? '';
        $ext = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));

        if (!isset(self::ALLOWED_MIME_EXTENSIONS[$mimeType]) || !in_array($ext, self::ALLOWED_MIME_EXTENSIONS[$mimeType], true)) {
            $this->sendError(400, '対応していない画像形式です（png / jpeg / webpのみ）');
        }

        $uploadsDir = $this->getUploadsDir();
        if (!is_dir($uploadsDir)) {
            mkdir($uploadsDir, 0777, true);
        }

        $filename = Uuidv7::generate() . '.' . $ext;
        $destPath = $uploadsDir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            $this->sendError(500, '画像の保存に失敗しました');
        }

        return 'requests_sub_uploads/' . $filename;
    }

    private function appendRequestEntry(string $content, ?string $imageRelativePath): void {
        $dataDir = $this->getDataDir();
        if (!is_dir($dataDir)) {
            mkdir($dataDir, 0777, true);
        }

        $email = $this->currentUser['email'] ?? 'unknown';
        $timestamp = date('Y-m-d H:i');

        $entry = "## {$timestamp} (user: {$email})\n\n{$content}\n";
        if ($imageRelativePath !== null) {
            $entry .= "\n![screenshot]({$imageRelativePath})\n";
        }
        $entry .= "\n---\n\n";

        file_put_contents($this->getMarkdownPath(), $entry, FILE_APPEND | LOCK_EX);
    }

    private function getDataDir(): string {
        return __DIR__ . '/data';
    }

    private function getUploadsDir(): string {
        return $this->getDataDir() . '/requests_sub_uploads';
    }

    private function getMarkdownPath(): string {
        return $this->getDataDir() . '/requests_sub.md';
    }
}
