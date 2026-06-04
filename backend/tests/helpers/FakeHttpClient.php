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

    /**
     * curl_multi の挙動を模倣。
     * $requests: [ key => ['method' => ..., 'url' => ..., 'options' => [...]] ]
     * 戻り値: [ key => ['status' => int, 'body' => string, 'headers' => array] ]
     * 並列度 $concurrency は呼び出し履歴に影響しない（テストでは無視）。
     */
    public function requestMulti(array $requests, int $concurrency = 5): array {
        $results = [];
        foreach ($requests as $key => $req) {
            $method = $req['method'] ?? 'GET';
            $url = $req['url'] ?? '';
            $options = $req['options'] ?? [];
            $results[$key] = $this->request($method, $url, $options);
        }
        return $results;
    }
}
