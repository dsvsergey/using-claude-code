import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runDoctor } from '../lib/doctor.mjs';
import { tmpDir, walk } from './helpers.mjs';

function setup({ userSettings, mcp, claudeMd = true }) {
  const home = tmpDir();
  const project = tmpDir();
  if (userSettings !== undefined) {
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), userSettings);
  }
  if (mcp !== undefined) fs.writeFileSync(path.join(project, '.mcp.json'), mcp);
  if (claudeMd) fs.writeFileSync(path.join(project, 'CLAUDE.md'), '# x\n');
  return { home, project };
}

test('healthy setup: all checks pass, nothing written', () => {
  const s = setup({
    userSettings: JSON.stringify({ permissions: { deny: ['Read(./.env)'] } }),
    mcp: JSON.stringify({ mcpServers: { serena: { command: 'uvx' }, context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } } }),
  });
  const before = [...walk(s.home), ...walk(s.project)];
  const checks = runDoctor({ ...s, run: { which: (c) => `/bin/${c}` } });
  assert.ok(checks.every((c) => c.ok), JSON.stringify(checks.filter((c) => !c.ok)));
  assert.ok(checks.some((c) => c.label === 'MCP serena: uvx in PATH'));
  assert.deepEqual([...walk(s.home), ...walk(s.project)], before);
});

test('problems are reported', () => {
  const s = setup({ userSettings: '{ broken', mcp: JSON.stringify({ mcpServers: { serena: { command: 'uvx' } } }), claudeMd: false });
  const failed = runDoctor({ ...s, run: { which: () => null } }).filter((c) => !c.ok).map((c) => c.label);
  assert.ok(failed.includes('claude in PATH'));
  assert.ok(failed.some((l) => l.startsWith('valid JSON:') && l.endsWith('settings.json')));
  assert.ok(failed.includes('Read(./.env) in permissions.deny'));
  assert.ok(failed.includes('CLAUDE.md in project'));
  assert.ok(failed.includes('MCP serena: uvx in PATH'));
});
