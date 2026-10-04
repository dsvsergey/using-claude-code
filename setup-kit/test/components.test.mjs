import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENTS } from '../lib/components.mjs';
import { PRESETS } from '../lib/presets.mjs';
import { tmpDir } from './helpers.mjs';

const templatesDir = fileURLToPath(new URL('../templates/', import.meta.url));
const byId = (id) => COMPONENTS.find((c) => c.id === id);

function ctxOf(o = {}) {
  const home = tmpDir();
  const project = tmpDir();
  return {
    home,
    project,
    platform: 'darwin',
    env: {},
    yes: false,
    templatesDir,
    run: { which: (c) => `/bin/${c}`, capture: () => ({ code: 0, stdout: '' }) },
    ...o,
  };
}

test('registry: unique ids, valid presets, bilingual descriptions', () => {
  const ids = COMPONENTS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of COMPONENTS) {
    assert.ok(['user', 'project'].includes(c.scope), c.id);
    assert.ok(c.presets.every((p) => PRESETS.includes(p)), c.id);
    assert.ok(c.desc.uk && c.desc.ru, c.id);
  }
});

test('every component plans without throwing and only references existing templates', () => {
  const ctx = ctxOf();
  for (const c of COMPONENTS) assert.ok(Array.isArray(c.plan(ctx)), c.id);
});

test('user-settings merges deny rules into ~/.claude/settings.json', () => {
  const ctx = ctxOf();
  const [a] = byId('user-settings').plan(ctx);
  assert.equal(a.type, 'json');
  assert.equal(a.target, path.join(ctx.home, '.claude', 'settings.json'));
  assert.ok(a.template.permissions.deny.includes('Read(./.env)'));
  assert.ok(!JSON.stringify(a.template).includes('bypassPermissions'));
});

test('claude-md creates CLAUDE.md and ignores personal files', () => {
  const ctx = ctxOf();
  const [md, gi] = byId('claude-md').plan(ctx);
  assert.equal(md.target, path.join(ctx.project, 'CLAUDE.md'));
  assert.match(md.content, /## Commands/);
  assert.deepEqual(gi, { type: 'lines', target: path.join(ctx.project, '.gitignore'), lines: ['CLAUDE.local.md', '.claude/settings.local.json'] });
});

test('project-settings denies git push; context7 is an http MCP server', () => {
  const ctx = ctxOf();
  assert.ok(byId('project-settings').plan(ctx)[0].template.permissions.deny.includes('Bash(git push:*)'));
  const [mcp] = byId('context7').plan(ctx);
  assert.equal(mcp.target, path.join(ctx.project, '.mcp.json'));
  assert.deepEqual(mcp.template.mcpServers.context7, { type: 'http', url: 'https://mcp.context7.com/mcp' });
});

test('format-hook: skipped without prettier, planned with prettier devDependency', () => {
  const ctx = ctxOf();
  assert.equal(byId('format-hook').plan(ctx)[0].type, 'skip');
  fs.writeFileSync(path.join(ctx.project, 'package.json'), JSON.stringify({ devDependencies: { prettier: '^3' } }));
  const actions = byId('format-hook').plan(ctx);
  assert.deepEqual(actions.map((a) => a.type), ['file', 'json']);
  assert.equal(actions[0].target, path.join(ctx.project, '.claude', 'hooks', 'format.mjs'));
  assert.equal(actions[1].template.hooks.PostToolUse[0].matcher, 'Edit|Write');
});

test('format-hook: broken package.json is treated as no prettier', () => {
  const ctx = ctxOf();
  fs.writeFileSync(path.join(ctx.project, 'package.json'), '{ nope');
  assert.equal(byId('format-hook').plan(ctx)[0].type, 'skip');
});

test('agents and adr copy their templates', () => {
  const ctx = ctxOf();
  assert.deepEqual(
    byId('agents').plan(ctx).map((a) => path.relative(ctx.project, a.target)),
    [path.join('.claude', 'agents', 'code-reviewer.md'), path.join('.claude', 'agents', 'test-writer.md'), path.join('.claude', 'commands', 'review-pr.md')],
  );
  assert.equal(byId('adr').plan(ctx)[0].target, path.join(ctx.project, 'docs', 'adr', '0000-template.md'));
});

test('statusline uses ccstatusline; ccusage needs npx', () => {
  const ctx = ctxOf();
  assert.equal(byId('statusline').plan(ctx)[0].template.statusLine.command, 'npx -y ccstatusline@latest');
  assert.equal(byId('ccusage').plan(ctx)[0].type, 'note');
  assert.equal(byId('ccusage').plan(ctxOf({ run: { which: () => null } }))[0].type, 'fail');
});
