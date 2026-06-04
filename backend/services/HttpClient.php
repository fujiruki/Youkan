<?php
// backend/services/HttpClient.php
// R-034 Phase 2: 外部 HTTP 呼び出しの薄いラッパ。
// テストでは FakeHttpClient に差し替え可能なように request($method, $url, $options) インターフェースを採用。

class HttpClient {
    /**
     * @param string $method GET|POST|...
     * @param string $url    完全 URL
     * @param array  $options {
     *   headers?: string[]   "Key: Value" 形式の配列
     *   body?: string        application/x-www-form-urlencoded 形式の文字列
     *   timeout?: int        秒（デフォルト 15）
     * }
     * @return array { status:int, body:string, headers:array }
     */
    public function request(string $method, string $url, array $options = []): array {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
        curl_setopt($ch, CURLOPT_TIMEOUT, $options['timeout'] ?? 15);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);

        if (!empty($options['headers'])) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $options['headers']);
        }
        if (isset($options['body'])) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $options['body']);
        }

        $raw = curl_exec($ch);
        if ($raw === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new \RuntimeException("HttpClient: curl error: $err");
        }
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        $headerText = substr($raw, 0, $headerSize);
        $body = substr($raw, $headerSize);

        $headers = [];
        foreach (explode("\r\n", $headerText) as $line) {
            if (strpos($line, ':') !== false) {
                [$k, $v] = explode(':', $line, 2);
                $headers[trim($k)] = trim($v);
            }
        }

        return ['status' => $status, 'body' => $body, 'headers' => $headers];
    }

    /**
     * curl_multi による並列 HTTP リクエスト。
     *
     * @param array $requests key => ['method' => string, 'url' => string, 'options' => array] の連想配列。
     *                       option は request() と同じ。
     * @param int   $concurrency 同時実行上限（既定 5）。超えた分は次のバッチで処理する。
     * @return array key => ['status' => int, 'body' => string, 'headers' => array]
     *
     * R-041: 複数 Google カレンダーの events.list を並列取得するために導入。
     */
    public function requestMulti(array $requests, int $concurrency = 5): array {
        $results = [];
        if (empty($requests)) {
            return $results;
        }
        $concurrency = max(1, $concurrency);

        $keys = array_keys($requests);
        $cursor = 0;
        $total = count($keys);

        while ($cursor < $total) {
            $batchKeys = array_slice($keys, $cursor, $concurrency);
            $mh = curl_multi_init();
            $handles = [];

            foreach ($batchKeys as $key) {
                $req = $requests[$key];
                $method = strtoupper($req['method'] ?? 'GET');
                $url = $req['url'] ?? '';
                $options = $req['options'] ?? [];

                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_HEADER, true);
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
                curl_setopt($ch, CURLOPT_TIMEOUT, $options['timeout'] ?? 15);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);

                if (!empty($options['headers'])) {
                    curl_setopt($ch, CURLOPT_HTTPHEADER, $options['headers']);
                }
                if (isset($options['body'])) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, $options['body']);
                }

                curl_multi_add_handle($mh, $ch);
                $handles[$key] = $ch;
            }

            // 並列実行ループ
            $running = null;
            do {
                $status = curl_multi_exec($mh, $running);
                if ($running) {
                    curl_multi_select($mh);
                }
            } while ($running && $status === CURLM_OK);

            // 結果取り出し
            foreach ($handles as $key => $ch) {
                $raw = curl_multi_getcontent($ch);
                if ($raw === false || $raw === null) {
                    $err = curl_error($ch);
                    $results[$key] = ['status' => 0, 'body' => '', 'headers' => [], 'error' => $err];
                } else {
                    $httpStatus = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
                    $headerText = substr($raw, 0, $headerSize);
                    $body = substr($raw, $headerSize);
                    $headers = [];
                    foreach (explode("\r\n", $headerText) as $line) {
                        if (strpos($line, ':') !== false) {
                            [$k, $v] = explode(':', $line, 2);
                            $headers[trim($k)] = trim($v);
                        }
                    }
                    $results[$key] = ['status' => $httpStatus, 'body' => $body, 'headers' => $headers];
                }
                curl_multi_remove_handle($mh, $ch);
                curl_close($ch);
            }
            curl_multi_close($mh);

            $cursor += $concurrency;
        }

        return $results;
    }
}
