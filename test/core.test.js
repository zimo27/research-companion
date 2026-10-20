import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, list, forget, bucket } from '../src/store.js';
import { dockerArgs, experiment } from '../src/experiment.js';
test('personal records persist, separate certainty, and can be forgotten', () => {
  const dir = mkdtempSync(join(tmpdir(), 'research-test-')); const previous = process.env.RESEARCH_COMPANION_HOME;
  process.env.RESEARCH_COMPANION_HOME = dir;
  try {
    const a = save('memory', { text: 'Prefer prototypes', status: 'confirmed' });
    save('memory', { text: 'May prefer Python', status: 'tentative' });
    assert.equal(list('memory').length, 2);
    forget(a.id); assert.equal(list('memory')[0].status, 'tentative');
    assert.throws(() => forget('../../outside'));
    assert.throws(() => bucket('../outside'));
  } finally { rmSync(dir, { recursive: true }); if (previous === undefined) delete process.env.RESEARCH_COMPANION_HOME; else process.env.RESEARCH_COMPANION_HOME = previous; }
});
test('experiment command stays inside offline, bounded container', () => {
  const args = dockerArgs('test', 'python:3.12-alpine', 'echo hello; uname -a');
  assert.equal(args.at(-1), 'echo hello; uname -a');
  assert.equal(args[args.indexOf('--network') + 1], 'none');
  assert.equal(args[args.indexOf('--pull') + 1], 'never');
  assert.ok(args.includes('--read-only')); assert.ok(!args.includes('-v'));
  assert.throws(() => dockerArgs('test', '--privileged', 'true'));
});
test('invalid time budgets are rejected before execution', async () => {
  await assert.rejects(experiment({ hypothesis: 'x', image: 'alpine', command: 'true', timeoutSeconds: 301 }));
});
