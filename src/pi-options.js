import { fileURLToPath } from 'node:url';
export const piCli = fileURLToPath(new URL('../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js', import.meta.url));
export const extension = fileURLToPath(new URL('./extension.ts', import.meta.url));
export const isolatedFlags = ['--no-extensions', '--no-mcp', '--no-skills', '--no-prompt-templates', '--no-context-files'];
