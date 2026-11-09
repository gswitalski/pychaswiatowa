#!/usr/bin/env node
'use strict';
// Node 20+. Brak zewnętrznych zależności. Uruchamiaj z katalogu głównego projektu.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { runExternal } = require('./lib/exec.cjs');
const {
    resolveLocalSupabase,
    listPendingMigrations,
    supabaseOptions,
} = require('./lib/local-supabase.cjs');

const root = process.cwd();
const base = path.join(root, 'docs/results/workflows');
const [cmd, id, name, ...rest] = process.argv.slice(2);
const GATES = ['angularBuild', 'vitest', 'localMigration', 'localApi', 'codeReview', 'rlsReview'];
const RUNNABLE_GATES = ['angularBuild', 'vitest', 'localApi'];
const BASE_BRANCH_CANDIDATES = ['origin/main', 'main'];
const USAGE = [
    'Usage:',
    '  quality.cjs run ID angularBuild|vitest|localApi',
    '  quality.cjs migrate-local ID',
    '  quality.cjs preflight-local            (tylko odczyt, bez ID)',
    '  quality.cjs validate ID',
    '  quality.cjs requirements ID',
    '  quality.cjs fingerprint ID',
    '  quality.cjs scope ID [show | set-base <ref> [--force] | set-paths <prefix...> | clear-paths]',
    '  quality.cjs review-evidence ID codeReview|rlsReview <plik-raportu>',
].join('\n');

function die(message, code = 2) {
    console.error('ERROR: ' + message);
    process.exit(code);
}

// ---------------------------------------------------------------------------
// Konfiguracja i manifest
// ---------------------------------------------------------------------------
const cfgPath = path.join(root, '.cursor/config/quality.json');
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};

let file = null;
let state = null;
const needsWorkflow = cmd !== 'preflight-local';

if (needsWorkflow) {
    if (!/^(PS-\d+|LOCAL-[A-Za-z0-9][\w-]*)$/.test(id || '')) {
        die('ID: PS-123 lub LOCAL-slug\n' + USAGE);
    }
    file = path.join(base, id, 'workflow.json');
    if (!fs.existsSync(file)) {
        die('Brak workflow: ' + file);
    }
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    state.qualityGates ||= {};
}

function save() {
    fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
}

function gate(gateName) {
    return state.qualityGates[gateName] || { status: 'pending' };
}

// ---------------------------------------------------------------------------
// Redakcja sekretów w logach i na konsoli
// ---------------------------------------------------------------------------
function redact(text) {
    let out = String(text).replace(
        /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g,
        '[REDACTED_JWT]'
    );
    out = out.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1[REDACTED]');
    for (const [key, value] of Object.entries(process.env)) {
        if (/(KEY|SECRET|PASSWORD|TOKEN)/i.test(key) && value && value.length >= 8) {
            out = out.split(value).join('[REDACTED]');
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Git: fingerprint (zawartość plików) oraz zakres zmian przypisany do workflow
// ---------------------------------------------------------------------------
function git(args) {
    return cp.spawnSync('git', args, {
        cwd: root,
        encoding: 'buffer',
        maxBuffer: 50 * 1024 * 1024,
    });
}

function gitText(args) {
    const result = git(args);
    return { ok: result.status === 0, out: (result.stdout || Buffer.alloc(0)).toString('utf8').trim() };
}

function splitNul(buffer) {
    return buffer.toString('utf8').split('\0').filter(Boolean);
}

function repoFiles() {
    const result = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
    if (result.status !== 0) {
        die('Wymagane repo Git dla fingerprintu.');
    }
    return splitNul(result.stdout)
        .filter(
            (x) =>
                !x.startsWith('docs/results/workflows/') &&
                !x.startsWith('docs/results/project-summary') &&
                !x.startsWith('.cursor/') &&
                !x.startsWith('docs/') &&
                !x.startsWith('node_modules/') &&
                !x.startsWith('dist/') &&
                !x.startsWith('coverage/') &&
                !x.endsWith('.md') &&
                !x.endsWith('.lockb')
        )
        .sort();
}

// Fingerprint zależy WYŁĄCZNIE od zawartości plików roboczych - commit go nie zmienia,
// a każda zmiana kodu (również po PASS) unieważnia poprzednie wyniki.
function fingerprint() {
    const hash = crypto.createHash('sha256');
    if (fs.existsSync(cfgPath)) {
        hash.update(fs.readFileSync(cfgPath));
    }
    for (const rel of repoFiles()) {
        const full = path.join(root, rel);
        if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
            continue;
        }
        hash.update(rel);
        hash.update('\0');
        hash.update(crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'));
        hash.update('\n');
    }
    return hash.digest('hex');
}

function normalizePrefix(value) {
    return String(value).replaceAll('\\', '/').replace(/^\.\//, '');
}

function resolveCommit(ref) {
    const result = gitText(['rev-parse', '--verify', `${ref}^{commit}`]);
    return result.ok ? result.out : null;
}

/**
 * Baza porównania zmian dla workflow (P4).
 * 1) `scope.baseRef` zapisany w manifeście (ustawiany przy `workflow.cjs init`),
 * 2) w ostateczności merge-base z gałęzią główną (zakres może być wtedy szerszy niż workflow).
 * Nigdy nie wracamy cicho do HEAD - to powodowało znikanie gate'ów po commicie.
 */
function resolveBase() {
    const configured = state.scope?.baseRef;
    if (configured) {
        const sha = resolveCommit(configured);
        if (!sha) {
            die(`scope.baseRef (${configured}) nie jest poprawnym commitem. Napraw: quality.cjs scope ${id} set-base <sha> --force`);
        }
        return { sha, source: 'manifest' };
    }
    for (const candidate of BASE_BRANCH_CANDIDATES) {
        if (!resolveCommit(candidate)) {
            continue;
        }
        const mergeBase = gitText(['merge-base', 'HEAD', candidate]);
        if (mergeBase.ok && mergeBase.out) {
            return { sha: mergeBase.out, source: `merge-base:${candidate}` };
        }
    }
    return die(
        `Brak scope.baseRef w manifeście i brak gałęzi ${BASE_BRANCH_CANDIDATES.join('/')}. ` +
            `Ustaw bazę: quality.cjs scope ${id} set-base <sha>`
    );
}

function changedPaths() {
    const baseInfo = resolveBase();
    const diff = git(['diff', '--name-only', '--no-renames', '-z', baseInfo.sha, '--']);
    const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']);
    if (diff.status !== 0 || untracked.status !== 0) {
        die('Nie można sprawdzić zmian Git względem bazy ' + baseInfo.sha);
    }
    let paths = [...new Set([...splitNul(diff.stdout), ...splitNul(untracked.stdout)])];

    const include = (state.scope?.paths || []).map(normalizePrefix);
    if (include.length > 0) {
        const inScope = (p) =>
            include.some((prefix) => {
                if (prefix.endsWith('/')) {
                    return p.startsWith(prefix);
                }
                return p === prefix || p.startsWith(prefix + '/');
            });
        paths = paths.filter(inScope);
    }
    return { paths, base: baseInfo };
}

function analyzeChanges() {
    const { paths, base: baseInfo } = changedPaths();
    const migrations = paths.filter((p) => /^supabase\/migrations\/.*\.sql$/i.test(p));
    const functionFiles = paths.filter((p) => /^supabase\/functions\//i.test(p));
    const functions = new Set();
    let sharedChanged = false;
    for (const p of functionFiles) {
        const match = /^supabase\/functions\/([^/]+)\//i.exec(p);
        if (!match) {
            continue;
        }
        if (match[1] === '_shared') {
            sharedChanged = true;
            continue;
        }
        functions.add(match[1]);
    }
    return {
        base: baseInfo,
        paths,
        databaseChanged: migrations.length > 0,
        backendChanged: functionFiles.length > 0,
        functions: [...functions].sort(),
        sharedChanged,
    };
}

function required(changes = analyzeChanges()) {
    const flags = state.requirements || {};
    const db = changes.databaseChanged;
    const backend = changes.backendChanged;
    return {
        angularBuild: true,
        vitest: true,
        localMigration: !!(db || cfg.required?.localMigration || flags.databaseChanged),
        localApi: !!(backend || cfg.required?.localApi || flags.backendChanged),
        codeReview: true,
        rlsReview: !!(db || cfg.required?.rlsReview || flags.databaseChanged),
    };
}

// Wykryty zakres jest "lepki": raz wymagany gate nie znika po revercie/commicie.
function persistRequirements(changes) {
    state.requirements ||= { databaseChanged: false, backendChanged: false };
    let dirty = false;
    if (changes.databaseChanged && state.requirements.databaseChanged !== true) {
        state.requirements.databaseChanged = true;
        dirty = true;
    }
    if (changes.backendChanged && state.requirements.backendChanged !== true) {
        state.requirements.backendChanged = true;
        dirty = true;
    }
    if (dirty) {
        save();
    }
}

// ---------------------------------------------------------------------------
// Uruchamianie gate'ów
// ---------------------------------------------------------------------------
function capture(gateName, run, detail, fp) {
    const logDir = path.join(base, id, 'quality-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const log = path.join(logDir, `${gateName}.log`);
    const raw = `${run.stdout || ''}\n${run.stderr || ''}\n${run.error ? 'ERROR: ' + run.error.message : ''}`;
    fs.writeFileSync(log, redact(raw).slice(-200000), { mode: 0o600 });
    const pass = run.status === 0 && !run.error;
    state.qualityGates[gateName] = {
        status: pass ? 'passed' : 'failed',
        at: new Date().toISOString(),
        exitCode: run.status,
        signal: run.signal || null,
        command: detail,
        log: path.relative(root, log).replaceAll('\\', '/'),
        fingerprint: fp,
        error: run.error?.message || null,
    };
    save();
    console.log(`${gateName}: ${pass ? 'PASSED' : 'FAILED'} (exit=${run.status}) log=${path.relative(root, log)}`);
    if (!pass) {
        process.exitCode = 1;
    }
}

function blockGate(gateName, reason) {
    state.qualityGates[gateName] = { status: 'blocked', reason, at: new Date().toISOString() };
    save();
    die(`${gateName}: ${reason}. Nie można oznaczyć PASS.`);
}

function runConfigured(gateName) {
    const spec = cfg.commands?.[gateName];
    if (!Array.isArray(spec) || !spec.length || !spec.every((x) => typeof x === 'string')) {
        blockGate(gateName, `Brak skonfigurowanego polecenia w .cursor/config/quality.json`);
    }

    const env = { QUALITY_WORKFLOW_ID: id };
    if (gateName === 'localApi') {
        const changes = analyzeChanges();
        persistRequirements(changes);
        env.QUALITY_BASE_REF = changes.base.sha;
        env.QUALITY_CHANGED_FUNCTIONS = changes.functions.join(',');
        env.QUALITY_SHARED_CHANGED = changes.sharedChanged ? '1' : '0';
    }

    const fp = fingerprint();
    const result = runExternal(spec[0], spec.slice(1), { env });
    capture(gateName, result, spec.join(' '), fp);
}

function preflightLocal() {
    const resolved = resolveLocalSupabase(root);
    if (!resolved.ok) {
        return { ok: false, errors: resolved.errors, warnings: resolved.warnings };
    }
    const pending = listPendingMigrations(root);
    if (!pending.ok) {
        return { ok: false, errors: [pending.error], warnings: resolved.warnings };
    }
    const { info } = resolved;
    return {
        ok: true,
        errors: [],
        warnings: resolved.warnings,
        target: {
            projectId: info.projectId,
            apiUrl: info.apiUrl,
            db: `${info.dbHost}:${info.dbPort}`,
        },
        pendingMigrations: pending.pending,
    };
}

function localMigration() {
    const preflight = preflightLocal();
    if (!preflight.ok) {
        blockGate('localMigration', 'Weryfikacja lokalnego Supabase nie powiodła się: ' + preflight.errors.join('; '));
    }
    persistRequirements(analyzeChanges());
    console.log(
        `Cel migracji: lokalny Supabase projektu ${preflight.target.projectId} (DB ${preflight.target.db}); ` +
            `oczekujące migracje: ${preflight.pendingMigrations.length}`
    );
    const fp = fingerprint();
    // `--local` jest wymuszone; zmienne wskazujące na środowisko zdalne są usuwane z env.
    const result = runExternal('supabase', ['migration', 'up', '--local'], supabaseOptions(root, 600000));
    capture('localMigration', result, 'supabase migration up --local', fp);
}

// ---------------------------------------------------------------------------
// Walidacja
// ---------------------------------------------------------------------------
function validate() {
    const fp = fingerprint();
    const changes = analyzeChanges();
    const req = required(changes);
    const results = {};
    let good = true;
    for (const g of GATES) {
        const value = gate(g);
        const needed = req[g];
        let status = value.status || 'pending';
        if (status === 'passed' && value.fingerprint && value.fingerprint !== fp) {
            status = 'stale';
        }
        if (status === 'passed' && !value.fingerprint) {
            status = 'invalid';
        }
        results[g] = { required: needed, status };
        if (needed && status !== 'passed') {
            good = false;
        }
    }
    console.log(
        JSON.stringify(
            {
                valid: good,
                mergeReady: good,
                qualityGates: results,
                scope: { base: changes.base.sha, source: changes.base.source, changedFiles: changes.paths.length },
                fingerprint: fp,
            },
            null,
            2
        )
    );
    if (!good) {
        process.exitCode = 2;
    }
}

function reviewEvidence(gateName, rel) {
    if (!['codeReview', 'rlsReview'].includes(gateName)) {
        die('Dozwolone: codeReview lub rlsReview');
    }
    const reportPath = path.resolve(root, rel || '');
    if (!reportPath.startsWith(path.join(base, id) + path.sep) || !fs.existsSync(reportPath)) {
        die('Raport review musi być w katalogu workflow');
    }
    const body = fs.readFileSync(reportPath, 'utf8');
    if (!/^VERDICT: PASS\s*$/m.test(body) || !/^REVIEWER: independent-reviewer\s*$/m.test(body)) {
        die('Raport musi zawierać VERDICT: PASS i REVIEWER: independent-reviewer w osobnych wierszach; brak automatycznej oceny jakości');
    }
    state.qualityGates[gateName] = {
        status: 'passed',
        method: 'review-attestation',
        report: path.relative(root, reportPath).replaceAll('\\', '/'),
        at: new Date().toISOString(),
        fingerprint: fingerprint(),
    };
    save();
    console.log(gateName + ': REVIEW ATTESTED (nie dowodzi uruchomienia subagenta)');
}

function scopeCommand() {
    const sub = name || 'show';
    if (sub === 'show') {
        const changes = analyzeChanges();
        console.log(
            JSON.stringify(
                {
                    base: changes.base,
                    paths: state.scope?.paths || [],
                    changedFiles: changes.paths.length,
                    databaseChanged: changes.databaseChanged,
                    backendChanged: changes.backendChanged,
                    functions: changes.functions,
                    sharedChanged: changes.sharedChanged,
                },
                null,
                2
            )
        );
        return;
    }
    if (sub === 'set-base') {
        const ref = rest[0];
        if (!ref) {
            die('set-base wymaga commitu/refa');
        }
        const sha = resolveCommit(ref);
        if (!sha) {
            die(`Nie można rozwiązać ${ref} do commitu`);
        }
        const existing = state.scope?.baseRef;
        if (existing && resolveCommit(existing) !== sha && !rest.includes('--force')) {
            die('scope.baseRef już istnieje; zmiana bazy może ukryć wymagane gate\'y. Użyj --force po świadomej decyzji.');
        }
        state.scope = { ...(state.scope || {}), baseRef: sha, baseSetAt: new Date().toISOString() };
        save();
        console.log(`scope.baseRef = ${sha}`);
        return;
    }
    if (sub === 'set-paths') {
        if (rest.length === 0) {
            die('set-paths wymaga co najmniej jednego prefiksu');
        }
        state.scope = { ...(state.scope || {}), paths: rest.map(normalizePrefix) };
        save();
        console.log('scope.paths = ' + JSON.stringify(state.scope.paths));
        return;
    }
    if (sub === 'clear-paths') {
        if (state.scope) {
            delete state.scope.paths;
        }
        save();
        console.log('scope.paths usunięte');
        return;
    }
    die('scope: show | set-base <ref> | set-paths <prefix...> | clear-paths');
}

// ---------------------------------------------------------------------------
// Polecenia
// ---------------------------------------------------------------------------
if (cmd === 'run') {
    if (!RUNNABLE_GATES.includes(name)) {
        die('Obsługiwane: ' + RUNNABLE_GATES.join(', '));
    }
    runConfigured(name);
} else if (cmd === 'migrate-local') {
    localMigration();
} else if (cmd === 'preflight-local') {
    const result = preflightLocal();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
        process.exitCode = 2;
    }
} else if (cmd === 'validate') {
    validate();
} else if (cmd === 'fingerprint') {
    console.log(fingerprint());
} else if (cmd === 'requirements') {
    const changes = analyzeChanges();
    persistRequirements(changes);
    console.log(JSON.stringify(required(changes), null, 2));
} else if (cmd === 'scope') {
    scopeCommand();
} else if (cmd === 'review-evidence') {
    reviewEvidence(name, rest[0]);
} else {
    die(USAGE);
}
