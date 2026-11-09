#!/usr/bin/env node
'use strict';

/**
 * Walidacja struktury migracji Supabase (bez połączenia z jakąkolwiek bazą).
 *
 * Supabase CLI po cichu pomija pliki, które nie pasują do wzorca nazwy
 * `<14 cyfr>_<nazwa>.sql`, więc źle nazwana migracja nie zostałaby wdrożona.
 * Skrypt zamienia takie przypadki w twardy błąd CI.
 *
 * Użycie: node .github/scripts/validate-migrations.cjs [katalog]
 */

const fs = require('node:fs');
const path = require('node:path');

const MIGRATION_NAME_PATTERN = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/;
const IGNORED_ENTRIES = new Set(['.gitkeep']);
const FUTURE_WARNING_DAYS = 1;

function isValidTimestamp(version) {
    const year = Number(version.slice(0, 4));
    const month = Number(version.slice(4, 6));
    const day = Number(version.slice(6, 8));
    const hour = Number(version.slice(8, 10));
    const minute = Number(version.slice(10, 12));
    const second = Number(version.slice(12, 14));

    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day &&
        date.getUTCHours() === hour &&
        date.getUTCMinutes() === minute &&
        date.getUTCSeconds() === second
    );
}

function toDate(version) {
    return new Date(
        Date.UTC(
            Number(version.slice(0, 4)),
            Number(version.slice(4, 6)) - 1,
            Number(version.slice(6, 8)),
            Number(version.slice(8, 10)),
            Number(version.slice(10, 12)),
            Number(version.slice(12, 14)),
        ),
    );
}

function annotate(level, file, message) {
    console.log(`::${level} file=${file}::${message}`);
}

function validateMigrations(migrationsDir) {
    const errors = [];
    const warnings = [];

    if (!fs.existsSync(migrationsDir) || !fs.statSync(migrationsDir).isDirectory()) {
        errors.push({ file: migrationsDir, message: 'Katalog migracji nie istnieje.' });
        return { errors, warnings, count: 0 };
    }

    const entries = fs
        .readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => !IGNORED_ENTRIES.has(entry.name));

    const versions = new Map();
    const now = Date.now();
    let count = 0;

    for (const entry of entries) {
        const relativePath = path.posix.join(
            migrationsDir.split(path.sep).join('/'),
            entry.name,
        );

        if (!entry.isFile()) {
            errors.push({ file: relativePath, message: 'Oczekiwano pliku .sql, a nie katalogu.' });
            continue;
        }

        const match = MIGRATION_NAME_PATTERN.exec(entry.name);
        if (!match) {
            errors.push({
                file: relativePath,
                message:
                    'Nazwa nie pasuje do wzorca <YYYYMMDDHHMMSS>_<nazwa_snake_case>.sql. ' +
                    'Supabase CLI pominąłby ten plik.',
            });
            continue;
        }

        count += 1;
        const version = match[1];

        if (!isValidTimestamp(version)) {
            errors.push({
                file: relativePath,
                message: `Prefiks ${version} nie jest poprawną datą UTC (YYYYMMDDHHMMSS).`,
            });
        }

        if (versions.has(version)) {
            errors.push({
                file: relativePath,
                message: `Zduplikowany numer wersji ${version} (także: ${versions.get(version)}).`,
            });
        } else {
            versions.set(version, entry.name);
        }

        const content = fs.readFileSync(path.join(migrationsDir, entry.name), 'utf8');
        if (content.trim().length === 0) {
            errors.push({ file: relativePath, message: 'Plik migracji jest pusty.' });
        }

        if (isValidTimestamp(version)) {
            const ageDays = (toDate(version).getTime() - now) / 86_400_000;
            if (ageDays > FUTURE_WARNING_DAYS) {
                warnings.push({
                    file: relativePath,
                    message:
                        `Znacznik czasu ${version} jest w przyszłości. Późniejsze migracje ` +
                        'z wcześniejszym znacznikiem nie zostaną zastosowane w poprawnej kolejności.',
                });
            }
        }
    }

    if (count === 0) {
        errors.push({ file: migrationsDir, message: 'Nie znaleziono żadnej migracji .sql.' });
    }

    return { errors, warnings, count };
}

function main() {
    const migrationsDir = process.argv[2] ?? 'supabase/migrations';
    const { errors, warnings, count } = validateMigrations(migrationsDir);

    for (const warning of warnings) {
        annotate('warning', warning.file, warning.message);
    }

    for (const error of errors) {
        annotate('error', error.file, error.message);
    }

    if (errors.length > 0) {
        console.error(`Walidacja migracji: ${errors.length} błąd(ów), ${count} poprawnych nazw.`);
        process.exit(1);
    }

    console.log(`Walidacja migracji: OK (${count} migracji, ${warnings.length} ostrzeżeń).`);
}

if (require.main === module) {
    main();
}

module.exports = { validateMigrations, isValidTimestamp };
