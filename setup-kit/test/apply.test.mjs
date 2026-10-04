import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('parseCli: global by default; --project adds the repo level', () => {
  const o = parseCli(['--with', 'agents, adr', '--dry-run']);
  assert.deepEqual(o.scopes, ['user']);
  assert.deepEqual(o.withIds, ['agents', 'adr']);
  assert.equal(o.dryRun, true);
  assert.deepEqual(parseCli(['--user']).scopes, ['user']);
  assert.deepEqual(parseCli(['--project', '.']).scopes, ['project']);
  assert.deepEqual(parseCli(['--user', '--project', '.']).scopes, ['user', 'project']);
  assert.equal(parseCli(['doctor']).command, 'doctor');
});

test('default run is global only: configures ~/.claude, never touches the current folder', async () => {
  const s = setup();
  assert.equal(await s.go('--preset', 'minimal', '--yes'), 0);
  assert.deepEqual(walk(s.project), []);
  assert.ok(JSON.parse(read(s.home, '.claude', 'settings.json')).permissions.deny.includes('Read(./.env)'));
  assert.ok(s.calls.some((c) => c.cmd === 'claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp'));
  assert.ok(s.lines.some((l) => l.includes('/login')));
  assert.ok(!s.lines.some((l) => l.includes('Закомітьте')));
});

test('full global run installs agents and the CLAUDE.md block into ~/.claude', async () => {
  const s = setup({ present: ['claude', 'npx', 'uv', 'graphify', 'specify', 'engram'], files: { 'home/.claude/CLAUDE.md': '# my rules\n' } });
  assert.equal(await s.go('--preset', 'full', '--yes'), 0);
  assert.deepEqual(walk(s.project), []);
  assert.ok(fs.existsSync(path.join(s.home, '.claude', 'agents', 'code-reviewer.md')));
  assert.ok(fs.existsSync(path.join(s.home, '.claude', 'commands', 'review-pr.md')));
  const md = read(s.home, '.claude', 'CLAUDE.md');
  assert.ok(md.startsWith('# my rules\n\n<!-- setup-kit:start -->'));
  assert.equal(await s.go('--preset', 'full', '--yes'), 0);
  assert.equal(read(s.home, '.claude', 'CLAUDE.md'), md, 'block is added only once');
});

test('--project creates the repo files and leaves home alone', async () => {
  const s = setup();
  assert.equal(await s.go('--project', '.', '--preset', 'minimal', '--yes'), 0);
  for (const f of ['CLAUDE.md', '.gitignore', '.claude/settings.json']) assert.ok(fs.existsSync(path.join(s.project, f)), f);
  assert.ok(!fs.existsSync(path.join(s.project, '.mcp.json')));
  assert.ok(read(s.project, '.gitignore').includes('*.bak-*'));
  assert.ok(!fs.existsSync(path.join(s.home, '.claude')));
  assert.ok(s.lines.some((l) => l.includes('Закомітьте') && l.includes('CLAUDE.md') && l.includes('.claude/')));
  assert.ok(s.lines.some((l) => l.includes('fill in')));
});

test('second run changes nothing (no writes, no backups)', async () => {
  const s = setup();
  await s.go('--user', '--project', '.', '--preset', 'minimal', '--yes');
  const before = walk(s.root);
  assert.equal(await s.go('--user', '--project', '.', '--preset', 'minimal', '--yes'), 0);
  assert.deepEqual(walk(s.root), before);
});

test('existing CLAUDE.md untouched; existing settings merged with backup', async () => {
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
});

test('dry-run writes nothing and runs nothing', async () => {
  const s = setup({ present: ['brew', 'npx'] });
  const before = walk(s.root);
  assert.equal(await s.go('--user', '--project', '.', '--preset', 'full', '--yes', '--dry-run'), 0);
  assert.deepEqual(walk(s.root), before);
  assert.deepEqual(s.calls, []);
  assert.ok(s.lines.some((l) => l.includes('--dry-run')));
});

test('full: a failed component does not stop the others; exit code 1', async () => {
  const s = setup({ present: ['claude', 'npx', 'brew'] });
  assert.equal(await s.go('--user', '--project', '.', '--preset', 'full', '--yes'), 1);
  assert.ok(fs.existsSync(path.join(s.home, '.claude', 'agents', 'code-reviewer.md')));
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

test('no TTY and no preset → global minimal defaults with a notice', async () => {
  const s = setup();
  assert.equal(await s.go(), 0);
  assert.ok(s.lines.some((l) => l.includes('minimal')));
  assert.ok(fs.existsSync(path.join(s.home, '.claude', 'settings.json')));
  assert.ok(!fs.existsSync(path.join(s.home, '.claude', 'agents')));
  assert.deepEqual(walk(s.project), []);
});

test('interactive answers are respected; --without is not asked', async () => {
  const asked = [];
  const ask = async (q, def) => {
    asked.push(q);
    return q.startsWith('adr') ? true : q.startsWith('project-settings') ? false : def;
  };
  const s = setup({ ask });
  assert.equal(await s.go('--project', '.', '--without', 'claude-md'), 0);
  assert.ok(fs.existsSync(path.join(s.project, 'docs', 'adr', '0000-template.md')));
  assert.ok(!fs.existsSync(path.join(s.project, '.claude', 'settings.json')));
  assert.ok(!fs.existsSync(path.join(s.project, 'CLAUDE.md')));
  assert.ok(!asked.some((q) => q.startsWith('claude-md')));
  assert.ok(asked.some((q) => q.startsWith('speckit-init') && q.endsWith('[y/N] ')));
});

test('--lang ru switches output language', async () => {
  const s = setup();
  await s.go('--preset', 'minimal', '--yes', '--lang', 'ru');
  assert.ok(s.lines.some((l) => l.startsWith('Дальше')));
});

test('doctor: global checks by default, repo checks with --project', async () => {
  const s = setup();
  assert.equal(await s.go('doctor'), 1);
  await s.go('--preset', 'minimal', '--yes');
  assert.equal(await s.go('doctor'), 0);
  assert.equal(await s.go('doctor', '--project', '.'), 1, 'repo has no CLAUDE.md yet');
  await s.go('--project', '.', '--preset', 'minimal', '--yes');
  assert.equal(await s.go('doctor', '--project', '.'), 0);
});

test('CLI runs when invoked through a symlinked path (macOS /tmp, OneDrive, junctions)', { skip: process.platform === 'win32' }, () => {
  const link = path.join(tmpDir(), 'kit');
  fs.symlinkSync(fileURLToPath(new URL('..', import.meta.url)), link);
  const r = spawnSync(process.execPath, [path.join(link, 'lib', 'apply.mjs'), '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /setup doctor/);
});
