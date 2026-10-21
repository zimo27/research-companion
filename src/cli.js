#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { piCli, extension, isolatedFlags } from './pi-options.js';
import { home } from './store.js';
mkdirSync(home(), { recursive: true, mode: 0o700 });
const child = spawn(process.execPath, [piCli, '--extension', extension, ...isolatedFlags, '--tools', 'read,memory_*,research_*,experiment_run,delegate_task', ...process.argv.slice(2)], {
  cwd: home(), stdio: 'inherit', env: process.env,
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
