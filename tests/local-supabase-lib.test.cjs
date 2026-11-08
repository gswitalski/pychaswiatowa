'use strict';
// Testy parsera listy migracji i odczytu config.toml (bez uruchamiania Supabase).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseMigrationList, readLocalConfig, isLoopbackHost } = require('../.cursor/scripts/lib/local-supabase.cjs');

const pendingOf = (entries) => entries.filter((e) => e.local && !e.remote).map((e) => e.local);

// Format tabeli Markdown
const table = [
    '',
    '   Local            | Remote           | Time (UTC)            ',
    '  ------------------|------------------|-----------------------',
    '   `20251125120000` | `20251125120000` | `2025-11-25 12:00:00` ',
    '   `20261108120000` |                  | `2026-11-08 12:00:00` ',
    '                    | `20250101000000` | `2025-01-01 00:00:00` ',
].join('\n');
const fromTable = parseMigrationList(table);
assert.equal(fromTable.length, 3);
assert.deepEqual(pendingOf(fromTable), ['20261108120000']);

// Format JSON
const json = JSON.stringify({
    migrations: [
        { local: '20251125120000', remote: '20251125120000', time: 'x' },
        { local: '20261108120000', remote: '', time: 'y' },
    ],
    message: 'Migrations listed',
});
assert.deepEqual(pendingOf(parseMigrationList('noise\n' + json + '\nmore')), ['20261108120000']);

// Nieznany format => null (błąd, a nie "brak oczekujących")
assert.equal(parseMigrationList('Cannot connect to the Docker daemon'), null);

// config.toml
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-toml-'));
try {
    fs.mkdirSync(path.join(dir, 'supabase'));
    fs.writeFileSync(
        path.join(dir, 'supabase/config.toml'),
        'project_id = "demo"\n[api]\nenabled = true\nport = 54331 # api\n[db]\nport = 54332\nshadow_port = 54320\n[studio]\nport = 54333\n'
    );
    assert.deepEqual(readLocalConfig(dir), { projectId: 'demo', apiPort: 54331, dbPort: 54332 });
    fs.writeFileSync(path.join(dir, 'supabase/config.toml'), '[api]\nport = 1\n');
    assert.ok(readLocalConfig(dir).error);
} finally {
    fs.rmSync(dir, { recursive: true, force: true });
}

assert.ok(isLoopbackHost('127.0.0.1') && isLoopbackHost('localhost'));
assert.ok(!isLoopbackHost('db.example.supabase.co') && !isLoopbackHost('10.0.0.5'));
console.log('PASS: local-supabase lib - parser migracji, config.toml, loopback');
