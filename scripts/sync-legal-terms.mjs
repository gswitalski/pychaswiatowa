import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourcePath = resolve(__dirname, '../docs/regulamin.md');
const targetPath = resolve(__dirname, '../public/assets/legal/terms.md');

async function syncLegalTerms() {
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath);
}

try {
    await syncLegalTerms();
    console.log('[sync:legal] Zsynchronizowano docs/regulamin.md -> public/assets/legal/terms.md');
} catch (error) {
    console.error('[sync:legal] Nie udalo sie zsynchronizowac pliku regulaminu.', error);
    process.exitCode = 1;
}
