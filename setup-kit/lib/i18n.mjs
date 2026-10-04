// UI strings (UK/RU) and language detection.

const STR = {
  uk: {
    usage: `Використання:
  setup [--user] [--project <path>] [--preset minimal|full] [--with a,b] [--without c,d] [--yes] [--dry-run] [--lang uk|ru]
  setup doctor [--project <path>]

Без --user/--project налаштовуються обидва рівні. Без --preset і --yes — питання y/n по кожному компоненту.
Компоненти: {ids}`,
    ask: '{id} — {desc}?',
    noTty: 'Немає інтерактивного терміналу: беру набір minimal.',
    noProject: 'Папку проєкту не знайдено: {path}',
    dryRun: 'Пробний запуск (--dry-run): нічого не змінено.',
    next: 'Далі: claude → /login → /status → /mcp',
    commit: 'Закомітьте: {files}',
    optional: 'Опційно: /plugin → superpowers (brainstorm → plan → TDD → review)',
    doctorTitle: 'Перевірка налаштувань',
  },
  ru: {
    usage: `Использование:
  setup [--user] [--project <path>] [--preset minimal|full] [--with a,b] [--without c,d] [--yes] [--dry-run] [--lang uk|ru]
  setup doctor [--project <path>]

Без --user/--project настраиваются оба уровня. Без --preset и --yes — вопросы y/n по каждому компоненту.
Компоненты: {ids}`,
    ask: '{id} — {desc}?',
    noTty: 'Нет интерактивного терминала: беру набор minimal.',
    noProject: 'Папка проекта не найдена: {path}',
    dryRun: 'Пробный запуск (--dry-run): ничего не изменено.',
    next: 'Дальше: claude → /login → /status → /mcp',
    commit: 'Закоммитьте: {files}',
    optional: 'Опционально: /plugin → superpowers (brainstorm → plan → TDD → review)',
    doctorTitle: 'Проверка настроек',
  },
};

export function detectLang(env, locale = Intl.DateTimeFormat().resolvedOptions().locale) {
  const value = env.LC_ALL || env.LC_MESSAGES || env.LANG || locale || '';
  return /^ru/i.test(value) ? 'ru' : 'uk';
}

export function t(lang, key, vars = {}) {
  const s = STR[lang]?.[key] ?? STR.uk[key];
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
