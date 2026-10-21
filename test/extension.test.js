import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DefaultResourceLoader } from '@earendil-works/pi-coding-agent';
test('Pi loads the extension and registers every workflow tool', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'research-extension-'));
  try {
    const loader = new DefaultResourceLoader({ cwd: dir, agentDir: dir,
      noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      additionalExtensionPaths: [resolve('src/extension.ts')] });
    await loader.reload();
    const loaded = loader.getExtensions();
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.extensions.length, 1);
    const names = [...loaded.extensions[0].tools.keys()];
    assert.deepEqual(names.sort(), ['delegate_task', 'experiment_run', 'memory_forget', 'memory_list', 'memory_save', 'research_history', 'research_report', 'research_search']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
