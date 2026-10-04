import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENTS } from '../lib/components.mjs';
import { PRESETS, resolveSelection } from '../lib/presets.mjs';
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

const userMcp = (ctx, servers) => fs.writeFileSync(path.join(ctx.home, '.claude.json'), JSON.stringify({ mcpServers: servers }));

// ── registry ──────────────────────────────────────────────────────────────

test('registry: unique ids, valid presets, bilingual descriptions', () => {
  const ids = COMPONENTS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of COMPONENTS) {
    assert.ok(['user', 'project'].includes(c.scope), c.id);
    assert.ok(c.presets.every((p) => PRESETS.includes(p)), c.id);
    assert.ok(c.desc.uk && c.desc.ru, c.id);
  }
});

test('registry: global components first, repo-only components last', () => {
  const user = ['claude', 'user-settings', 'global-claude-md', 'statusline', 'ccusage', 'engram', 'agents', 'context7', 'serena', 'graphify', 'speckit'];
  const project = ['claude-md', 'project-settings', 'adr', 'format-hook', 'speckit-init'];
  assert.deepEqual(COMPONENTS.map((c) => c.id), [...user, ...project]);
  assert.ok(COMPONENTS.slice(0, user.length).every((c) => c.scope === 'user'));
  assert.ok(COMPONENTS.slice(user.length).every((c) => c.scope === 'project'));
});

test('minimal preset', () => {
  assert.deepEqual(resolveSelection(COMPONENTS, { preset: 'minimal', scopes: ['user'] }), ['claude', 'user-settings', 'context7']);
  assert.deepEqual(resolveSelection(COMPONENTS, { preset: 'minimal', scopes: ['project'] }), ['claude-md', 'project-settings']);
});

test('every component plans without throwing and only references existing templates', () => {
  const ctx = ctxOf();
  for (const c of COMPONENTS) assert.ok(Array.isArray(c.plan(ctx)), c.id);
});

// ── global (user scope) ───────────────────────────────────────────────────

test('user-settings merges deny rules into ~/.claude/settings.json', () => {
  const ctx = ctxOf();
  const [a] = byId('user-settings').plan(ctx);
  assert.equal(a.type, 'json');
  assert.equal(a.target, path.join(ctx.home, '.claude', 'settings.json'));
  assert.ok(a.template.permissions.deny.includes('Read(./.env)'));
  assert.ok(!JSON.stringify(a.template).includes('bypassPermissions'));
});

test('global-claude-md appends a marked block to ~/.claude/CLAUDE.md (full only)', () => {
  const ctx = ctxOf();
  const [a] = byId('global-claude-md').plan(ctx);
  assert.equal(a.type, 'block');
  assert.equal(a.target, path.join(ctx.home, '.claude', 'CLAUDE.md'));
  assert.equal(a.marker, 'setup-kit');
  assert.match(a.content, /^<!-- setup-kit:start -->/);
  assert.match(a.content, /graphify query/);
  assert.deepEqual(byId('global-claude-md').presets, ['full']);
});

test('agents install globally into ~/.claude', () => {
  const ctx = ctxOf();
  assert.deepEqual(
    byId('agents').plan(ctx).map((a) => path.relative(ctx.home, a.target)),
    [path.join('.claude', 'agents', 'code-reviewer.md'), path.join('.claude', 'agents', 'test-writer.md'), path.join('.claude', 'commands', 'review-pr.md')],
  );
});

test('context7: user-scope MCP via claude mcp add; skipped when already registered', () => {
  const ctx = ctxOf();
  const actions = byId('context7').plan(ctx);
  assert.deepEqual(actions[0], { type: 'require', tool: 'claude', hint: 'install the claude component first' });
  assert.equal(actions[1].command, 'claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp');
  userMcp(ctx, { context7: { type: 'http' } });
  assert.deepEqual(byId('context7').plan(ctx).map((a) => a.type), ['skip']);
});

test('serena: requires uv, registers a user-scope MCP that follows the cwd; skipped when registered', () => {
  const ctx = ctxOf();
  const [uv, claude, add] = byId('serena').plan(ctx);
  assert.deepEqual(uv, { type: 'require', tool: 'uv', install: 'curl -LsSf https://astral.sh/uv/install.sh | sh' });
  assert.equal(claude.tool, 'claude');
  assert.equal(
    add.command,
    'claude mcp add --scope user serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project-from-cwd',
  );
  assert.match(byId('serena').plan(ctxOf({ platform: 'win32' }))[0].install, /irm https:\/\/astral\.sh\/uv\/install\.ps1 \| iex/);
  userMcp(ctx, { serena: { command: 'uvx' } });
  assert.deepEqual(byId('serena').plan(ctx).map((a) => a.type), ['skip']);
});

test('graphify: global CLI + skill only, never builds a graph', () => {
  const ctx = ctxOf({ run: { which: (c) => (c === 'uv' ? '/bin/uv' : null) } });
  const actions = byId('graphify').plan(ctx);
  assert.deepEqual(actions.map((a) => a.command ?? a.type), ['require', 'uv tool install graphifyy', 'graphify install']);
  assert.ok(actions.every((a) => !a.cwd));
  const done = ctxOf();
  fs.mkdirSync(path.join(done.home, '.claude', 'skills', 'graphify'), { recursive: true });
  fs.writeFileSync(path.join(done.home, '.claude', 'skills', 'graphify', 'SKILL.md'), '');
  assert.deepEqual(byId('graphify').plan(done).map((a) => a.type), ['skip']);
});

test('speckit: installs the specify CLI globally, skipped when present', () => {
  const ctx = ctxOf({ run: { which: (c) => (c === 'uv' ? '/bin/uv' : null) } });
  assert.deepEqual(byId('speckit').plan(ctx).map((a) => a.command ?? a.type), [
    'require',
    'uv tool install specify-cli --from git+https://github.com/github/spec-kit.git',
  ]);
  assert.deepEqual(byId('speckit').plan(ctxOf()).map((a) => a.type), ['skip']);
});

test('statusline uses ccstatusline; ccusage needs npx', () => {
  const ctx = ctxOf();
  assert.equal(byId('statusline').plan(ctx)[0].template.statusLine.command, 'npx -y ccstatusline@latest');
  assert.equal(byId('ccusage').plan(ctx)[0].type, 'note');
  assert.equal(byId('ccusage').plan(ctxOf({ run: { which: () => null } }))[0].type, 'fail');
});

test('claude: already installed on macOS → skip', () => {
  assert.deepEqual(byId('claude').plan(ctxOf()).map((a) => a.type), ['skip']);
});

test('claude: missing on Unix → official install.sh', () => {
  const [a] = byId('claude').plan(ctxOf({ run: { which: () => null } }));
  assert.equal(a.command, 'curl -fsSL https://claude.ai/install.sh | bash');
  assert.equal(a.confirm, true);
});

test('claude: Windows without .local\\bin in user PATH → install + PATH fix + note', () => {
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
  const ctx = ctxOf({ platform: 'win32', home: 'C:\\Users\\ivan', run: { which: () => 'C:\\x\\claude.exe', capture: () => ({ code: 0, stdout: 'C:\\Users\\ivan\\.local\\bin\\;C:\\Tools\r\n' }) } });
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

// ── repository (project scope) ────────────────────────────────────────────

test('claude-md: skeleton + reminder to fill it in; ignores personal files and backups', () => {
  const ctx = ctxOf();
  const [md, note, gi] = byId('claude-md').plan(ctx);
  assert.equal(md.target, path.join(ctx.project, 'CLAUDE.md'));
  assert.match(md.content, /## Commands/);
  assert.equal(note.type, 'note');
  assert.match(note.text, /CLAUDE\.md/);
  assert.deepEqual(gi, { type: 'lines', target: path.join(ctx.project, '.gitignore'), lines: ['CLAUDE.local.md', '.claude/settings.local.json', '*.bak-*'] });
  fs.writeFileSync(path.join(ctx.project, 'CLAUDE.md'), '# mine\n');
  assert.deepEqual(byId('claude-md').plan(ctx).map((a) => a.type), ['file', 'lines']);
});

test('project-settings denies git push', () => {
  const ctx = ctxOf();
  const [a] = byId('project-settings').plan(ctx);
  assert.equal(a.target, path.join(ctx.project, '.claude', 'settings.json'));
  assert.ok(a.template.permissions.deny.includes('Bash(git push:*)'));
});

test('adr copies the template into the repo', () => {
  const ctx = ctxOf();
  assert.equal(byId('adr').plan(ctx)[0].target, path.join(ctx.project, 'docs', 'adr', '0000-template.md'));
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

test('speckit-init: script type by platform, never --force', () => {
  const ctx = ctxOf({ yes: true });
  const [, init] = byId('speckit-init').plan(ctx);
  assert.equal(init.command, 'uvx --from git+https://github.com/github/spec-kit.git specify init --here --integration claude --script sh');
  assert.equal(init.cwd, ctx.project);
  assert.match(byId('speckit-init').plan(ctxOf({ platform: 'win32' }))[1].command, / --script ps$/);
});

test('speckit-init: skipped when .specify exists, or with --yes in a non-empty repo (it could overwrite files)', () => {
  const ctx = ctxOf();
  fs.writeFileSync(path.join(ctx.project, 'README.md'), 'x');
  assert.equal(byId('speckit-init').plan(ctx)[1].type, 'exec', 'interactive run may proceed: spec-kit asks before merging');
  assert.deepEqual(byId('speckit-init').plan({ ...ctx, yes: true }).map((a) => a.type), ['skip']);
  fs.mkdirSync(path.join(ctx.project, '.specify'));
  assert.deepEqual(byId('speckit-init').plan(ctx).map((a) => a.type), ['skip']);
});
