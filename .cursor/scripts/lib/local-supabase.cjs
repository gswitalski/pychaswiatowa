'use strict';
// Weryfikacja, że docelowym środowiskiem jest LOKALNY Supabase TEGO projektu (P2).
// Używa globalnego Supabase CLI. Nie modyfikuje bazy i nie wypisuje kluczy.
const fs = require('node:fs');
const path = require('node:path');
const { runExternal } = require('./exec.cjs');

// Zmienne, które mogłyby skierować CLI na środowisko zdalne - nigdy ich nie przekazujemy.
const REMOTE_ENV_KEYS = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_PROJECT_ID'];

function sectionValue(toml, section, key) {
    const lines = toml.split(/\r?\n/);
    let inSection = false;
    for (const line of lines) {
        const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);
        if (header) {
            inSection = header[1].trim() === section;
            continue;
        }
        if (!inSection) {
            continue;
        }
        const match = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*(#.*)?$`).exec(line);
        if (match) {
            return match[1].replace(/^"|"$/g, '');
        }
    }
    return null;
}

function readLocalConfig(root) {
    const file = path.join(root, 'supabase', 'config.toml');
    if (!fs.existsSync(file)) {
        return { error: 'Brak supabase/config.toml' };
    }
    const toml = fs.readFileSync(file, 'utf8');
    const projectId = /^\s*project_id\s*=\s*"([^"]+)"/m.exec(toml)?.[1] || null;
    const apiPort = Number(sectionValue(toml, 'api', 'port'));
    const dbPort = Number(sectionValue(toml, 'db', 'port'));
    if (!projectId || !apiPort || !dbPort) {
        return { error: 'supabase/config.toml: brak project_id albo portów [api]/[db]' };
    }
    return { projectId, apiPort, dbPort };
}

function isLoopbackHost(host) {
    return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(String(host).toLowerCase());
}

function parseJsonLoose(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
        return null;
    }
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch {
        return null;
    }
}

function supabaseOptions(root, timeout) {
    return { cwd: root, timeout, dropEnv: REMOTE_ENV_KEYS };
}

/**
 * Sprawdza globalne CLI, `supabase status` oraz zgodność hostów/portów z config.toml.
 * Zwraca { ok, errors, warnings, info } - `info` zawiera klucze, więc NIE wolno go logować w całości.
 */
function resolveLocalSupabase(root) {
    const errors = [];
    const warnings = [];

    const config = readLocalConfig(root);
    if (config.error) {
        return { ok: false, errors: [config.error], warnings, info: null };
    }

    const version = runExternal('supabase', ['--version'], supabaseOptions(root, 30000));
    if (version.error || version.status !== 0) {
        return {
            ok: false,
            errors: ['Globalne Supabase CLI jest niedostępne (polecenie `supabase --version` nie działa)'],
            warnings,
            info: null,
        };
    }

    const status = runExternal('supabase', ['status', '-o', 'json'], supabaseOptions(root, 60000));
    if (status.error || status.status !== 0) {
        return {
            ok: false,
            errors: ['Lokalny Supabase nie działa (`supabase status` zakończył się błędem) - uruchom `supabase start`'],
            warnings,
            info: null,
        };
    }

    const json = parseJsonLoose(status.stdout || '');
    if (!json || !json.API_URL || !json.DB_URL) {
        return { ok: false, errors: ['Nie udało się odczytać API_URL/DB_URL z `supabase status -o json`'], warnings, info: null };
    }

    let apiUrl;
    let dbUrl;
    try {
        apiUrl = new URL(json.API_URL);
        dbUrl = new URL(json.DB_URL);
    } catch {
        return { ok: false, errors: ['Niepoprawny API_URL lub DB_URL w odpowiedzi CLI'], warnings, info: null };
    }

    if (!isLoopbackHost(apiUrl.hostname)) {
        errors.push(`API_URL nie wskazuje na localhost (host: ${apiUrl.hostname})`);
    }
    if (!isLoopbackHost(dbUrl.hostname)) {
        errors.push(`DB_URL nie wskazuje na localhost (host: ${dbUrl.hostname})`);
    }
    if (Number(apiUrl.port) !== config.apiPort) {
        errors.push(`Port API (${apiUrl.port}) różni się od supabase/config.toml (${config.apiPort})`);
    }
    if (Number(dbUrl.port) !== config.dbPort) {
        errors.push(`Port DB (${dbUrl.port}) różni się od supabase/config.toml (${config.dbPort})`);
    }

    // Kontener bazy musi należeć do TEGO projektu (project_id z config.toml).
    const containerName = `supabase_db_${config.projectId}`;
    const docker = runExternal(
        'docker',
        ['ps', '--filter', `name=^${containerName}$`, '--format', '{{.Names}}'],
        { cwd: root, timeout: 30000 }
    );
    if (docker.error || docker.status !== 0) {
        warnings.push('Nie można sprawdzić kontenera Dockera; polegam na `supabase status`');
    } else if (!(docker.stdout || '').split(/\r?\n/).includes(containerName)) {
        errors.push(`Nie działa kontener ${containerName} (baza tego projektu)`);
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        info: {
            projectId: config.projectId,
            apiUrl: apiUrl.origin,
            functionsUrl: `${apiUrl.origin}/functions/v1`,
            dbHost: dbUrl.hostname,
            dbPort: Number(dbUrl.port),
            anonKey: json.ANON_KEY || json.PUBLISHABLE_KEY || null,
            serviceRoleKey: json.SERVICE_ROLE_KEY || json.SECRET_KEY || null,
        },
    };
}

/**
 * Lista migracji lokalnych jeszcze nie zastosowanych w lokalnej bazie (tylko odczyt).
 */
function listPendingMigrations(root) {
    const result = runExternal('supabase', ['migration', 'list', '--local', '-o', 'json'], supabaseOptions(root, 60000));
    if (result.error || result.status !== 0) {
        return { ok: false, error: 'Nie udało się odczytać listy migracji (`supabase migration list --local`)', pending: [] };
    }
    const entries = parseMigrationList(result.stdout || '');
    if (!entries) {
        return { ok: false, error: 'Nieoczekiwany format listy migracji', pending: [] };
    }
    const pending = entries.filter((item) => item.local && !item.remote).map((item) => item.local);
    return { ok: true, pending };
}

/**
 * Parsuje wynik `supabase migration list` - zależnie od środowiska CLI zwraca JSON
 * ({"migrations":[{local,remote}]}) albo tabelę Markdown (Local | Remote | Time).
 */
function parseMigrationList(text) {
    const json = parseJsonLoose(text);
    if (json && Array.isArray(json.migrations)) {
        return json.migrations.map((item) => ({
            local: item.local ? String(item.local) : '',
            remote: item.remote ? String(item.remote) : '',
        }));
    }

    const entries = [];
    let sawHeader = false;
    for (const line of text.split(/\r?\n/)) {
        if (/Local\s*\|\s*Remote/i.test(line)) {
            sawHeader = true;
            continue;
        }
        const cells = line.split('|').map((cell) => cell.replace(/[`\s]/g, ''));
        if (cells.length < 3 || !(cells[0] === '' || /^\d{14}$/.test(cells[0]))) {
            continue;
        }
        if (!/^\d{14}$/.test(cells[0]) && !/^\d{14}$/.test(cells[1])) {
            continue;
        }
        entries.push({
            local: /^\d{14}$/.test(cells[0]) ? cells[0] : '',
            remote: /^\d{14}$/.test(cells[1]) ? cells[1] : '',
        });
    }
    return sawHeader ? entries : null;
}

module.exports = {
    REMOTE_ENV_KEYS,
    readLocalConfig,
    isLoopbackHost,
    parseJsonLoose,
    resolveLocalSupabase,
    listPendingMigrations,
    parseMigrationList,
    supabaseOptions,
};
