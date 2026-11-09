'use strict';
const cp = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

function hook(name, input) {
    const r = cp.spawnSync(process.execPath, [path.join(root, '.cursor/scripts', name)], {
        input: JSON.stringify(input),
        encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
}

const shell = (command) => hook('guard-shell.cjs', { command }).permission;

assert.equal(shell('supabase db push'), 'deny');
assert.equal(shell('supabase db reset'), 'deny');
assert.equal(shell('npx supabase migration up --linked'), 'deny');
assert.equal(shell('supabase migration up --db-url postgres://x'), 'deny');
assert.equal(shell('supabase functions deploy recipes'), 'deny');
assert.equal(shell('firebase deploy'), 'deny');
assert.equal(shell('git push origin main'), 'ask');
assert.equal(shell('supabase migration up --local'), 'ask');

// Operacje bezpieczne, używane przez Quality Gates
assert.equal(shell('node .cursor/scripts/quality.cjs migrate-local LOCAL-ps'), 'allow');
assert.equal(shell('node .cursor/scripts/quality.cjs preflight-local'), 'allow');
assert.equal(shell('node .cursor/scripts/quality.cjs run LOCAL-ps localApi'), 'allow');
assert.equal(shell('node .cursor/scripts/local-api-smoke.cjs'), 'allow');
assert.equal(shell('supabase status -o json'), 'allow');
assert.equal(shell('supabase migration list --local'), 'allow');
assert.equal(shell('npm run build'), 'allow');
assert.equal(shell('npm run test:run'), 'allow');

assert.equal(hook('guard-mcp.cjs', { tool_name: 'run_sql', tool_input: { environment: 'production' } }).permission, 'deny');
console.log('PASS: hook blocking/asking/allowing cases');
