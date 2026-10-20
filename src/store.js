import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export const home = () => process.env.RESEARCH_COMPANION_HOME || join(homedir(), '.research-companion');
export function bucket(kind) {
  if (!['memory', 'reports', 'experiments'].includes(kind)) throw new Error('Invalid collection');
  const dir = join(home(), kind); mkdirSync(dir, { recursive: true, mode: 0o700 }); return dir;
}
export function save(kind, value) {
  const id = randomUUID();
  const record = { ...value, id, createdAt: new Date().toISOString() };
  writeFileSync(join(bucket(kind), id + '.json'), JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 });
  return record;
}
export function list(kind) {
  return readdirSync(bucket(kind)).filter(x => x.endsWith('.json')).sort().map(x => JSON.parse(readFileSync(join(bucket(kind), x), 'utf8')));
}
export function forget(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid memory ID');
  unlinkSync(join(bucket('memory'), id + '.json')); return { deleted: id };
}
