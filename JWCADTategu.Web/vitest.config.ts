/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			globals: true, // Enable describe, it, expect globals
			environment: 'jsdom',
			setupFiles: ['./src/setupTests.ts'], // Add setup file
			pool: 'forks', // [FIX] Use forks for better stability on Windows
		},
	})
);
