#!/usr/bin/env node
'use strict';

/**
 * Generuje `src/environments/environment.production.ts` (plik jest w .gitignore).
 *
 * Wartości pochodzą wyłącznie ze zmiennych środowiskowych SUPABASE_URL
 * i SUPABASE_ANON_KEY, a nie z interpolacji `${{ secrets.* }}` w skrypcie powłoki.
 * Dzięki temu znak cudzysłowu lub `$` w wartości nie wstrzyknie kodu do pliku TS.
 * W CI wartości to jawne atrapy (`https://ci.invalid`), w deployu - sekrety produkcyjne.
 *
 * Użycie: node .github/scripts/write-production-environment.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_PATH = path.join('src', 'environments', 'environment.production.ts');

function fail(message) {
    console.error(`::error::${message}`);
    process.exit(1);
}

function readRequired(name) {
    const value = (process.env[name] ?? '').trim();
    if (value.length === 0) {
        fail(`Zmienna środowiskowa ${name} jest pusta lub nie została przekazana.`);
    }
    if (/[\s'"`\\$]/.test(value)) {
        fail(`Zmienna środowiskowa ${name} zawiera niedozwolone znaki (białe znaki, cudzysłowy, $ lub \\).`);
    }
    return value;
}

function main() {
    const url = readRequired('SUPABASE_URL');
    const anonKey = readRequired('SUPABASE_ANON_KEY');

    if (!/^https:\/\/[A-Za-z0-9.-]+$/.test(url)) {
        fail('SUPABASE_URL musi mieć postać https://<host> (bez ścieżki i końcowego ukośnika).');
    }

    const content = [
        'export const environment = {',
        '    production: true,',
        '    supabase: {',
        `        url: ${JSON.stringify(url)},`,
        `        anonKey: ${JSON.stringify(anonKey)}`,
        '    }',
        '};',
        '',
    ].join('\n');

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, content, { encoding: 'utf8' });

    // Nie wypisujemy wartości, tylko fakt wygenerowania pliku.
    console.log(`Wygenerowano ${OUTPUT_PATH.split(path.sep).join('/')}.`);
}

main();
