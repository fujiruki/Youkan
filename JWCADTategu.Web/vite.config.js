/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
    },
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
