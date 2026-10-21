import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRouting, classifyTask, targetFor, routeRequest, resolveModel } from '../src/routing.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const registry = { find: (provider, id) => id === 'missing' ? undefined : ({ provider, id, api: id === 'virtual' ? 'pi-virtual' : 'test' }), hasConfiguredAuth: model => model.id !== 'unauthorized' };
const config = { default: 'local/general', fast: 'local/small', deep: 'local/large', code: 'local/coder' };
test('routing uses task type, explicit prefix and conservative long-input tier', () => {
  assert.equal(classifyTask('Find papers on pruning'), 'fast');
  assert.equal(classifyTask('Compare the evidence'), 'deep');
  assert.equal(classifyTask('Run an experiment'), 'code');
  assert.equal(classifyTask('[route:fast] Compare the evidence'), 'fast');
  assert.equal(classifyTask('x'.repeat(1600)), 'deep');
});
test('model resolution is explicit and never falls back to an arbitrary provider', () => {
  assert.equal(targetFor('fast', {}, 'local/current'), 'local/current');
  assert.equal(targetFor('code', { default: 'local/default' }), 'local/default');
  assert.throws(() => targetFor('fast', {}, 'companion/auto'));
  for (const id of ['missing', 'virtual', 'unauthorized']) assert.throws(() => resolveModel('local/' + id, registry));
});
test('router inspects latest user message and keeps continuation/retry sticky', () => {
  const request = { reason: 'user', messages: [{ role: 'user', content: 'debug' }, { role: 'user', content: [{ type: 'text', text: 'Compare results' }] }], thinkingLevel: 'low' };
  const route = routeRequest(request, registry, config);
  assert.equal(route.model.id, 'large');
  assert.equal(route.state.tier, 'deep');
  const previous = { model: { id: 'old' }, thinkingLevel: 'high' };
  assert.equal(routeRequest({ ...request, reason: 'continuation', previous }, registry, config).model.id, 'old');
  assert.equal(routeRequest({ ...request, reason: 'retry', previous, failed: { model: { id: 'failed' } } }, registry, config).model.id, 'failed');
});

test('routing config rejects malformed, unknown and recursive targets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'routing-config-'));
  const previous = process.env.RESEARCH_ROUTING_CONFIG;
  process.env.RESEARCH_ROUTING_CONFIG = join(dir, 'routing.json');
  try {
    assert.throws(() => loadRouting(), /Cannot load/);
    for (const value of ['{', '[]', '{"unknown":"local/model"}', '{"default":"companion/auto"}', '{"fast":3}']) {
      writeFileSync(process.env.RESEARCH_ROUTING_CONFIG, value);
      assert.throws(() => loadRouting());
    }
    writeFileSync(process.env.RESEARCH_ROUTING_CONFIG, '{"default":"local/model"}');
    assert.deepEqual(loadRouting(), { default: 'local/model' });
  } finally {
    if (previous === undefined) delete process.env.RESEARCH_ROUTING_CONFIG; else process.env.RESEARCH_ROUTING_CONFIG = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
