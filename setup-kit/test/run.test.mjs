import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRunner } from '../lib/run.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'setupkit-run-'));

test('which: finds a file on PATH, null otherwise', () => {
  const bin = tmp();
  fs.writeFileSync(path.join(bin, 'mytool'), '');
  const run = createRunner({ env: { PATH: bin }, platform: 'linux', home: tmp() });
  assert.equal(run.which('mytool'), path.join(bin, 'mytool'));
  assert.equal(run.which('nope'), null);
});

test('which: finds fresh installs in ~/.local/bin even if not on PATH', () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, '.local', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(home, '.local', 'bin', 'uv'), '');
  const run = createRunner({ env: { PATH: '' }, platform: 'linux', home });
  assert.equal(run.which('uv'), path.join(home, '.local', 'bin', 'uv'));
});

test('which: Windows PATHEXT and Path key', () => {
  const bin = tmp();
  fs.writeFileSync(path.join(bin, 'claude.exe'), '');
  const run = createRunner({ env: { Path: bin, PATHEXT: '.EXE;.CMD' }, platform: 'win32', home: tmp() });
  assert.equal(run.which('claude'), path.join(bin, 'claude.exe'));
});

test('exec returns exit code; capture returns stdout', { skip: process.platform === 'win32' }, () => {
  const run = createRunner({ env: process.env, platform: process.platform, home: os.homedir() });
  assert.equal(run.exec('exit 3'), 3);
  assert.equal(run.capture('echo hi').stdout.trim(), 'hi');
});

test('exec honors cwd', { skip: process.platform === 'win32' }, () => {
  const dir = tmp();
  const run = createRunner({ env: process.env, platform: process.platform, home: os.homedir() });
  assert.equal(run.exec('touch marker', { cwd: dir }), 0);
  assert.ok(fs.existsSync(path.join(dir, 'marker')));
});
