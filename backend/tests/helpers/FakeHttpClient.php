<?php
// backend/tests/helpers/FakeHttpClient.php
// R-034 Phase 2 テスト用 HTTP モック。
// 呼び出し履歴を蓄積し、enqueue() で積んだレスポンスを順に返す。

class FakeHttpClient {
    public array $calls = [];
    private array $queue = [];

    public function enqueue(int $status, array $jsonBody, array $headers = []): void {
        $this->queue[] = [
            'status' => $status,
            'body' => json_encode($jsonBody),
            'headers' => $headers,
        ];
    }

    public function request(string $method, string $url, array $options = []): array {
        $this->calls[] = ['method' => $method, 'url' => $url, 'options' => $options];
        if (empty($this->queue)) {
            throw new \RuntimeException("FakeHttpClient: no response queued for $method $url");
        }
        return array_shift($this->queue);
    }
}
