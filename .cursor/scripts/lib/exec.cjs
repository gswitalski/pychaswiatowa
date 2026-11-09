'use strict';
// Uruchamianie zewnętrznych poleceń bez powłoki (shell:false), niezależnie od systemu.
// Naprawa P1: na Windows `npm`/`npx` to skrypty .cmd, których nie wolno uruchamiać bez powłoki,
// a ręczne cytowanie argumentów dla cmd.exe psuło wywołanie (`'"npm"' is not recognized`).
// Dlatego `node`, `npm` i `npx` uruchamiamy przez `process.execPath` + plik CLI,
// a cmd.exe jest tylko awaryjnym fallbackiem z rygorystyczną walidacją argumentów.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const NPM_TOOLS = new Set(['npm', 'npx']);

function findNpmCli(tool) {
    const file = `${tool}-cli.js`;
    const nodeDir = path.dirname(process.execPath);
    const candidates = [
        path.join(nodeDir, 'node_modules', 'npm', 'bin', file),
        path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', file),
    ];
    if (process.env.npm_execpath) {
        candidates.unshift(path.join(path.dirname(process.env.npm_execpath), file));
    }
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function quoteForCmd(arg) {
    if (/[&|<>^%!"\r\n]/.test(arg)) {
        throw new Error(`Argument zawiera znaki niebezpieczne dla cmd.exe: ${arg}`);
    }
    return /\s/.test(arg) ? `"${arg}"` : arg;
}

/**
 * Zamienia polecenie z konfiguracji na parę (plik wykonywalny, argumenty).
 * Zwraca `verbatim: true` tylko dla awaryjnego fallbacku cmd.exe.
 */
function resolveCommand(command, args = []) {
    if (typeof command !== 'string' || command.length === 0) {
        throw new Error('Puste polecenie');
    }
    if (command === 'node') {
        return { file: process.execPath, args, verbatim: false };
    }
    if (NPM_TOOLS.has(command)) {
        const cli = findNpmCli(command);
        if (cli) {
            return { file: process.execPath, args: [cli, ...args], verbatim: false };
        }
        if (process.platform === 'win32') {
            const line = [`${command}.cmd`, ...args.map(quoteForCmd)].join(' ');
            return {
                file: process.env.ComSpec || 'cmd.exe',
                args: ['/d', '/s', '/c', `"${line}"`],
                verbatim: true,
            };
        }
    }
    return { file: command, args, verbatim: false };
}

/**
 * Synchronicznie uruchamia polecenie. Nigdy nie rzuca wyjątku - błędy zwraca w `result.error`.
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?: string, timeout?: number, env?: Record<string,string>, dropEnv?: string[]}} options
 */
function runExternal(command, args = [], options = {}) {
    const { cwd = process.cwd(), timeout = 600000, env = {}, dropEnv = [] } = options;
    const childEnv = { ...process.env, CI: 'true', ...env };
    for (const key of dropEnv) {
        delete childEnv[key];
    }

    let spec;
    try {
        spec = resolveCommand(command, args);
    } catch (error) {
        return { status: null, signal: null, stdout: '', stderr: '', error };
    }

    return cp.spawnSync(spec.file, spec.args, {
        cwd,
        encoding: 'utf8',
        timeout,
        maxBuffer: 20 * 1024 * 1024,
        shell: false,
        windowsHide: true,
        windowsVerbatimArguments: spec.verbatim,
        env: childEnv,
    });
}

module.exports = { resolveCommand, runExternal };
