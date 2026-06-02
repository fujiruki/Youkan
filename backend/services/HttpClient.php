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
}
