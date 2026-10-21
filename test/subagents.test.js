import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { childArgs, createLimiter, runChild } from '../src/subagents.js';
const args = { role: 'researcher', task: 'Find primary sources', model: 'local/test', timeoutSeconds: 2 };
const message = (stopReason = 'stop', text = 'Evidence 🙂') => JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text }], stopReason, usage: { input: 2, output: 3, cost: { total: 0.01 } } } });
function fakeSpawn(action) {
  return (_cmd, argv, options) => {
    assert.equal(options.env.RESEARCH_COMPANION_CHILD, '1');
    const child = new EventEmitter();
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { setImmediate(() => child.emit('close', null)); return true; };
    setImmediate(() => action(child, argv));
    return child;
  };
}
const persist = (_kind, record) => record;
test('children cannot delegate, read private files, mutate memory, or execute commands', () => {
  const argv = childArgs('analyst', 'local/test');
  assert.equal(argv[argv.indexOf('--tools') + 1], 'research_search');
  assert.ok(argv.includes('--no-session')); assert.ok(argv.includes('--no-mcp'));
  assert.throws(() => childArgs('constructor', 'local/test'));
});
test('fragmented JSON and unicode output preserve answer and usage', async () => {
  const result = await runChild(args, { persist, spawnProcess: fakeSpawn(child => {
    const bytes = Buffer.from(message() + '\n');
    const split = bytes.indexOf(Buffer.from('🙂')) + 1;
    child.stdout.write(bytes.subarray(0, split)); child.stdout.write(bytes.subarray(split));
    child.emit('close', 0);
  }) });
  assert.equal(result.ok, true); assert.equal(result.output, 'Evidence 🙂');
  assert.equal(result.usage.input, 2); assert.equal(result.usage.cost.total, 0.01);
});
test('zero exit status does not conceal model errors or incomplete answers', async () => {
  for (const reason of ['error', 'aborted', 'length', 'toolUse']) {
    const result = await runChild(args, { persist, spawnProcess: fakeSpawn(child => { child.stdout.write(message(reason)); child.emit('close', 0); }) });
    assert.equal(result.ok, false);
  }
});
test('early process failure preserves diagnostics', async () => {
  const result = await runChild(args, { persist, spawnProcess: fakeSpawn(child => { child.stderr.write('Missing credentials'); child.emit('close', 1); }) });
  assert.match(result.error, /Missing credentials/);
});
test('cancellation stops an active child and prevents pre-aborted startup', async () => {
  const controller = new AbortController();
  const result = await runChild(args, { persist, signal: controller.signal, spawnProcess: fakeSpawn(() => controller.abort()) });
  assert.match(result.error, /cancelled/);
  await assert.rejects(runChild(args, { signal: controller.signal }), /before startup/);
});
test('timeout terminates a stalled child', async () => {
  const result = await runChild({ ...args, timeoutSeconds: 1 }, { persist, spawnProcess: fakeSpawn(() => {}) });
  assert.match(result.error, /timed out/);
});
test('limiter bounds concurrent calls and releases capacity after failures', async () => {
  const limited = createLimiter(1); let release;
  const first = limited(() => new Promise(resolve => { release = resolve; }));
  await assert.rejects(limited(async () => {}), /concurrency/);
  release(); await first;
  await assert.rejects(limited(async () => { throw new Error('fail'); }));
  assert.equal(await limited(async () => 42), 42);
});
