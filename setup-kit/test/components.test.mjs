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

test('registry order: user components first, then project', () => {
  assert.deepEqual(COMPONENTS.map((c) => c.id), [
    'claude', 'user-settings', 'statusline', 'ccusage', 'engram',
    'claude-md', 'project-settings', 'context7', 'format-hook', 'agents', 'adr', 'serena', 'graphify', 'speckit',
  ]);
});

test('claude: already installed on macOS → skip', () => {
  assert.deepEqual(byId('claude').plan(ctxOf()).map((a) => a.type), ['skip']);
});

test('claude: missing on Unix → official install.sh', () => {
  const [a] = byId('claude').plan(ctxOf({ run: { which: () => null } }));
  assert.equal(a.command, 'curl -fsSL https://claude.ai/install.sh | bash');
  assert.equal(a.confirm, true);
});

test('claude: Windows without .local\\bin in user PATH → install + PATH fix', () => {
  const ctx = ctxOf({ platform: 'win32', home: 'C:\\Users\\Ivan Petrenko', run: { which: () => null, capture: () => ({ code: 0, stdout: 'C:\\Tools;\r\n' }) } });
  const actions = byId('claude').plan(ctx);
  assert.equal(actions.length, 3);
  assert.match(actions[0].command, /irm https:\/\/claude\.ai\/install\.ps1 \| iex/);
  assert.ok(!actions[1].command.includes('Ivan Petrenko'), 'path must not be interpolated');
  assert.equal(actions[2].type, 'note');
});

test('claude: Windows PATH fix keeps %VAR% entries unexpanded (REG_EXPAND_SZ) and avoids cmd %-expansion', () => {
  const ctx = ctxOf({ platform: 'win32', home: 'C:\\Users\\ivan', run: { which: () => 'C:\\x\\claude.exe', capture: () => ({ code: 0, stdout: '' }) } });
  const [fix] = byId('claude').plan(ctx);
  assert.match(fix.command, /DoNotExpandEnvironmentNames/);
  assert.match(fix.command, /-Type ExpandString/);
  assert.ok(!fix.command.includes("SetEnvironmentVariable('Path'"), 'must not round-trip Path through [Environment]');
  assert.ok(!/%\w+%/.test(fix.command), 'cmd.exe would expand %VAR% inside the command string');
});

test('claude: Windows user PATH with unexpanded %USERPROFILE%\\.local\\bin counts as present', () => {
  const ctx = ctxOf({ platform: 'win32', home: 'C:\\Users\\ivan', run: { which: () => 'C:\\x\\claude.exe', capture: () => ({ code: 0, stdout: '%USERPROFILE%\\.local\\bin;C:\\Tools\r\n' }) } });
  assert.deepEqual(byId('claude').plan(ctx).map((a) => a.type), ['skip']);
});

test('claude: Windows with .local\\bin already in user PATH → no PATH fix', () => {
  const ctx = ctxOf({ platform: 'win32', home: 'C:\\Users\\ivan', run: { which: () => 'C:\\x\\claude.exe', capture: () => ({ code: 0, stdout: 'C:\\Users\\ivan\\.local\\bin\;C:\\Tools\r\n' }) } });
  assert.deepEqual(byId('claude').plan(ctx).map((a) => a.type), ['skip']);
});

test('engram: skipped when plugin already enabled', () => {
  const ctx = ctxOf();
  fs.mkdirSync(path.join(ctx.home, '.claude'));
  fs.writeFileSync(path.join(ctx.home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'engram@engram': true } }));
  assert.deepEqual(byId('engram').plan(ctx).map((a) => a.type), ['skip']);
});

test('engram: brew install, then plugin install through claude', () => {
  const ctx = ctxOf({ run: { which: (c) => (c === 'brew' ? '/bin/brew' : null) } });
  const actions = byId('engram').plan(ctx);
  assert.equal(actions[0].command, 'brew install gentleman-programming/tap/engram');
  assert.deepEqual(actions.slice(1, 3).map((a) => [a.type, a.tool]), [['require', 'engram'], ['require', 'claude']]);
  assert.equal(actions[3].command, 'claude plugin marketplace add Gentleman-Programming/engram && claude plugin install engram');
});

test('engram: go fallback; neither brew nor go → fail with install link', () => {
  const go = byId('engram').plan(ctxOf({ run: { which: (c) => (c === 'go' ? '/bin/go' : null) } }));
  assert.equal(go[0].command, 'go install github.com/Gentleman-Programming/engram/v3/cmd/engram@latest');
  const none = byId('engram').plan(ctxOf({ run: { which: () => null } }));
  assert.equal(none[0].type, 'fail');
  assert.match(none[0].reason, /INSTALLATION\.md/);
});

test('serena: requires uv (official installer) and adds the MCP server', () => {
  const ctx = ctxOf();
  const [req, mcp] = byId('serena').plan(ctx);
  assert.deepEqual(req, { type: 'require', tool: 'uv', install: 'curl -LsSf https://astral.sh/uv/install.sh | sh' });
  assert.ok(mcp.template.mcpServers.serena.args.includes('--project-from-cwd'));
  const [winReq] = byId('serena').plan(ctxOf({ platform: 'win32' }));
  assert.match(winReq.install, /irm https:\/\/astral\.sh\/uv\/install\.ps1 \| iex/);
});

test('graphify: installs via uv tool when missing, builds graph in project cwd', () => {
  const ctx = ctxOf({ run: { which: (c) => (c === 'uv' ? '/bin/uv' : null) } });
  const actions = byId('graphify').plan(ctx);
  assert.deepEqual(actions.map((a) => a.command ?? a.type), ['require', 'uv tool install graphifyy', 'graphify install', 'graphify update .']);
  assert.equal(actions[3].cwd, ctx.project);
});

test('speckit: skipped when .specify exists; --force only with --yes', () => {
  const ctx = ctxOf();
  const [, init] = byId('speckit').plan(ctx);
  assert.equal(init.command, 'uvx --from git+https://github.com/github/spec-kit.git specify init --here --integration claude');
  assert.equal(init.cwd, ctx.project);
  assert.match(byId('speckit').plan({ ...ctx, yes: true })[1].command, / --force$/);
  fs.mkdirSync(path.join(ctx.project, '.specify'));
  assert.deepEqual(byId('speckit').plan(ctx).map((a) => a.type), ['skip']);
});
