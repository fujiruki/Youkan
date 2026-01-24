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
        open: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api/, ''); },
            },
        },
    },
    base: './', // GitHub Pages等でのデプロイを考慮し相対パス化
});
