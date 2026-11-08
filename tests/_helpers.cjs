'use strict';
// Wspólne narzędzia testów konfiguracji Cursor Workflow v2: tymczasowe repo Git z kopią skryptów.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const source = path.resolve(__dirname, '..');
const SCRIPTS = [
    '.cursor/scripts/quality.cjs',
    '.cursor/scripts/workflow.cjs',
    '.cursor/scripts/local-api-smoke.cjs',
    '.cursor/scripts/lib/exec.cjs',
    '.cursor/scripts/lib/local-supabase.cjs',
];
const GIT_ENV = {
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.test',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.test',
};

const NODE_OK = [process.execPath, '-e', 'process.exit(0)'];

function createTempRepo({ commands } = {}) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-workflow-v2-'));
    const spawn = (program, args, extra = {}) =>
        cp.spawnSync(program, args, {
            cwd: temp,
            encoding: 'utf8',
            env: { ...process.env, ...GIT_ENV, ...(extra.env || {}) },
        });

    const repo = {
        temp,
        spawn,
        node: (args, extra) => spawn(process.execPath, args, extra),
        git: (args) => spawn('git', ['-c', 'commit.gpgsign=false', ...args]),
        write(rel, content) {
            const full = path.join(temp, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content);
        },
        read: (rel) => fs.readFileSync(path.join(temp, rel), 'utf8'),
        setCommands(next) {
            repo.write('.cursor/config/quality.json', JSON.stringify({ commands: next, required: {} }, null, 2));
        },
        commitAll(message = 'change') {
            const add = repo.git(['add', '-A']);
            if (add.status !== 0) {
                throw new Error(add.stderr);
            }
            const commit = repo.git(['commit', '-qm', message]);
            if (commit.status !== 0) {
                throw new Error(commit.stderr);
            }
        },
        manifest(id) {
            return JSON.parse(repo.read(`docs/results/workflows/${id}/workflow.json`));
        },
        writeManifest(id, value) {
            repo.write(`docs/results/workflows/${id}/workflow.json`, JSON.stringify(value, null, 2) + '\n');
        },
        cleanup() {
            fs.rmSync(temp, { recursive: true, force: true });
        },
    };

    for (const rel of SCRIPTS) {
        const to = path.join(temp, rel);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(path.join(source, rel), to);
    }
    repo.setCommands(commands || { angularBuild: NODE_OK, vitest: NODE_OK, localApi: [] });
    repo.write('package.json', '{}');
    if (repo.git(['init', '-q', '-b', 'main']).status !== 0) {
        throw new Error('git init nie powiódł się');
    }
    repo.commitAll('initial');
    return repo;
}

module.exports = { createTempRepo, source, NODE_OK };
