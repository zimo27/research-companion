#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { home } from './store.js';
mkdirSync(home(), { recursive: true, mode: 0o700 });
const cli = fileURLToPath(new URL('../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js', import.meta.url));
const extension = fileURLToPath(new URL('./extension.ts', import.meta.url));
const child = spawn(process.execPath, [cli, '--extension', extension, '--no-extensions', '--no-mcp', '--no-skills', '--no-prompt-templates', '--no-context-files', '--tools', 'read,memory_*,research_*,experiment_run', ...process.argv.slice(2)], {
  cwd: home(), stdio: 'inherit', env: process.env,
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
