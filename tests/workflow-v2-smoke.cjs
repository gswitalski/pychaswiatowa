'use strict';
// Smoke testy Workflow v2: init/upgrade, dowody wykonania, unieważnianie wyników (stale),
// zakres zmian niezależny od commitów (P4), wymuszanie gate'ów dla migracji/Edge Functions.
const assert = require('node:assert/strict');
const { createTempRepo, NODE_OK } = require('./_helpers.cjs');

const QUALITY = '.cursor/scripts/quality.cjs';
const WORKFLOW = '.cursor/scripts/workflow.cjs';
const smoke = [];
const record = (name) => smoke.push(name);

function withRepo(options, body) {
    const repo = createTempRepo(options);
    try {
        body(repo);
    } finally {
        repo.cleanup();
    }
}

const json = (result) => JSON.parse(result.stdout);
const writeReview = (repo, id, file) => {
    repo.write(`docs/results/workflows/${id}/${file}`, 'REVIEWER: independent-reviewer\nVERDICT: PASS\n');
    return `docs/results/workflows/${id}/${file}`;
};

// --- 1) init zapisuje bazę zakresu; upgrade zachowuje manifest; gate'y wymagają dowodów wykonania
withRepo({}, (repo) => {
    const id = 'LOCAL-test';
    const q = (...a) => repo.node([QUALITY, ...a]);
    assert.equal(repo.node([WORKFLOW, 'init', id, 'story']).status, 0);
    const head = repo.git(['rev-parse', 'HEAD']).stdout.trim();
    assert.equal(repo.manifest(id).scope.baseRef, head, 'init musi zapisać scope.baseRef = HEAD');
    assert.equal(repo.node([WORKFLOW, 'upgrade', id]).status, 0);
    assert.equal(repo.manifest(id).scope.baseRef, head, 'upgrade nie może kasować scope');

    assert.equal(q('run', id, 'angularBuild').status, 0);
    assert.equal(q('run', id, 'vitest').status, 0);
    assert.equal(q('validate', id).status, 2, 'bez code review gate nie przechodzi');
    const report = writeReview(repo, id, 'code-review.md');
    assert.equal(q('review-evidence', id, 'codeReview', report).status, 0);
    assert.equal(q('validate', id).status, 0);
    record('init/upgrade/execution evidence');

    // --- 5) PASSED -> zmiana kodu -> ponowna walidacja: poprzedni wynik NIEAKTUALNY
    repo.write('example.ts', 'export const value = 1;');
    const stale = q('validate', id);
    assert.equal(stale.status, 2);
    const gates = json(stale).qualityGates;
    for (const gate of ['angularBuild', 'vitest', 'codeReview']) {
        assert.equal(gates[gate].status, 'stale', `${gate} musi być stale po zmianie kodu`);
    }
    // Ponowne testy nie wystarczą - review również musi zostać powtórzone.
    assert.equal(q('run', id, 'angularBuild').status, 0);
    assert.equal(q('run', id, 'vitest').status, 0);
    const partial = q('validate', id);
    assert.equal(partial.status, 2);
    assert.equal(json(partial).qualityGates.codeReview.status, 'stale');
    assert.equal(q('review-evidence', id, 'codeReview', report).status, 0);
    assert.equal(q('validate', id).status, 0);
    record('PASSED -> zmiana kodu -> stale (testy i review)');

    // --- 6) commit nie unieważnia wyników ani nie ukrywa wymaganych gate'ów
    const fpBefore = q('fingerprint', id).stdout.trim();
    repo.commitAll('add example');
    assert.equal(q('fingerprint', id).stdout.trim(), fpBefore, 'commit nie zmienia fingerprintu zawartości');
    assert.equal(q('validate', id).status, 0, 'wyniki PASS pozostają ważne po commicie bez zmian kodu');

    repo.write('supabase/migrations/20261108000100_note.sql', 'CREATE TABLE demo(id integer);');
    repo.write('supabase/functions/recipes/index.ts', 'export {}');
    const before = json(q('requirements', id));
    assert.deepEqual(
        [before.localMigration, before.localApi, before.rlsReview],
        [true, true, true],
        'migracja i Edge Function wymuszają gate\'y nawet gdy konfiguracja mówi false'
    );
    repo.commitAll('add migration and function');
    const after = json(q('requirements', id));
    assert.deepEqual(after, before, 'po commicie wymagane gate\'y nie mogą zniknąć');
    assert.equal(q('validate', id).status, 2);
    const sticky = repo.manifest(id).requirements;
    assert.equal(sticky.databaseChanged, true, 'wymaganie powinno zostać zapamiętane w manifeście');
    assert.equal(sticky.backendChanged, true);
    record('commit nie ukrywa gate\'ów (migracja, API, RLS)');

    // Revert plików nie wyłącza wymaganych gate'ów (lepkość)
    assert.equal(repo.git(['rm', '-q', 'supabase/migrations/20261108000100_note.sql', 'supabase/functions/recipes/index.ts']).status, 0);
    repo.commitAll('revert');
    const reverted = json(q('requirements', id));
    assert.equal(reverted.localMigration, true);
    assert.equal(reverted.localApi, true);
    assert.equal(reverted.rlsReview, true);
    record('wymagania są lepkie po revercie');

    // Brak polecenia localApi = BLOCKED (nie pozorujemy wyniku)
    const absentApi = q('run', id, 'localApi');
    assert.equal(absentApi.status, 2);
    assert.equal(repo.manifest(id).qualityGates.localApi.status, 'blocked');
});

// --- 2) Zakres per workflow: set-base wymaga --force, set-paths zawęża zakres
withRepo({}, (repo) => {
    const id = 'LOCAL-scope';
    const q = (...a) => repo.node([QUALITY, ...a]);
    assert.equal(repo.node([WORKFLOW, 'init', id, 'story']).status, 0);
    repo.write('supabase/migrations/20261108000200_x.sql', 'select 1;');
    repo.write('supabase/functions/me/index.ts', 'export {}');
    repo.write('src/app/a.ts', 'export {}');
    repo.commitAll('mixed changes');

    const firstCommit = repo.git(['rev-parse', 'HEAD~1']).stdout.trim();
    const refused = q('scope', id, 'set-base', 'HEAD');
    assert.equal(refused.status, 2, 'zmiana istniejącej bazy bez --force musi zostać odrzucona');
    assert.equal(repo.manifest(id).scope.baseRef, firstCommit);

    assert.equal(q('scope', id, 'set-paths', 'supabase/migrations').status, 0);
    const migrationsOnly = json(q('requirements', id));
    assert.equal(migrationsOnly.localMigration, true);
    assert.equal(migrationsOnly.localApi, false, 'zmiany poza zakresem workflow nie wymuszają localApi');

    assert.equal(q('scope', id, 'clear-paths').status, 0);
    // flagi są lepkie, więc sprawdzamy bezpośrednio wynik `scope show`
    const shown = json(q('scope', id, 'show'));
    assert.deepEqual(shown.functions, ['me']);
    assert.equal(shown.backendChanged, true);
    record('scope: baza, --force, set-paths');
});

// --- 3) Manifest bez scope (starszy) -> merge-base z main; bez main -> błąd (nigdy cichy HEAD)
withRepo({}, (repo) => {
    const id = 'LOCAL-legacy';
    const q = (...a) => repo.node([QUALITY, ...a]);
    assert.equal(repo.node([WORKFLOW, 'init', id, 'story']).status, 0);
    const manifest = repo.manifest(id);
    delete manifest.scope;
    repo.writeManifest(id, manifest);

    assert.equal(repo.git(['checkout', '-q', '-b', 'feature/legacy']).status, 0);
    repo.write('supabase/migrations/20261108000300_y.sql', 'select 1;');
    repo.commitAll('migration on branch');
    const viaMergeBase = json(q('requirements', id));
    assert.equal(viaMergeBase.localMigration, true, 'merge-base z main musi wykryć zacommitowaną migrację');

    // Brak gałęzi main (np. inna nazwa) i brak scope.baseRef => jawny błąd, a nie cichy fallback do HEAD.
    assert.equal(repo.git(['branch', '-m', 'main', 'trunk']).status, 0);
    const noBase = repo.node([QUALITY, 'scope', id, 'show']);
    assert.equal(noBase.status, 2);
    assert.match(noBase.stderr, /scope\.baseRef/);
    record('manifest bez scope: merge-base i błąd bez bazy');
});

// --- 4) localApi: brak scenariusza = błąd, nigdy sukces
withRepo({ commands: { angularBuild: NODE_OK, vitest: NODE_OK, localApi: ['node', '.cursor/scripts/local-api-smoke.cjs'] } }, (repo) => {
    const id = 'LOCAL-api';
    const q = (...a) => repo.node([QUALITY, ...a]);
    assert.equal(repo.node([WORKFLOW, 'init', id, 'story']).status, 0);
    repo.write('supabase/functions/recipes/index.ts', 'export {}');

    const noScenario = q('run', id, 'localApi');
    assert.notEqual(noScenario.status, 0, 'bez scenariusza gate nie może przejść');
    const gate = repo.manifest(id).qualityGates.localApi;
    assert.equal(gate.status, 'failed');
    assert.match(repo.read(gate.log), /Brak scenariusza localApi dla zmienionych funkcji: recipes/);

    // Scenariusz istnieje -> kontrola pokrycia przechodzi (bez kontaktu z Supabase)
    repo.write('supabase/tests/api/recipes.smoke.json', JSON.stringify({
        function: 'recipes',
        steps: [{ name: 'ping', method: 'GET', path: '/x', expect: { status: 200 } }],
    }));
    const coverage = repo.node(['.cursor/scripts/local-api-smoke.cjs', '--check-only'], { env: { QUALITY_CHANGED_FUNCTIONS: 'recipes' } });
    assert.equal(coverage.status, 0, coverage.stderr);

    // Scenariusz dotyczy innej funkcji -> nadal błąd
    repo.write('supabase/functions/tags/index.ts', 'export {}');
    const partial = repo.node(['.cursor/scripts/local-api-smoke.cjs', '--check-only'], { env: { QUALITY_CHANGED_FUNCTIONS: 'recipes,tags' } });
    assert.equal(partial.status, 2);
    assert.match(partial.stderr, /tags/);
    record('localApi: brak scenariusza = błąd');
});

console.log('PASS: ' + smoke.join('; '));
