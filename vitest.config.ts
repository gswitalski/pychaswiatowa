/// <reference types="vitest" />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
    plugins: [angular()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['test-setup.ts'],
        environmentMatchGlobs: [['**/*.spec.ts', 'jsdom']],
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['node_modules', 'dist', '.angular', 'e2e'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.spec.ts',
                'src/**/*.test.ts',
                'src/main.ts',
                'src/environments/**',
                'src/**/*.module.ts',
                'src/**/*.config.ts',
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 70,
                statements: 70,
            },
        },
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        reporters: ['default'],
    },
    resolve: {
        alias: {
            '@': '/src',
            '@shared': '/shared',
        },
    },
});

