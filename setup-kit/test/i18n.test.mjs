import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLang, t } from '../lib/i18n.mjs';

test('detectLang: env first, then Intl locale, default uk', () => {
  assert.equal(detectLang({ LANG: 'ru_RU.UTF-8' }), 'ru');
  assert.equal(detectLang({ LANG: 'uk_UA.UTF-8' }, 'ru-RU'), 'uk');
  assert.equal(detectLang({}, 'ru-RU'), 'ru');
  assert.equal(detectLang({}, 'en-US'), 'uk');
  assert.equal(detectLang({ LC_ALL: 'ru_UA.UTF-8', LANG: 'en_US' }), 'ru');
});

test('t: substitutes variables, both languages define the same keys', () => {
  assert.equal(t('uk', 'noProject', { path: '/x' }), 'Папку проєкту не знайдено: /x');
  assert.equal(t('ru', 'noProject', { path: '/x' }), 'Папка проекта не найдена: /x');
});
