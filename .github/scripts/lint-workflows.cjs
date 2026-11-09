#!/usr/bin/env node
'use strict';

/**
 * Statyczna kontrola polityki workflow GitHub Actions (bez zależności od parsera YAML).
 *
 * Sprawdza reguły, których naruszenie wprost osłabia bezpieczeństwo CI/CD:
 *  - akcje przypięte do pełnego SHA commita (nie do tagu ani brancha),
 *  - brak `latest` w wersjach narzędzi,
 *  - brak `pull_request_target`,
 *  - jawne `permissions:` na poziomie workflow,
 *  - `ci.yml` nie używa żadnych sekretów,
 *  - `main-deploy.yml` uruchamia się wyłącznie z `workflow_dispatch` (+ `workflow_call` zabronione),
 *  - sekrety i dane od użytkownika nie są interpolowane w skryptach `run:`.
 *
 * To kontrola uzupełniająca. Nie zastępuje przeglądu ani parsera YAML.
 *
 * Użycie: node .github/scripts/lint-workflows.cjs [katalog]
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DIR = '.github/workflows';
const PINNED_USES = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const DEPLOY_WORKFLOW = 'main-deploy.yml';
const CI_WORKFLOW = 'ci.yml';
const DEPLOY_ALLOWED_TRIGGERS = new Set(['workflow_dispatch']);
const FORBIDDEN_EVERYWHERE = ['pull_request_target'];

const UNTRUSTED_EXPRESSION =
    /\$\{\{\s*(secrets\.|inputs\.|github\.event\.|github\.head_ref|github\.ref_name)/;
const SAFE_MAPPING_LINE = /^\s*[A-Za-z_][\w-]*:\s*\$\{\{[^}]+\}\}\s*$/;
const SAFE_KEY_LINE = /^\s*(if|group|name|cancel-in-progress|ref):/;

function stripComment(line) {
    const index = line.indexOf(' #');
    if (line.trimStart().startsWith('#')) {
        return '';
    }
    return index === -1 ? line : line.slice(0, index);
}

function extractTriggers(lines) {
    const start = lines.findIndex((line) => /^on:\s*$/.test(line));
    if (start === -1) {
        const inline = lines.find((line) => /^on:\s*\S/.test(line));
        return inline ? { inline: true, triggers: new Set() } : null;
    }

    const triggers = new Set();
    for (let index = start + 1; index < lines.length; index++) {
        const line = lines[index];
        if (/^\S/.test(line) && line.trim() !== '') {
            break;
        }
        const match = /^ {2}([A-Za-z_]+):/.exec(line);
        if (match) {
            triggers.add(match[1]);
        }
    }
    return { inline: false, triggers };
}

function lintWorkflow(fileName, content) {
    const errors = [];
    const lines = content.split(/\r?\n/).map(stripComment);
    const report = (lineNumber, message) =>
        errors.push(`${fileName}${lineNumber ? `:${lineNumber}` : ''} ${message}`);

    if (!lines.some((line) => /^permissions:/.test(line))) {
        report(0, 'brak jawnego bloku `permissions:` na poziomie workflow.');
    }

    const onBlock = extractTriggers(lines);
    if (!onBlock || onBlock.inline) {
        report(0, 'sekcja `on:` musi być zapisana w formie blokowej, aby dało się ją zweryfikować.');
    }

    lines.forEach((line, index) => {
        const lineNumber = index + 1;

        const usesMatch = /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(line);
        if (usesMatch) {
            const target = usesMatch[1].replace(/^['"]|['"]$/g, '');
            const isLocal = target.startsWith('./');
            if (!isLocal && !PINNED_USES.test(target)) {
                report(lineNumber, `akcja \`${target}\` musi być przypięta do pełnego SHA (40 znaków).`);
            }
        }

        if (/\blatest\b/.test(line)) {
            report(lineNumber, 'niedozwolone użycie `latest` (przypnij konkretną wersję).');
        }

        for (const forbidden of FORBIDDEN_EVERYWHERE) {
            if (line.includes(forbidden)) {
                report(lineNumber, `niedozwolony wyzwalacz/konstrukcja \`${forbidden}\`.`);
            }
        }

        if (
            UNTRUSTED_EXPRESSION.test(line) &&
            !SAFE_MAPPING_LINE.test(line) &&
            !SAFE_KEY_LINE.test(line)
        ) {
            report(
                lineNumber,
                'sekret lub dane wejściowe zinterpolowane poza mapowaniem `klucz: ${{ ... }}`. ' +
                    'Przekaż je przez `env:` i użyj zmiennej powłoki.',
            );
        }
    });

    if (fileName === CI_WORKFLOW) {
        lines.forEach((line, index) => {
            if (/\bsecrets\./.test(line) || /\bsecrets:\s*inherit\b/.test(line)) {
                report(index + 1, 'ci.yml nie może używać sekretów.');
            }
        });
    }

    if (fileName === DEPLOY_WORKFLOW && onBlock && !onBlock.inline) {
        for (const trigger of onBlock.triggers) {
            if (!DEPLOY_ALLOWED_TRIGGERS.has(trigger)) {
                report(0, `wdrożenie produkcyjne nie może mieć wyzwalacza \`${trigger}\`.`);
            }
        }
        for (const required of DEPLOY_ALLOWED_TRIGGERS) {
            if (!onBlock.triggers.has(required)) {
                report(0, `brak wymaganego wyzwalacza \`${required}\`.`);
            }
        }
        if (!lines.some((line) => /^concurrency:/.test(line))) {
            report(0, 'wdrożenie produkcyjne wymaga bloku `concurrency:`.');
        }
    }

    return errors;
}

function main() {
    const directory = process.argv[2] ?? DEFAULT_DIR;

    if (!fs.existsSync(directory)) {
        console.error(`::error::Katalog ${directory} nie istnieje.`);
        process.exit(1);
    }

    const files = fs
        .readdirSync(directory)
        .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
        .sort();

    if (!files.includes(CI_WORKFLOW) || !files.includes(DEPLOY_WORKFLOW)) {
        console.error(`::error::Wymagane pliki ${CI_WORKFLOW} oraz ${DEPLOY_WORKFLOW} nie istnieją w ${directory}.`);
        process.exit(1);
    }

    const allErrors = files.flatMap((name) =>
        lintWorkflow(name, fs.readFileSync(path.join(directory, name), 'utf8')),
    );

    for (const error of allErrors) {
        console.error(`::error::${error}`);
    }

    if (allErrors.length > 0) {
        console.error(`Lint workflow: ${allErrors.length} naruszeń.`);
        process.exit(1);
    }

    console.log(`Lint workflow: OK (${files.length} plików: ${files.join(', ')}).`);
}

if (require.main === module) {
    main();
}

module.exports = { lintWorkflow, extractTriggers };
