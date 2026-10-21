import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { home } from './store.js';

export const roles = {
  researcher: { tier: 'fast', tools: ['research_search'], prompt: 'Find relevant primary sources. Return URLs, evidence, dates and gaps. Search snippets are not full-text verification.' },
  analyst: { tier: 'deep', tools: ['research_search'], prompt: 'Compare supplied evidence, distinguish claims from measurements, and propose a falsifiable experiment. Do not claim to execute experiments.' },
  reviewer: { tier: 'deep', tools: ['research_search'], prompt: 'Independently challenge the supplied claims, inspect citations and identify unsupported conclusions and missing controls.' },
};
export function loadRouting() {
  const path = process.env.RESEARCH_ROUTING_CONFIG || join(home(), 'routing.json');
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && !process.env.RESEARCH_ROUTING_CONFIG) return {}; throw new Error(`Cannot load routing config ${path}: ${error.message}`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Routing config must be an object');
  for (const [key, value] of Object.entries(data)) {
    if (!['default', 'fast', 'deep', 'code'].includes(key)) throw new Error(`Unknown routing tier: ${key}`);
    if (typeof value !== 'string' || !/^[^/\s]+\/\S+$/.test(value) || value.startsWith('companion/')) throw new Error(`Tier ${key} requires a physical provider/model ID`);
  }
  return data;
}
export function classifyTask(text) {
  const explicit = text.match(/^\s*\[route:(fast|deep|code)\]/i);
  if (explicit) return explicit[1].toLowerCase();
  if (/\b(code|implement|debug|benchmark|experiment|prototype|test suite)\b/i.test(text)) return 'code';
  if (/\b(compare|analy[sz]e|review|critique|synthesi[sz]e|trade.?offs?|research)\b/i.test(text) || text.length > 1500) return 'deep';
  return 'fast';
}
export function targetFor(tier, config, inherited) {
  const target = config[tier] || config.default || inherited;
  if (!target || target.startsWith('companion/')) throw new Error('Configure a default physical model in ~/.research-companion/routing.json, or select a physical model with /model.');
  return target;
}
export function resolveModel(target, registry) {
  const slash = target.indexOf('/');
  const model = registry.find(target.slice(0, slash), target.slice(slash + 1));
  if (!model || model.api === 'pi-virtual') throw new Error(`Unknown physical model: ${target}`);
  if (!registry.hasConfiguredAuth(model)) throw new Error(`No configured credentials for ${target}; use /login or the provider environment variable.`);
  return model;
}
export function routeRequest(request, registry, config) {
  const sticky = request.reason === 'retry' ? (request.failed || request.previous) : request.previous;
  if (request.reason !== 'user' && sticky) return { model: sticky.model, thinkingLevel: sticky.thinkingLevel || 'off', state: request.state };
  const user = [...request.messages].reverse().find(message => message.role === 'user');
  const content = typeof user?.content === 'string' ? user.content : (user?.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
  const tier = request.reason === 'direct' ? 'fast' : classifyTask(content);
  const target = targetFor(tier, config);
  return { model: resolveModel(target, registry), thinkingLevel: request.thinkingLevel, state: { tier, target } };
}
