/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
// @ts-ignore
// @ts-ignore
export default defineConfig({
    define: {
        __BUILD_TIMESTAMP__: JSON.stringify(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })),
    },
    resolve: {
        alias: {
            // @ts-ignore
            '@': resolve(__dirname, 'src'),
        },
    },
    plugins: [react()],
    // test: { ... } removed to fix build type error. Use vitest.config.ts if needed.
    server: {
        port: 5173,
        open: false,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api/, ''); },
            },
        },
    },
    base: '/contents/Youkan/', // 本番環境の絶対パス
});
