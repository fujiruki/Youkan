/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true, // Enable describe, it, expect globals
        environment: 'jsdom',
        setupFiles: [], // Add setup file if needed
        pool: 'forks', // [FIX] Use forks for better stability on Windows
    },
});
