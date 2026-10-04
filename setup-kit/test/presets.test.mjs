import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSelection, UsageError } from '../lib/presets.mjs';

const C = [
  { id: 'a', scope: 'user', presets: ['minimal', 'full'] },
  { id: 'b', scope: 'project', presets: ['minimal', 'full'] },
  { id: 'c', scope: 'project', presets: ['full'] },
];
const both = ['user', 'project'];

test('minimal preset', () => {
  assert.deepEqual(resolveSelection(C, { preset: 'minimal', scopes: both }), ['a', 'b']);
});

test('full minus --without', () => {
  assert.deepEqual(resolveSelection(C, { preset: 'full', withoutIds: ['a'], scopes: both }), ['b', 'c']);
});

test('minimal plus --with', () => {
  assert.deepEqual(resolveSelection(C, { preset: 'minimal', withIds: ['c'], scopes: both }), ['a', 'b', 'c']);
});

test('scope filter', () => {
  assert.deepEqual(resolveSelection(C, { preset: 'full', scopes: ['project'] }), ['b', 'c']);
});

test('no preset: only --with ids', () => {
  assert.deepEqual(resolveSelection(C, { withIds: ['c'], scopes: both }), ['c']);
});

test('unknown id throws UsageError listing available ids', () => {
  assert.throws(
    () => resolveSelection(C, { preset: 'full', withIds: ['zzz'], scopes: both }),
    (e) => e instanceof UsageError && e.message.includes('zzz') && e.message.includes('a, b, c'),
  );
});

test('unknown preset throws UsageError', () => {
  assert.throws(() => resolveSelection(C, { preset: 'huge', scopes: both }), UsageError);
});
