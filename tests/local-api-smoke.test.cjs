'use strict';
// Test runnera localApi na atrapie lokalnego serwera Supabase (GoTrue + Edge Function).
// Sprawdza: PASS przy poprawnym API, FAIL przy błędnym, błąd przy braku scenariusza,
// odmowę pracy z hostem innym niż loopback, brak wycieku tokenów oraz sprzątanie kont efemerycznych.
const assert = require('node:assert/strict');
const http = require('node:http');
const cp = require('node:child_process');
const { createTempRepo } = require('./_helpers.cjs');

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2NrIn0.mocksignature123';
const state = { created: 0, deleted: 0, loggedIn: 0, calls: [] };

function startServer() {
    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            const url = new URL(req.url, 'http://127.0.0.1');
            const send = (status, body) => {
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(body === undefined ? '' : JSON.stringify(body));
            };
            state.calls.push(`${req.method} ${url.pathname}`);
            if (req.method === 'POST' && url.pathname === '/auth/v1/admin/users') {
                state.created += 1;
                return send(200, { id: `00000000-0000-4000-8000-${String(state.created).padStart(12, '0')}` });
            }
            if (req.method === 'DELETE' && url.pathname.startsWith('/auth/v1/admin/users/')) {
                state.deleted += 1;
                return send(200, {});
            }
            if (req.method === 'POST' && url.pathname === '/auth/v1/token') {
                state.loggedIn += 1;
                return send(200, { access_token: TOKEN });
            }
            if (url.pathname === '/functions/v1/hello/ping') {
                return send(200, { ok: true, items: [1] });
            }
            if (url.pathname === '/functions/v1/hello/secure') {
                const authorized = req.headers.authorization === `Bearer ${TOKEN}`;
                return authorized ? send(200, { my_note: null }) : send(401, { code: 'UNAUTHORIZED' });
            }
            return send(404, { code: 'NOT_FOUND' });
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function runScript(repo, extraEnv, args = []) {
    return new Promise((resolve) => {
        const child = cp.spawn(process.execPath, ['.cursor/scripts/local-api-smoke.cjs', ...args], {
            cwd: repo.temp,
            env: { ...process.env, ...extraEnv },
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d));
        child.stderr.on('data', (d) => (stderr += d));
        child.on('close', (status) => resolve({ status, stdout, stderr }));
    });
}

const scenario = (expectPing = 200) => ({
    function: 'hello',
    description: 'atrapa',
    steps: [
        { name: 'ping', as: 'anon', method: 'GET', path: '/ping', expect: { status: expectPing, json: { ok: true, items: { $minLength: 1 } } } },
        { name: 'secure bez tokenu', as: 'anon', method: 'GET', path: '/secure', expect: { status: 401 } },
        { name: 'secure z tokenem', as: 'owner', method: 'GET', path: '/secure', expect: { status: 200, json: { my_note: { $type: 'null' } } } },
    ],
});

async function main() {
    const repo = createTempRepo();
    const server = await startServer();
    const port = server.address().port;
    const env = {
        LOCAL_API_URL: `http://127.0.0.1:${port}`,
        LOCAL_API_ANON_KEY: 'anon-key-mock-value',
        LOCAL_API_SERVICE_ROLE_KEY: 'service-key-mock-value',
        QUALITY_CHANGED_FUNCTIONS: 'hello',
        QUALITY_SHARED_CHANGED: '0',
        // Test ma używać kont efemerycznych, niezależnie od lokalnego środowiska deweloperskiego.
        LOCAL_API_USER_EMAIL: '',
        LOCAL_API_USER_PASSWORD: '',
        LOCAL_API_OTHER_EMAIL: '',
        LOCAL_API_OTHER_PASSWORD: '',
    };
    try {
        repo.write('supabase/functions/hello/index.ts', 'export {}');

        // a) Poprawne API + scenariusz => exit 0, asercje > 0, konta efemeryczne usunięte, bez wycieku tokenu
        repo.write('supabase/tests/api/hello.smoke.json', JSON.stringify(scenario()));
        const pass = await runScript(repo, env);
        assert.equal(pass.status, 0, pass.stdout + pass.stderr);
        assert.match(pass.stdout, /LOCAL_API_SMOKE .*"assertions":(\d+)/);
        assert.ok(Number(/"assertions":(\d+)/.exec(pass.stdout)[1]) >= 5);
        assert.ok(!pass.stdout.includes(TOKEN) && !pass.stderr.includes(TOKEN), 'token nie może trafić do wyjścia');
        assert.equal(state.created, 1, 'tylko rola owner wymagała konta');
        assert.equal(state.deleted, state.created, 'konta efemeryczne muszą zostać usunięte');

        // b) Niezgodna odpowiedź => exit 1
        repo.write('supabase/tests/api/hello.smoke.json', JSON.stringify(scenario(201)));
        const failing = await runScript(repo, env);
        assert.equal(failing.status, 1, failing.stdout + failing.stderr);
        assert.match(failing.stdout, /FAIL ping/);
        assert.equal(state.deleted, state.created, 'sprzątanie również po błędzie');

        // c) Zmieniona funkcja bez scenariusza => exit 2 (bez kontaktu z serwerem)
        repo.write('supabase/functions/other/index.ts', 'export {}');
        const callsBefore = state.calls.length;
        const missing = await runScript(repo, { ...env, QUALITY_CHANGED_FUNCTIONS: 'hello,other' });
        assert.equal(missing.status, 2);
        assert.match(missing.stderr, /Brak scenariusza localApi dla zmienionych funkcji: other/);
        assert.equal(state.calls.length, callsBefore, 'brak scenariusza nie może kontaktować się z API');

        // d) Host spoza loopback => exit 2, żadnych wywołań sieciowych
        const remote = await runScript(repo, { ...env, LOCAL_API_URL: 'https://example.com' });
        assert.equal(remote.status, 2);
        assert.match(remote.stderr, /localhost|127\.0\.0\.1/);

        // e) Brak jakichkolwiek scenariuszy => exit 2
        const empty = createTempRepo();
        try {
            empty.write('supabase/functions/hello/index.ts', 'export {}');
            const none = await runScript(empty, { ...env, QUALITY_CHANGED_FUNCTIONS: '' });
            assert.equal(none.status, 2);
            assert.match(none.stderr, /Brak jakichkolwiek scenariuszy/);
        } finally {
            empty.cleanup();
        }

        // f) Scenariusz bez asercji statusu jest odrzucany (walidacja schematu)
        repo.write('supabase/tests/api/hello.smoke.json', JSON.stringify({ function: 'hello', steps: [{ name: 'x', method: 'GET', path: '/ping', expect: {} }] }));
        const invalid = await runScript(repo, env);
        assert.equal(invalid.status, 2);
        console.log('PASS: local-api-smoke - PASS/FAIL, brak scenariusza, loopback, sprzątanie, brak wycieku tokenu');
    } finally {
        server.close();
        repo.cleanup();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
