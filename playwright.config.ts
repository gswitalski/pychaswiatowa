import { defineConfig, devices } from '@playwright/test';

/**
 * Konfiguracja Playwright dla testów E2E aplikacji PychaŚwiatowa
 * Zgodnie z wytycznymi - tylko Chromium/Desktop Chrome
 */
export default defineConfig({
    // Katalog z testami E2E
    testDir: './e2e',

    // Maksymalny czas wykonania pojedynczego testu
    timeout: 30 * 1000,

    // Liczba prób w przypadku niepowodzenia
    retries: process.env.CI ? 2 : 0,

    // Liczba równoległych workerów
    workers: process.env.CI ? 1 : undefined,

    // Reporter - format raportów z testów
    reporter: [
        ['html'],
        ['list'],
        ['json', { outputFile: 'test-results/results.json' }],
    ],

    // Wspólne ustawienia dla wszystkich projektów
    use: {
        // URL bazowy aplikacji
        baseURL: 'http://localhost:4200',

        // Zbieranie trace tylko w przypadku niepowodzenia
        trace: 'on-first-retry',

        // Screenshots tylko przy niepowodzeniu
        screenshot: 'only-on-failure',

        // Nagrywanie wideo tylko przy niepowodzeniu
        video: 'retain-on-failure',
    },

    // Projekty testowe - tylko Chromium zgodnie z wytycznymi
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Serwer deweloperski
    webServer: {
        command: 'npm start',
        url: 'http://localhost:4200',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});

