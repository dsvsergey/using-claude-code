import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { executeActions, diffLines, timestamp } from '../lib/fsops.mjs';
import { tmpDir, fixedNow } from './helpers.mjs';

const ctxOf = (o = {}) => ({
  dryRun: false,
  yes: true,
  now: fixedNow,
  confirm: async () => true,
  run: { which: () => '/bin/x', exec: () => 0 },
  ...o,
});

test('timestamp format', () => {
  assert.equal(timestamp(fixedNow()), '20261004-120000');
});

test('diffLines marks added and removed lines', () => {
  assert.equal(diffLines('a\nb\n', 'a\nc\n'), '- b\n+ c');
});

test('file: created when missing (with parent dirs), skipped when exists', async () => {
  const d = tmpDir();
  const f = path.join(d, 'sub', 'A.md');
  assert.deepEqual(await executeActions([{ type: 'file', target: f, content: 'hi' }], ctxOf()), [
    { status: 'created', target: f, detail: '' },
  ]);
  fs.writeFileSync(f, 'mine');
  const r = await executeActions([{ type: 'file', target: f, content: 'hi' }], ctxOf());
  assert.deepEqual(r, [{ status: 'skipped', target: f, detail: 'exists' }]);
  assert.equal(fs.readFileSync(f, 'utf8'), 'mine');
});

test('json: merge writes backup; semantically identical result is unchanged, no backup', async () => {
  const d = tmpDir();
  const f = path.join(d, 's.json');
  fs.writeFileSync(f, JSON.stringify({ permissions: { allow: ['x'] } }));
  const a = { type: 'json', target: f, template: { permissions: { allow: ['y'] } } };

  const r1 = await executeActions([a], ctxOf());
  assert.deepEqual(r1, [{ status: 'merged', target: f, detail: '+1' }]);
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')).permissions.allow, ['x', 'y']);
  const bak = `${f}.bak-20261004-120000`;
  assert.ok(fs.existsSync(bak));
  fs.rmSync(bak);

  const r2 = await executeActions([a], ctxOf());
  assert.deepEqual(r2, [{ status: 'unchanged', target: f, detail: '' }]);
  assert.deepEqual(fs.readdirSync(d), ['s.json']);
});

test('json: created when missing', async () => {
  const d = tmpDir();
  const f = path.join(d, '.claude', 'settings.json');
  const r = await executeActions([{ type: 'json', target: f, template: { a: 1 } }], ctxOf());
  assert.deepEqual(r, [{ status: 'created', target: f, detail: '' }]);
  assert.equal(fs.readFileSync(f, 'utf8'), '{\n  "a": 1\n}\n');
});

test('json: kept user values are reported', async () => {
  const d = tmpDir();
  const f = path.join(d, 's.json');
  fs.writeFileSync(f, JSON.stringify({ statusLine: { command: 'mine' } }));
  const r = await executeActions([{ type: 'json', target: f, template: { statusLine: { command: 'tpl' } } }], ctxOf());
  assert.deepEqual(r, [
    { status: 'unchanged', target: f, detail: '' },
    { status: 'kept', target: f, detail: 'statusLine.command' },
  ]);
});

test('json: broken file left alone, failed', async () => {
  const d = tmpDir();
  const f = path.join(d, 's.json');
  fs.writeFileSync(f, '{ broken');
  const r = await executeActions([{ type: 'json', target: f, template: { a: 1 } }], ctxOf());
  assert.equal(r[0].status, 'failed');
  assert.equal(fs.readFileSync(f, 'utf8'), '{ broken');
});

test('lines: creates or appends missing lines', async () => {
  const d = tmpDir();
  const f = path.join(d, '.gitignore');
  const a = { type: 'lines', target: f, lines: ['CLAUDE.local.md'] };
  assert.equal((await executeActions([a], ctxOf()))[0].status, 'created');
  assert.equal((await executeActions([a], ctxOf()))[0].status, 'unchanged');
  fs.writeFileSync(f, 'node_modules\n');
  assert.deepEqual(await executeActions([a], ctxOf()), [{ status: 'merged', target: f, detail: '+1' }]);
  assert.equal(fs.readFileSync(f, 'utf8'), 'node_modules\nCLAUDE.local.md\n');
});

test('dry-run: nothing written or executed, diff returned', async () => {
  const d = tmpDir();
  const f = path.join(d, 's.json');
  fs.writeFileSync(f, '{"a":1}\n');
  const ctx = ctxOf({ dryRun: true, run: { which: () => null, exec: () => { throw new Error('must not run'); } } });
  const r = await executeActions(
    [
      { type: 'json', target: f, template: { b: 2 } },
      { type: 'file', target: path.join(d, 'N.md'), content: 'x' },
      { type: 'exec', label: 'install', command: 'echo hi' },
      { type: 'require', tool: 'uv', install: 'curl uv' },
      { type: 'require', tool: 'claude' },
    ],
    ctx,
  );
  assert.deepEqual(r.map((e) => e.status), ['would', 'would', 'would', 'would', 'would']);
  assert.match(r[0].diff, /\+ {3}"b": 2/);
  assert.equal(fs.readFileSync(f, 'utf8'), '{"a":1}\n');
  assert.deepEqual(fs.readdirSync(d), ['s.json']);
});

test('exec: declined confirmation is skipped', async () => {
  const r = await executeActions(
    [{ type: 'exec', label: 'install x', command: 'x', confirm: true }],
    ctxOf({ yes: false, confirm: async () => false }),
  );
  assert.deepEqual(r, [{ status: 'skipped', target: 'install x', detail: 'declined' }]);
});

test('exec: --yes skips confirmation and passes cwd', async () => {
  const calls = [];
  const r = await executeActions(
    [{ type: 'exec', label: 'gen', command: 'graphify update .', cwd: '/p', confirm: true }],
    ctxOf({ confirm: async () => { throw new Error('must not ask'); }, run: { which: () => null, exec: (c, o) => { calls.push([c, o.cwd]); return 0; } } }),
  );
  assert.deepEqual(r, [{ status: 'ran', target: 'gen', detail: '' }]);
  assert.deepEqual(calls, [['graphify update .', '/p']]);
});

test('exec: non-zero exit fails and stops remaining actions', async () => {
  const d = tmpDir();
  const r = await executeActions(
    [{ type: 'exec', label: 'boom', command: 'x' }, { type: 'file', target: path.join(d, 'A.md'), content: 'a' }],
    ctxOf({ run: { which: () => null, exec: () => 3 } }),
  );
  assert.deepEqual(r, [{ status: 'failed', target: 'boom', detail: 'exit 3' }]);
  assert.ok(!fs.existsSync(path.join(d, 'A.md')));
});

test('require: present tool emits nothing', async () => {
  assert.deepEqual(await executeActions([{ type: 'require', tool: 'uv', install: 'curl uv' }], ctxOf()), []);
});

test('require: installs, rechecks, still missing → failed and stops', async () => {
  const calls = [];
  const r = await executeActions(
    [{ type: 'require', tool: 'uv', install: 'curl uv' }, { type: 'exec', label: 'after', command: 'y' }],
    ctxOf({ run: { which: () => null, exec: (c) => { calls.push(c); return 0; } } }),
  );
  assert.deepEqual(calls, ['curl uv']);
  assert.deepEqual(r, [
    { status: 'ran', target: 'install uv', detail: '' },
    { status: 'failed', target: 'uv', detail: 'not found after install' },
  ]);
});

test('require: no installer → failed with hint', async () => {
  const r = await executeActions([{ type: 'require', tool: 'claude', hint: 'install claude first' }], ctxOf({ run: { which: () => null } }));
  assert.deepEqual(r, [{ status: 'failed', target: 'claude', detail: 'install claude first' }]);
});

test('skip / fail / note actions', async () => {
  const r = await executeActions(
    [{ type: 'skip', target: 'x', reason: 'r' }, { type: 'note', text: 'hello' }, { type: 'fail', target: 'y', reason: 'bad' }],
    ctxOf(),
  );
  assert.deepEqual(r, [
    { status: 'skipped', target: 'x', detail: 'r' },
    { status: 'note', target: 'hello', detail: '' },
    { status: 'failed', target: 'y', detail: 'bad' },
  ]);
});

test('json: two merges into one file in the same run keep the original bytes in the backup', async () => {
  const d = tmpDir();
  const f = path.join(d, 's.json');
  fs.writeFileSync(f, '{"model":"opus"}');
  const ctx = ctxOf();
  await executeActions([{ type: 'json', target: f, template: { a: 1 } }], ctx);
  await executeActions([{ type: 'json', target: f, template: { b: 2 } }], ctx);
  assert.equal(fs.readFileSync(`${f}.bak-20261004-120000`, 'utf8'), '{"model":"opus"}');
});
