import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { runChild } from '../src/subagents.js';

test('real Pi subprocess uses selected model, constrained tools and returns a result', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'companion-live-protocol-'));
  const names = ['PI_CODING_AGENT_DIR', 'RESEARCH_COMPANION_HOME', 'PI_OFFLINE', 'PI_TELEMETRY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body); requests.push(payload);
    const parent = payload.tools?.some(tool => tool.function.name === 'delegate_task');
    const shouldDelegate = parent && !payload.messages.some(message => message.role === 'tool');
    const delta = shouldDelegate ? { role: 'assistant', tool_calls: [{ index: 0, id: 'delegate-1', type: 'function', function: { name: 'delegate_task', arguments: JSON.stringify({ role: 'analyst', task: 'Compare this supplied evidence.', timeoutSeconds: 10 }) } }] } : { role: 'assistant', content: 'Protocol integration verified.' };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: ' + JSON.stringify({ id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [{ index: 0, delta, finish_reason: null }] }) + '\n\n');
    res.end('data: ' + JSON.stringify({ id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [{ index: 0, delta: {}, finish_reason: shouldDelegate ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 } }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    process.env.PI_CODING_AGENT_DIR = join(dir, 'pi'); mkdirSync(process.env.PI_CODING_AGENT_DIR);
    process.env.RESEARCH_COMPANION_HOME = join(dir, 'data'); process.env.PI_OFFLINE = '1'; process.env.PI_TELEMETRY = '0';
    writeFileSync(join(process.env.PI_CODING_AGENT_DIR, 'models.json'), JSON.stringify({ providers: { 'test-provider': {
      api: 'openai-completions', baseUrl: `http://127.0.0.1:${server.address().port}/v1`, apiKey: 'test-only',
      models: ['test-model', 'deep-model', 'code-model'].map(id => ({ id, contextWindow: 32000, maxTokens: 1024, reasoning: false, input: ['text'] })),
    } } }));
    const result = await runChild({ role: 'reviewer', task: 'Review the supplied claim: this is a protocol test.', model: 'test-provider/test-model', timeoutSeconds: 12 });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.output, 'Protocol integration verified.');
    assert.equal(requests[0].model, 'test-model');
    assert.deepEqual(requests[0].tools.map(tool => tool.function.name), ['research_search']);
    assert.ok(result.id);
    writeFileSync(join(process.env.RESEARCH_COMPANION_HOME, 'routing.json'), JSON.stringify({ default: 'test-provider/test-model', deep: 'test-provider/deep-model', code: 'test-provider/code-model' }));
    const parentResult = await new Promise(resolveRun => {
      const proc = spawn(process.execPath, [resolve('src/cli.js'), '--model', 'companion/auto', '--mode', 'json', '-p', '--no-session'], { env: process.env });
      let stdout = '', stderr = '';
      proc.stdout.on('data', chunk => { stdout += chunk; }); proc.stderr.on('data', chunk => { stderr += chunk; });
      const timer = setTimeout(() => proc.kill('SIGKILL'), 15000);
      proc.on('close', code => { clearTimeout(timer); resolveRun({ code, stdout, stderr }); });
      proc.stdin.end('[route:code] Ask an analyst to compare the evidence, then summarize its response.');
    });
    assert.equal(parentResult.code, 0, parentResult.stderr);
    assert.deepEqual(requests.slice(1).map(request => request.model), ['code-model', 'deep-model', 'code-model']);
    const events = parentResult.stdout.trim().split('\n').map(line => JSON.parse(line));
    const toolResult = events.find(event => event.type === 'tool_execution_end' && event.toolName === 'delegate_task');
    assert.equal(toolResult?.result?.details?.ok, true, parentResult.stdout);
    assert.equal(events.filter(event => event.type === 'message_end' && event.message?.role === 'assistant').at(-1).message.stopReason, 'stop');
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
    rmSync(dir, { recursive: true, force: true });
  }
});
