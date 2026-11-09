'use strict';
// Testy regresyjne P1: uruchamianie `npm`, `npx` i `node` przez quality.cjs oraz lib/exec.cjs
// (na Windows `"npm"` w cudzysłowach dawał: '"npm"' is not recognized).
const assert = require('node:assert/strict');
const path = require('node:path');
const { createTempRepo } = require('./_helpers.cjs');
const { runExternal, resolveCommand } = require('../.cursor/scripts/lib/exec.cjs');

// 1) Bezpośrednio: runExternal
{
    const npm = runExternal('npm', ['--version']);
    assert.equal(npm.status, 0, 'npm --version: ' + (npm.error?.message || npm.stderr));
    assert.match(npm.stdout.trim(), /^\d+\.\d+\.\d+/);

    const npx = runExternal('npx', ['--version']);
    assert.equal(npx.status, 0, 'npx --version: ' + (npx.error?.message || npx.stderr));
    assert.match(npx.stdout.trim(), /^\d+\.\d+\.\d+/);

    const tricky = ['argument ze spacją', 'z"cudzysłowem', "z'apostrofem", 'a&b'];
    const echo = runExternal('node', ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', ...tricky]);
    assert.equal(echo.status, 0, echo.stderr);
    assert.deepEqual(JSON.parse(echo.stdout), tricky, 'argumenty muszą dotrzeć bez zmian');

    const missing = runExternal('definitely-not-a-command-xyz', []);
    assert.ok(missing.error, 'nieistniejące polecenie ma zwrócić error, a nie rzucić wyjątek');
    assert.notEqual(missing.status, 0);

    const spec = resolveCommand('npm', ['run', 'build']);
    assert.ok(spec.file.length > 0);
    assert.ok(!/^"/.test(spec.file) && !spec.args.some((a) => /^"\\?"npm/.test(a)), 'brak podwójnego cytowania');
}

// 2) Przez quality.cjs w tymczasowym repo
const repo = createTempRepo();
try {
    const id = 'LOCAL-exec';
    assert.equal(repo.node(['.cursor/scripts/workflow.cjs', 'init', id, 'story']).status, 0);
    const quality = (...args) => repo.node(['.cursor/scripts/quality.cjs', ...args], { env: { QUALITY_TEST_SECRET_TOKEN: 'supersecretvalue123' } });
    const gateOf = (name) => repo.manifest(id).qualityGates[name];
    const logOf = (name) => repo.read(gateOf(name).log);

    // npm / npx / node z argumentami
    repo.setCommands({
        angularBuild: ['npm', '--version'],
        vitest: ['npx', '--version'],
        localApi: ['node', '-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', 'ze spacją', 'z"cudzysłowem'],
    });
    for (const gate of ['angularBuild', 'vitest', 'localApi']) {
        const result = quality('run', id, gate);
        assert.equal(result.status, 0, `${gate}: ${result.stderr}${result.stdout}`);
        assert.equal(gateOf(gate).status, 'passed');
        assert.equal(gateOf(gate).exitCode, 0);
    }
    assert.match(logOf('angularBuild'), /\d+\.\d+\.\d+/);
    assert.match(logOf('localApi'), /ze spacją/);
    assert.match(logOf('localApi'), /z\\"cudzysłowem/);

    // Niezerowy kod wyjścia => failed z zachowanym exitCode
    repo.setCommands({ angularBuild: [process.execPath, '-e', 'process.exit(3)'], vitest: ['no-such-command-xyz'], localApi: [] });
    assert.equal(quality('run', id, 'angularBuild').status, 1);
    assert.equal(gateOf('angularBuild').status, 'failed');
    assert.equal(gateOf('angularBuild').exitCode, 3);

    // Nieistniejące polecenie => failed (a nie crash), z informacją o błędzie
    assert.equal(quality('run', id, 'vitest').status, 1);
    assert.equal(gateOf('vitest').status, 'failed');
    assert.ok(gateOf('vitest').error, 'powinien być zapisany opis błędu');

    // Brak polecenia (pusta lista) => blocked, nigdy passed
    assert.equal(quality('run', id, 'localApi').status, 2);
    assert.equal(gateOf('localApi').status, 'blocked');

    // Sekrety nie trafiają do logów (JWT oraz wartości zmiennych *_TOKEN/*_KEY/*_SECRET/*_PASSWORD)
    repo.setCommands({
        angularBuild: [
            process.execPath,
            '-e',
            "console.log('jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk token=' + process.env.QUALITY_TEST_SECRET_TOKEN)",
        ],
        vitest: [process.execPath, '-e', 'process.exit(0)'],
        localApi: [],
    });
    assert.equal(quality('run', id, 'angularBuild').status, 0);
    const log = logOf('angularBuild');
    assert.ok(!log.includes('supersecretvalue123'), 'wartość sekretu z env w logu');
    assert.ok(!log.includes('eyJhbGciOiJIUzI1NiJ9'), 'JWT w logu');
    assert.match(log, /\[REDACTED/);

    // Przekazywanie ID workflow do poleceń
    repo.setCommands({
        angularBuild: [process.execPath, '-e', 'process.stdout.write(process.env.QUALITY_WORKFLOW_ID)'],
        vitest: [process.execPath, '-e', 'process.exit(0)'],
        localApi: [],
    });
    assert.equal(quality('run', id, 'angularBuild').status, 0);
    assert.equal(logOf('angularBuild').trim(), id);
    assert.ok(path.isAbsolute(repo.temp));
    console.log('PASS: runExternal/quality.cjs - npm, npx, node, błędy, redakcja sekretów');
} finally {
    repo.cleanup();
}
