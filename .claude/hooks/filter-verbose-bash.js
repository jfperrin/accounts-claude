#!/usr/bin/env node
// PostToolUse hook : tronque les sorties bash très longues pour économiser des tokens.
// Conservateur — ne se déclenche que si > 300 lignes ; garde head + tail (50 lignes
// chacun) avec un marqueur de troncature au milieu. Les erreurs typiques (premières
// lignes d'un build, résumé final d'un test) restent visibles.
//
// Désactiver : retirer le bloc PostToolUse correspondant dans .claude/settings.json.

const { readFileSync } = require('fs');

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch (_) {
  // Pas de stdin valide → no-op
  process.exit(0);
}

if (input.tool_name !== 'Bash') process.exit(0);

const output = input.tool_response?.output ?? '';
const lines = output.split('\n');
const THRESHOLD = 300;
const KEEP = 50;

if (lines.length <= THRESHOLD) process.exit(0);

const head = lines.slice(0, KEEP);
const tail = lines.slice(-KEEP);
const truncated = lines.length - 2 * KEEP;
const filtered = [
  ...head,
  '',
  `[hook: ${truncated} lignes du milieu tronquées — relancer la commande avec | head/tail/grep si besoin]`,
  '',
  ...tail,
].join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: `(Sortie tronquée par .claude/hooks/filter-verbose-bash.js : ${lines.length} lignes → ${head.length + tail.length} lignes)\n\n${filtered}`,
  },
}));
