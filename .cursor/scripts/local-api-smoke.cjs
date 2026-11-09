#!/usr/bin/env node
'use strict';
// Minimalny lokalny smoke test API dla Supabase Edge Functions (gate `localApi`).
//
// Zasady bezpieczeństwa:
// - działa WYŁĄCZNIE na lokalnym Supabase (host loopback + zgodność z supabase/config.toml),
// - brak scenariusza dla zmienionej funkcji = BŁĄD (exit 2), nigdy sukces,
// - 0 wykonanych asercji = BŁĄD,
// - tokeny, hasła i klucze nigdy nie są wypisywane.
//
// Dane testowe (opcjonalnie, tylko lokalne zmienne środowiskowe - nie trafiają do Git):
//   LOCAL_API_USER_EMAIL / LOCAL_API_USER_PASSWORD    -> rola `owner`
//   LOCAL_API_OTHER_EMAIL / LOCAL_API_OTHER_PASSWORD  -> rola `other`
// Gdy ich brak, skrypt tworzy efemerycznych użytkowników przez Admin API LOKALNEGO GoTrue
// (klucz service_role pochodzi z `supabase status`) i usuwa ich po teście.
//
// Wywołanie (zwykle przez `quality.cjs run <ID> localApi`):
//   node .cursor/scripts/local-api-smoke.cjs [--functions a,b] [--shared] [--check-only] [--purge-test-users]
// Zmienne: QUALITY_CHANGED_FUNCTIONS, QUALITY_SHARED_CHANGED, LOCAL_API_URL (tylko loopback; do testów).
//
// Format scenariusza: supabase/tests/api/<funkcja>.smoke.json (patrz README.md w tym katalogu).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveLocalSupabase, isLoopbackHost } = require('./lib/local-supabase.cjs');

const root = process.cwd();
const argv = process.argv.slice(2);
const REQUEST_TIMEOUT_MS = 15000;
const ROLE_ENV = {
    owner: ['LOCAL_API_USER_EMAIL', 'LOCAL_API_USER_PASSWORD'],
    other: ['LOCAL_API_OTHER_EMAIL', 'LOCAL_API_OTHER_PASSWORD'],
};

function argValue(flag) {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
}

function fail(message, code = 2) {
    console.error('ERROR: ' + message);
    process.exit(code);
}

function redact(text) {
    return String(text)
        .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[REDACTED_JWT]')
        .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1[REDACTED]');
}

// ---------------------------------------------------------------------------
// Scenariusze i pokrycie
// ---------------------------------------------------------------------------
function loadScenarios(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const scenarios = [];
    for (const entry of fs.readdirSync(dir).filter((f) => f.endsWith('.smoke.json')).sort()) {
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
        } catch (error) {
            fail(`Niepoprawny JSON w ${entry}: ${error.message}`);
        }
        validateScenario(parsed, entry);
        scenarios.push({ ...parsed, file: entry });
    }
    return scenarios;
}

function validateScenario(scenario, entry) {
    if (!scenario || typeof scenario.function !== 'string' || !/^[a-z0-9-]+$/.test(scenario.function)) {
        fail(`${entry}: pole "function" musi być nazwą funkcji (kebab-case)`);
    }
    if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
        fail(`${entry}: "steps" musi być niepustą tablicą`);
    }
    for (const step of [...scenario.steps, ...(scenario.cleanup || [])]) {
        const roleOk = !step.as || step.as === 'anon' || ROLE_ENV[step.as];
        const statusOk =
            step.expect &&
            (Number.isInteger(step.expect.status) ||
                (Array.isArray(step.expect.status) && step.expect.status.length > 0));
        const functionOk = step.function === undefined || /^[a-z0-9-]+$/.test(step.function);
        const pathOk = typeof step.path === 'string' && (step.path === '' || step.path.startsWith('/') || step.path.startsWith('?'));
        if (!step.name || !step.method || !pathOk || !roleOk || !statusOk || !functionOk) {
            fail(`${entry}: krok "${step.name || '?'}" wymaga name, method, path (od "/"), expect.status oraz as ∈ anon|owner|other`);
        }
    }
}

function functionExists(name) {
    return fs.existsSync(path.join(root, 'supabase', 'functions', name, 'index.ts'));
}

function selectTargets(scenarios) {
    const raw = argValue('--functions') ?? process.env.QUALITY_CHANGED_FUNCTIONS ?? '';
    const changed = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const sharedChanged = argv.includes('--shared') || process.env.QUALITY_SHARED_CHANGED === '1';
    const existingChanged = changed.filter(functionExists);
    const byFunction = new Map();
    for (const scenario of scenarios) {
        byFunction.set(scenario.function, [...(byFunction.get(scenario.function) || []), scenario]);
    }

    const missing = existingChanged.filter((fn) => !byFunction.has(fn));
    if (missing.length > 0) {
        fail(
            `Brak scenariusza localApi dla zmienionych funkcji: ${missing.join(', ')}. ` +
                `Dodaj supabase/tests/api/<funkcja>.smoke.json - brak scenariusza nie oznacza sukcesu.`
        );
    }

    // Zmiana w _shared (lub brak wskazanej funkcji) => uruchom wszystkie scenariusze.
    const runAll = sharedChanged || existingChanged.length === 0;
    const targets = runAll ? [...byFunction.keys()] : existingChanged;
    if (targets.length === 0) {
        fail('Brak jakichkolwiek scenariuszy w supabase/tests/api - gate localApi nie może przejść.');
    }
    return { targets, byFunction, changed: existingChanged, runAll };
}

// ---------------------------------------------------------------------------
// Środowisko lokalne
// ---------------------------------------------------------------------------
function resolveEnvironment() {
    if (process.env.LOCAL_API_URL) {
        let url;
        try {
            url = new URL(process.env.LOCAL_API_URL);
        } catch {
            return fail('LOCAL_API_URL nie jest poprawnym URL');
        }
        if (!isLoopbackHost(url.hostname)) {
            fail('LOCAL_API_URL musi wskazywać na localhost/127.0.0.1');
        }
        if (!process.env.LOCAL_API_ANON_KEY) {
            fail('Przy LOCAL_API_URL wymagany jest LOCAL_API_ANON_KEY');
        }
        return {
            apiUrl: url.origin,
            functionsUrl: `${url.origin}/functions/v1`,
            anonKey: process.env.LOCAL_API_ANON_KEY,
            serviceRoleKey: process.env.LOCAL_API_SERVICE_ROLE_KEY || null,
        };
    }
    const resolved = resolveLocalSupabase(root);
    if (!resolved.ok) {
        fail('Środowisko lokalne niedostępne lub niezgodne z projektem: ' + resolved.errors.join('; '));
    }
    if (!resolved.info.anonKey) {
        fail('Brak ANON_KEY w `supabase status`');
    }
    return resolved.info;
}

async function http(method, url, { headers = {}, body } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { method, headers, body, signal: controller.signal });
        const text = await response.text();
        let json = null;
        try {
            json = JSON.parse(text);
        } catch {
            json = null;
        }
        return { status: response.status, text, json };
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------------------
// Użytkownicy testowi
// ---------------------------------------------------------------------------
function createUserPool(env) {
    const cache = new Map();
    const ephemeralIds = [];

    async function createEphemeral(role) {
        if (!env.serviceRoleKey) {
            throw new Error(`Brak danych logowania dla roli "${role}" (zmienne LOCAL_API_*) oraz klucza service_role do utworzenia konta efemerycznego`);
        }
        const suffix = crypto.randomBytes(5).toString('hex');
        const email = `localapi.${role}.${suffix}@example.test`;
        const password = crypto.randomBytes(18).toString('base64url') + 'aA1!';
        // Trigger handle_new_user wymaga username (3-50 znaków) i boolowskiej zgody marketingowej.
        const userMetadata = { username: `localapi_${role}_${suffix}`, marketing_consent_accepted: false };
        const response = await http('POST', `${env.apiUrl}/auth/v1/admin/users`, {
            headers: {
                apikey: env.serviceRoleKey,
                Authorization: `Bearer ${env.serviceRoleKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password,
                email_confirm: true,
                user_metadata: userMetadata,
                app_metadata: { app_role: 'user' },
            }),
        });
        if (![200, 201].includes(response.status) || !response.json?.id) {
            throw new Error(`Nie udało się utworzyć lokalnego użytkownika testowego (${role}), HTTP ${response.status}`);
        }
        ephemeralIds.push(response.json.id);
        return { email, password };
    }

    async function tokenFor(role) {
        if (cache.has(role)) {
            return cache.get(role);
        }
        const [emailKey, passwordKey] = ROLE_ENV[role];
        const credentials =
            process.env[emailKey] && process.env[passwordKey]
                ? { email: process.env[emailKey], password: process.env[passwordKey] }
                : await createEphemeral(role);
        const response = await http('POST', `${env.apiUrl}/auth/v1/token?grant_type=password`, {
            headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });
        const token = response.json?.access_token;
        if (response.status !== 200 || !token) {
            throw new Error(`Logowanie użytkownika testowego (${role}) nie powiodło się, HTTP ${response.status}`);
        }
        cache.set(role, token);
        return token;
    }

    // Przepisy są usuwane miękko, a `recipes_user_id_fkey` nie ma ON DELETE CASCADE - dlatego
    // przed usunięciem konta efemerycznego kasujemy jego przepisy (tylko LOKALNA baza, klucz service_role).
    async function removeUser(userId) {
        if (!/^[0-9a-f-]{36}$/i.test(userId)) {
            return 'niepoprawny identyfikator użytkownika';
        }
        const headers = { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` };
        await http('DELETE', `${env.apiUrl}/rest/v1/recipes?user_id=eq.${userId}`, { headers });
        const response = await http('DELETE', `${env.apiUrl}/auth/v1/admin/users/${userId}`, { headers });
        return response.status >= 300 ? `HTTP ${response.status}` : null;
    }

    async function dispose() {
        for (const userId of ephemeralIds) {
            try {
                const problem = await removeUser(userId);
                if (problem) {
                    console.warn(`WARN: nie usunięto użytkownika testowego (${problem})`);
                }
            } catch (error) {
                console.warn(`WARN: nie usunięto użytkownika testowego: ${error.message}`);
            }
        }
    }

    // Usuwa pozostałości po przerwanych przebiegach (konta localapi.*@example.test).
    async function purgeLeftovers() {
        if (!env.serviceRoleKey) {
            throw new Error('Brak klucza service_role do posprzątania kont testowych');
        }
        const list = await http('GET', `${env.apiUrl}/auth/v1/admin/users?per_page=200`, {
            headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
        });
        const users = (list.json?.users || []).filter((u) => /^localapi\.(owner|other)\.[0-9a-f]+@example\.test$/.test(u.email || ''));
        let removed = 0;
        for (const user of users) {
            const problem = await removeUser(user.id);
            if (problem) {
                console.warn(`WARN: nie usunięto ${user.email} (${problem})`);
                continue;
            }
            removed += 1;
        }
        return { found: users.length, removed };
    }

    return { tokenFor, dispose, purgeLeftovers };
}

// ---------------------------------------------------------------------------
// Wykonywanie kroków
// ---------------------------------------------------------------------------
function substitute(value, vars) {
    if (typeof value === 'string') {
        const whole = /^\{(\w+)\}$/.exec(value);
        if (whole) {
            if (!(whole[1] in vars)) {
                throw new Error(`Brak zmiennej {${whole[1]}}`);
            }
            return vars[whole[1]];
        }
        return value.replace(/\{(\w+)\}/g, (match, key) => {
            if (!(key in vars)) {
                throw new Error(`Brak zmiennej {${key}}`);
            }
            return String(vars[key]);
        });
    }
    if (Array.isArray(value)) {
        return value.map((item) => substitute(item, vars));
    }
    if (value && typeof value === 'object') {
        if ('$repeat' in value) {
            return String(value.$repeat.char).repeat(Number(value.$repeat.count));
        }
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)]));
    }
    return value;
}

function getPath(json, dotPath) {
    return dotPath.split('.').reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), json);
}

function matchValue(actual, matcher) {
    if (matcher && typeof matcher === 'object' && !Array.isArray(matcher)) {
        if ('$absent' in matcher) {
            return actual === undefined;
        }
        if ('$exists' in matcher) {
            return (actual !== undefined && actual !== null) === Boolean(matcher.$exists);
        }
        if ('$type' in matcher) {
            const type = matcher.$type;
            if (type === 'array') {
                return Array.isArray(actual);
            }
            if (type === 'null') {
                return actual === null;
            }
            return typeof actual === type;
        }
        if ('$minLength' in matcher) {
            return Array.isArray(actual) && actual.length >= matcher.$minLength;
        }
    }
    return JSON.stringify(actual) === JSON.stringify(matcher);
}

async function executeStep(step, ctx) {
    const role = step.as || 'anon';
    const headers = { apikey: ctx.env.anonKey };
    if (role !== 'anon') {
        headers.Authorization = `Bearer ${await ctx.users.tokenFor(role)}`;
    }
    let body;
    if (step.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(substitute(step.body, ctx.vars));
    }
    // Krok może wywołać inną funkcję (np. utworzenie przepisu w `recipes` w scenariuszu `explore`).
    const targetFunction = step.function || ctx.fn;
    const url = `${ctx.env.functionsUrl}/${targetFunction}${substitute(step.path, ctx.vars)}`;
    const response = await http(step.method.toUpperCase(), url, { headers, body });

    const failures = [];
    const expectedStatuses = [].concat(step.expect.status);
    let assertions = 1;
    if (!expectedStatuses.includes(response.status)) {
        failures.push(`oczekiwano HTTP ${expectedStatuses.join('|')}, otrzymano ${response.status}`);
    }
    for (const [dotPath, matcher] of Object.entries(step.expect.json || {})) {
        assertions += 1;
        const expected = substitute(matcher, ctx.vars);
        if (!matchValue(getPath(response.json, dotPath), expected)) {
            failures.push(`pole "${dotPath}" nie spełnia oczekiwania ${JSON.stringify(expected)}`);
        }
    }
    for (const [variable, dotPath] of Object.entries(step.save || {})) {
        const saved = getPath(response.json, dotPath);
        if (saved === undefined || saved === null) {
            failures.push(`nie udało się zapisać zmiennej ${variable} z pola "${dotPath}"`);
            continue;
        }
        ctx.vars[variable] = saved;
    }
    return { response, failures, assertions };
}

async function runScenario(scenario, env, users, totals) {
    const ctx = { env, users, fn: scenario.function, vars: { rand: crypto.randomBytes(4).toString('hex') } };
    let scenarioFailed = false;
    console.log(`\n[${scenario.function}] ${scenario.description || scenario.file}`);

    for (const step of scenario.steps) {
        let result;
        try {
            result = await executeStep(step, ctx);
        } catch (error) {
            result = { response: { status: 0, text: '' }, failures: [error.message], assertions: 1 };
        }
        totals.assertions += result.assertions;
        if (result.failures.length === 0) {
            console.log(`  PASS ${step.name} (HTTP ${result.response.status})`);
            continue;
        }
        scenarioFailed = true;
        totals.failed += 1;
        console.log(`  FAIL ${step.name}: ${result.failures.join('; ')}`);
        console.log(`       odpowiedź: ${redact(result.response.text).slice(0, 200)}`);
        if (scenario.stopOnFail !== false) {
            break;
        }
    }

    for (const step of scenario.cleanup || []) {
        try {
            const result = await executeStep(step, ctx);
            if (result.failures.length > 0) {
                console.warn(`  WARN cleanup "${step.name}": ${result.failures.join('; ')}`);
            }
        } catch (error) {
            console.warn(`  WARN cleanup "${step.name}": ${error.message}`);
        }
    }
    return !scenarioFailed;
}

async function main() {
    if (argv.includes('--purge-test-users')) {
        const result = await createUserPool(resolveEnvironment()).purgeLeftovers();
        console.log(`localApi: posprzątano konta testowe (znaleziono ${result.found}, usunięto ${result.removed})`);
        process.exitCode = result.found === result.removed ? 0 : 1;
        return;
    }

    const scenariosDir = path.resolve(root, argValue('--scenarios-dir') || 'supabase/tests/api');
    const scenarios = loadScenarios(scenariosDir);
    const selection = selectTargets(scenarios);
    const toRun = scenarios.filter((s) => selection.targets.includes(s.function));
    console.log(
        `localApi: funkcje do przetestowania: ${selection.targets.join(', ')} ` +
            `(${selection.runAll ? 'wszystkie scenariusze' : 'tylko zmienione'})`
    );

    if (argv.includes('--check-only')) {
        console.log(`localApi: pokrycie scenariuszami OK (${toRun.length} scenariuszy)`);
        return;
    }

    const env = resolveEnvironment();
    const users = createUserPool(env);
    const totals = { assertions: 0, failed: 0 };
    try {
        for (const scenario of toRun) {
            await runScenario(scenario, env, users, totals);
        }
    } finally {
        await users.dispose();
    }

    console.log('\nLOCAL_API_SMOKE ' + JSON.stringify({ scenarios: toRun.length, assertions: totals.assertions, failedSteps: totals.failed, functions: selection.targets }));
    if (totals.failed > 0) {
        process.exitCode = 1;
        return;
    }
    if (totals.assertions === 0) {
        console.error('ERROR: wykonano 0 asercji - to nie jest sukces');
        process.exitCode = 2;
    }
}

main().catch((error) => {
    console.error('ERROR: ' + redact(error.stack || error.message));
    process.exit(2);
});
