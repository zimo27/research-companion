import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { save } from './store.js';
export function dockerArgs(name, image, command) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9./:@_-]*$/.test(image)) throw new Error('Invalid image');
  return ['run', '--rm', '--name', name, '--network', 'none', '--memory', '512m', '--cpus', '1',
    '--pids-limit', '128', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--read-only', '--user', '65534:65534', '--tmpfs', '/tmp:rw,nosuid,size=64m',
    '--workdir', '/tmp', '--pull', 'never', image, 'sh', '-lc', command];
}
export async function experiment({ hypothesis, image, command, timeoutSeconds = 60 }, signal) {
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 300) throw new Error('Timeout must be 1–300 seconds');
  const name = 'research-' + randomUUID();
  const startedAt = new Date().toISOString();
  return await new Promise((resolve, reject) => {
    let output = '', timedOut = false, aborted = false;
    const child = spawn('docker', dockerArgs(name, image, command));
    const capture = chunk => { output = (output + chunk.toString()).slice(-32000); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    const stop = () => { const cleanup = spawn('docker', ['rm', '-f', name], { stdio: 'ignore' }); cleanup.on('error', () => {}); child.kill('SIGKILL'); };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutSeconds * 1000);
    const abort = () => { aborted = true; stop(); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.on('error', error => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(error); });
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      resolve(save('experiments', { hypothesis, image, command, timeoutSeconds, startedAt,
        finishedAt: new Date().toISOString(), exitCode: code, timedOut, aborted, output }));
    });
  });
}
