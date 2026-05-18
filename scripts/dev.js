#!/usr/bin/env node
// Lance le dev en parallèle (server nodemon + client vite) sans repasser par
// yarn pour les sous-commandes. Évite les warnings "npm warn Unknown env
// config" provoqués par yarn 1 qui pose des env vars `npm_config_*` legacy
// que npm 11 ne reconnaît plus (version-commit-hooks, argv, etc.).
//
// On strip ces env vars d'abord, puis on spawn directement nodemon/vite via
// leur binaire local. Pas de cross-env ni de dépendance supplémentaire.

const { spawn } = require('node:child_process');
const path = require('node:path');

// Env vars yarn 1 que npm 11 ne reconnaît pas. On les retire du process pour
// que les enfants héritent d'un env propre.
const LEAKED = [
  'npm_config_argv',
  'npm_config_version_commit_hooks',
  'npm_config_version_tag_prefix',
  'npm_config_version_git_message',
  'npm_config_version_git_tag',
];
for (const k of LEAKED) delete process.env[k];

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const ext = isWin ? '.cmd' : '';
const binPath = (pkg, name) => path.join(root, pkg, 'node_modules', '.bin', `${name}${ext}`);

const procs = [
  {
    name: 'server',
    cmd: binPath('server', 'nodemon'),
    args: ['index.js'],
    cwd: path.join(root, 'server'),
    env: { ...process.env, NODE_ENV: 'development' },
  },
  {
    name: 'client',
    cmd: binPath('client', 'vite'),
    args: [],
    cwd: path.join(root, 'client'),
    env: process.env,
  },
];

const colors = { server: '\x1b[36m', client: '\x1b[35m', reset: '\x1b[0m' };
const children = [];
let exiting = false;

function killAll(code) {
  if (exiting) return;
  exiting = true;
  for (const c of children) {
    try { c.kill('SIGTERM'); } catch { /* déjà mort */ }
  }
  setTimeout(() => process.exit(code ?? 0), 200);
}

for (const p of procs) {
  const child = spawn(p.cmd, p.args, {
    cwd: p.cwd,
    env: p.env,
    shell: isWin,
  });
  children.push(child);

  const tag = `${colors[p.name]}[${p.name}]${colors.reset} `;
  // Buffer pour ne pas couper les lignes au milieu (chunks arrivent par pavé).
  const lineWriter = (target) => {
    let pending = '';
    return (chunk) => {
      pending += chunk.toString();
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) target.write(`${tag}${line}\n`);
    };
  };
  child.stdout.on('data', lineWriter(process.stdout));
  child.stderr.on('data', lineWriter(process.stderr));
  child.on('exit', (code) => {
    process.stdout.write(`${tag}exited with code ${code ?? 0}\n`);
    killAll(code ?? 0);
  });
}

process.on('SIGINT', () => killAll(0));
process.on('SIGTERM', () => killAll(0));
