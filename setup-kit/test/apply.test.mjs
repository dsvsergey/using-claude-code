import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { main, parseCli } from '../lib/apply.mjs';
import { tmpDir, fixedNow, walk } from './helpers.mjs';

function setup({ present = ['claude', 'npx', 'uv', 'graphify'], files = {}, ask = async () => null, lang = 'uk_UA.UTF-8' } = {}) {
  const root = tmpDir();
  const home = path.join(root, 'home');
  const project = path.join(root, 'proj');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  for (const [rel, content] of Object.entries(files)) {
    const f = path.join(root, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
  }
  const calls = [];
  const lines = [];
  const run = {
    which: (c) => (present.includes(c) ? `/bin/${c}` : null),
    exec: (cmd, o = {}) => { calls.push({ cmd, cwd: o.cwd }); return 0; },
    capture: () => ({ code: 0, stdout: '' }),
  };
  const go = (...argv) =>
    main(argv, { env: { LANG: lang }, home, cwd: project, run, platform: 'darwin', ask, stdout: (s) => lines.push(s), now: fixedNow });
  return { root, home, project, calls, lines, go };
}

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

test('parseCli: defaults and lists', () => {
  const o = parseCli(['--with', 'agents, adr', '--dry-run']);
  assert.deepEqual(o.scopes, ['user', 'project']);
  assert.deepEqual(o.withIds, ['agents', 'adr']);
  assert.equal(o.dryRun, true);
  assert.deepEqual(parseCli(['--user']).scopes, ['user']);
  assert.deepEqual(parseCli(['--project', '.']).scopes, ['project']);
  assert.equal(parseCli(['doctor']).command, 'doctor');
});

test('minimal on an empty project creates the base files', async () => {
  const s = setup();
  assert.equal(await s.go('--preset', 'minimal', '--yes'), 0);
  for (const f of ['CLAUDE.md', '.gitignore', '.claude/settings.json', '.mcp.json']) {
    assert.ok(fs.existsSync(path.join(s.project, f)), f);
  }
  assert.ok(JSON.parse(read(s.home, '.claude', 'settings.json')).permissions.deny.includes('Read(./.env)'));
  assert.equal(JSON.parse(read(s.project, '.mcp.json')).mcpServers.context7.type, 'http');
  assert.ok(!fs.existsSync(path.join(s.project, '.claude', 'agents')));
  assert.ok(s.lines.some((l) => l.includes('/login')));
  assert.ok(s.lines.some((l) => l.includes('Закомітьте') && l.includes('CLAUDE.md') && l.includes('.claude/')));
});

test('second run changes nothing (no writes, no backups)', async () => {
  const s = setup();
  await s.go('--preset', 'minimal', '--yes');
  const before = walk(s.root);
  assert.equal(await s.go('--preset', 'minimal', '--yes'), 0);
  assert.deepEqual(walk(s.root), before);
});

test('existing CLAUDE.md untouched; existing settings merged with backup; --project leaves home alone', async () => {
  const s = setup({
    files: {
      'proj/CLAUDE.md': '# mine\n',
      'proj/.claude/settings.json': JSON.stringify({ permissions: { allow: ['Bash(make:*)'] } }),
    },
  });
  assert.equal(await s.go('--project', '.', '--preset', 'minimal', '--yes'), 0);
  assert.equal(read(s.project, 'CLAUDE.md'), '# mine\n');
  const ps = JSON.parse(read(s.project, '.claude', 'settings.json'));
  assert.deepEqual(ps.permissions.allow.slice(0, 2), ['Bash(make:*)', 'Bash(git status)']);
  assert.ok(fs.existsSync(path.join(s.project, '.claude', 'settings.json.bak-20261004-120000')));
  assert.ok(!fs.existsSync(path.join(s.home, '.claude')));
});

test('dry-run writes nothing and runs nothing', async () => {
  const s = setup({ present: ['brew', 'npx'] });
  const before = walk(s.root);
  assert.equal(await s.go('--preset', 'full', '--yes', '--dry-run'), 0);
  assert.deepEqual(walk(s.root), before);
  assert.deepEqual(s.calls, []);
  assert.ok(s.lines.some((l) => l.includes('--dry-run')));
});

test('full: a failed component does not stop the others; exit code 1', async () => {
  const s = setup({ present: ['claude', 'npx', 'brew'] });
  assert.equal(await s.go('--preset', 'full', '--yes'), 1);
  assert.ok(fs.existsSync(path.join(s.project, '.claude', 'agents', 'code-reviewer.md')));
  assert.ok(fs.existsSync(path.join(s.project, 'docs', 'adr', '0000-template.md')));
  assert.ok(s.calls.some((c) => c.cmd.includes('astral.sh/uv')));
  assert.ok(s.lines.some((l) => l.startsWith('✗') && l.includes('uv')));
});

test('unknown component → exit 2 with the list of ids', async () => {
  const s = setup();
  assert.equal(await s.go('--with', 'nope', '--yes'), 2);
  assert.ok(s.lines.join('\n').includes('context7'));
});

test('unknown flag → exit 2', async () => {
  const s = setup();
  assert.equal(await s.go('--bogus'), 2);
});

test('missing project dir → exit 2, nothing created', async () => {
  const s = setup();
  assert.equal(await s.go('--project', 'does-not-exist', '--yes'), 2);
  assert.ok(!fs.existsSync(path.join(s.project, 'does-not-exist')));
  assert.ok(s.lines.some((l) => l.includes('does-not-exist')));
});

test('no TTY and no preset → minimal defaults with a notice', async () => {
  const s = setup();
  assert.equal(await s.go(), 0);
  assert.ok(s.lines.some((l) => l.includes('minimal')));
  assert.ok(fs.existsSync(path.join(s.project, 'CLAUDE.md')));
  assert.ok(!fs.existsSync(path.join(s.project, '.claude', 'agents')));
});

test('interactive answers are respected; --without is not asked', async () => {
  const asked = [];
  const ask = async (q, def) => {
    asked.push(q);
    return q.startsWith('agents') ? true : q.startsWith('context7') ? false : def;
  };
  const s = setup({ ask });
  assert.equal(await s.go('--project', '.', '--without', 'claude-md'), 0);
  assert.ok(fs.existsSync(path.join(s.project, '.claude', 'agents', 'test-writer.md')));
  assert.ok(!fs.existsSync(path.join(s.project, '.mcp.json')));
  assert.ok(!fs.existsSync(path.join(s.project, 'CLAUDE.md')));
  assert.ok(!asked.some((q) => q.startsWith('claude-md')));
  assert.ok(asked.some((q) => q.startsWith('serena') && q.endsWith('[y/N] ')));
});

test('--lang ru switches output language', async () => {
  const s = setup();
  await s.go('--preset', 'minimal', '--yes', '--lang', 'ru');
  assert.ok(s.lines.some((l) => l.startsWith('Дальше')));
});

test('doctor command: exit 1 on a fresh project, 0 after minimal', async () => {
  const s = setup();
  assert.equal(await s.go('doctor'), 1);
  await s.go('--preset', 'minimal', '--yes');
  assert.equal(await s.go('doctor'), 0);
});
