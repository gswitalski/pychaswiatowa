import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const legalAssetsToSync = [
    {
        sourcePath: resolve(__dirname, '../docs/regulamin.md'),
        targetPath: resolve(__dirname, '../public/assets/legal/terms.md'),
    },
    {
        sourcePath: resolve(__dirname, '../doc/pw.md'),
        targetPath: resolve(__dirname, '../public/assets/legal/privacy.md'),
    },
];

async function syncLegalTerms() {
    for (const legalAsset of legalAssetsToSync) {
        await mkdir(dirname(legalAsset.targetPath), { recursive: true });
        await cp(legalAsset.sourcePath, legalAsset.targetPath);
    }
}

try {
    await syncLegalTerms();
    console.log('[sync:legal] Zsynchronizowano dokumenty prawne do public/assets/legal.');
} catch (error) {
    console.error('[sync:legal] Nie udalo sie zsynchronizowac dokumentow prawnych.', error);
    process.exitCode = 1;
}
