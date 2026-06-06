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
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react-router'))
                            return 'vendor-router';
                        if (id.includes('react-dom') || id.includes('scheduler'))
                            return 'vendor-react';
                        if (id.includes('node_modules/react/'))
                            return 'vendor-react';
                        if (id.includes('framer-motion'))
                            return 'vendor-anim';
                        if (id.includes('@xyflow') || id.includes('d3-'))
                            return 'vendor-flow';
                        if (id.includes('i18next') || id.includes('react-i18next'))
                            return 'vendor-i18n';
                        if (id.includes('@dnd-kit'))
                            return 'vendor-dnd';
                        if (id.includes('dexie'))
                            return 'vendor-dexie';
                        if (id.includes('date-fns'))
                            return 'vendor-date';
                        if (id.includes('lucide-react'))
                            return 'vendor-icons';
                        return 'vendor-misc';
                    }
                    if (id.includes('src/features/plugins/tategu'))
                        return 'plugin-tategu';
                    if (id.includes('src/features/plugins/customer'))
                        return 'plugin-customer';
                    if (id.includes('src/features/plugins/manufacturing'))
                        return 'plugin-manufacturing';
                    if (id.includes('src/features/plugins/mock'))
                        return 'plugin-mock';
                    if (id.includes('src/features/core/calendar'))
                        return 'feat-calendar';
                    if (id.includes('src/features/core/planning'))
                        return 'feat-planning';
                    if (id.includes('src/features/admin'))
                        return 'feat-admin';
                },
            },
        },
    },
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
