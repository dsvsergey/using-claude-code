import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeJson, parseJson, appendLines, appendBlock } from '../lib/merge.mjs';

test('arrays: union without duplicates, user order first', () => {
  const { result, added } = mergeJson({ permissions: { allow: ['b', 'a'] } }, { permissions: { allow: ['a', 'c'] } });
  assert.deepEqual(result.permissions.allow, ['b', 'a', 'c']);
  assert.equal(added, 1);
});

test('missing keys are added from template', () => {
  const { result } = mergeJson({ model: 'x' }, { permissions: { deny: ['d'] } });
  assert.deepEqual(result, { model: 'x', permissions: { deny: ['d'] } });
});

test('scalars: user value kept and reported', () => {
  const { result, kept } = mergeJson(
    { statusLine: { type: 'command', command: 'mine' } },
    { statusLine: { type: 'command', command: 'npx -y ccstatusline@latest' } },
  );
  assert.equal(result.statusLine.command, 'mine');
  assert.deepEqual(kept, ['statusLine.command']);
});

test('type mismatch: user value kept and reported', () => {
  const { result, kept } = mergeJson({ permissions: { deny: 'oops' } }, { permissions: { deny: ['d'] } });
  assert.equal(result.permissions.deny, 'oops');
  assert.deepEqual(kept, ['permissions.deny']);
});

test('mcpServers: existing server untouched, new server added', () => {
  const user = { mcpServers: { context7: { type: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'] } } };
  const tpl = { mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' }, serena: { command: 'uvx' } } };
  const { result, kept } = mergeJson(user, tpl);
  assert.deepEqual(result.mcpServers.context7, user.mcpServers.context7);
  assert.deepEqual(result.mcpServers.serena, { command: 'uvx' });
  assert.deepEqual(kept, ['mcpServers.context7']);
});

test('hooks: no duplicate when same matcher already has the command', () => {
  const hook = { type: 'command', command: 'fmt' };
  const user = { hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'lint' }, hook] }] } };
  const tpl = { hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [hook] }] } };
  const { result, added } = mergeJson(user, tpl);
  assert.deepEqual(result, user);
  assert.equal(added, 0);
});

test('hooks: command added into existing matcher entry', () => {
  const user = { hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'lint' }] }] } };
  const tpl = { hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'fmt' }] }] } };
  const { result } = mergeJson(user, tpl);
  assert.equal(result.hooks.PostToolUse.length, 1);
  assert.deepEqual(result.hooks.PostToolUse[0].hooks.map((h) => h.command), ['lint', 'fmt']);
});

test('idempotent: merging twice equals merging once', () => {
  const user = { permissions: { allow: ['x'] }, hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'a' }] }] } };
  const tpl = {
    permissions: { allow: ['y'], deny: ['z'] },
    hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'b' }] }] },
    mcpServers: { s: { command: 'c' } },
  };
  const once = mergeJson(user, tpl).result;
  const twice = mergeJson(once, tpl);
  assert.deepEqual(twice.result, once);
  assert.equal(twice.added, 0);
});

test('merge does not mutate inputs', () => {
  const user = { permissions: { allow: ['x'] }, hooks: { PostToolUse: [{ matcher: 'E', hooks: [] }] } };
  const tpl = { permissions: { allow: ['y'] }, hooks: { PostToolUse: [{ matcher: 'E', hooks: [{ type: 'command', command: 'f' }] }] } };
  const u = structuredClone(user);
  const t = structuredClone(tpl);
  mergeJson(user, tpl);
  assert.deepEqual(user, u);
  assert.deepEqual(tpl, t);
});

test('parseJson: broken JSON reports error', () => {
  const r = parseJson('{ "a": 1, }');
  assert.equal(r.ok, false);
  assert.match(r.error, /JSON/);
});

test('parseJson: UTF-8 BOM (Windows editors) is accepted', () => {
  assert.deepEqual(parseJson('﻿{"a":1}'), { ok: true, value: { a: 1 } });
});

test('appendLines: adds only missing lines', () => {
  assert.deepEqual(appendLines('node_modules', ['CLAUDE.local.md', 'node_modules']), {
    text: 'node_modules\nCLAUDE.local.md\n',
    added: 1,
  });
});

test('appendLines: CRLF file recognizes existing lines', () => {
  assert.deepEqual(appendLines('CLAUDE.local.md\r\n', ['CLAUDE.local.md']), { text: 'CLAUDE.local.md\r\n', added: 0 });
});

test('appendLines: empty file', () => {
  assert.deepEqual(appendLines('', ['a', 'b']), { text: 'a\nb\n', added: 2 });
});

test('appendBlock: appended once after a blank line, never duplicated', () => {
  const block = '<!-- setup-kit:start -->\nX\n<!-- setup-kit:end -->\n';
  assert.deepEqual(appendBlock('', 'setup-kit', block), { text: block, added: true });
  const once = appendBlock('# mine\n', 'setup-kit', block);
  assert.deepEqual(once, { text: '# mine\n\n' + block, added: true });
  assert.deepEqual(appendBlock(once.text, 'setup-kit', block), { text: once.text, added: false });
  assert.equal(appendBlock('# mine', 'setup-kit', block).text, '# mine\n\n' + block);
});
