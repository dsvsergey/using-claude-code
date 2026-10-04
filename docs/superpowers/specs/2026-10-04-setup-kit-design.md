# setup-kit — автоналаштування Claude Code для команди

Дата: 2026-10-04 · Статус: дизайн погоджено, очікує рецензії специфікації

## 1. Мета

Одна команда налаштовує машину розробника й репозиторій так, як описано в гайді `index.html`
(розділи 1–9, 12). Критерій успіху: після запуску всі пункти чекліста онбордингу (розділ 12)
виконано, крім тих, що потребують людини (логін, спроба Plan mode / Spec Kit на реальній задачі).

### Обмеження
- Платформи: Windows (включно зі спільним RDP-сервером) і macOS/Linux.
- Повторний запуск безпечний (ідемпотентність); наявні налаштування користувача не руйнуються.
- Інтерфейс UK/RU.
- Поставка: папка `setup-kit/` у цьому репозиторії (clone / zip).

### Поза межами
- Логін в акаунт Claude.
- Встановлення plugins (Superpowers тощо) — лише підказка у фінальному звіті.
- Будь-які git-операції (коміти, push).
- Загальносистемні зміни (лише профіль поточного користувача).

## 2. Архітектура

Тонкі обгортки для ОС + спільне ядро на Node.js (ESM, без npm-залежностей, Node ≥ 18).

```
setup-kit/
├── setup.ps1              # Windows: передумови → node lib/apply.mjs <args>
├── setup.sh               # macOS/Linux: те саме
├── README.md              # UK + RU: запуск, прапорці, компоненти
├── lib/
│   ├── apply.mjs          # CLI-вхід: розбір аргументів, резолв набору, запуск, звіт
│   ├── merge.mjs          # чисті функції злиття JSON / .gitignore
│   ├── components.mjs     # реєстр компонентів
│   ├── presets.mjs        # minimal/full + резолвер --with/--without
│   ├── fsops.mjs          # запис з бекапом, dry-run, diff
│   ├── run.mjs            # запуск зовнішніх команд (підмінюється в тестах)
│   ├── doctor.mjs         # перевірки без змін
│   └── i18n.mjs           # рядки UK/RU, визначення мови з локалі
├── templates/
│   ├── user/settings.json
│   └── project/
│       ├── CLAUDE.md
│       ├── .mcp.json                 # фрагменти: context7, serena
│       ├── .claude/settings.json
│       ├── .claude/commands/review-pr.md
│       ├── .claude/agents/code-reviewer.md
│       ├── .claude/agents/test-writer.md
│       └── docs/adr/0000-template.md
└── test/
    ├── merge.test.mjs
    ├── presets.test.mjs
    └── apply.test.mjs     # інтеграційні, тимчасові HOME/проєкт
```

### Відповідальність обгорток (`setup.ps1` / `setup.sh`)
1. Перевірити Node ≥ 18; якщо немає — запропонувати встановлення (Windows: `winget install OpenJS.NodeJS.LTS`;
   macOS: `brew install node`; Linux: вивести інструкцію і завершитися з кодом 1).
2. Передати всі аргументи в `node lib/apply.mjs`.
3. Нічого іншого — уся логіка в ядрі.

## 3. Компоненти

Кожен компонент: `{ id, scope: 'user'|'project', presets: [...], requires: [...], plan(ctx) → actions[] }`.
`plan` повертає список дій (write/merge/append/exec), які виконує `apply` — це дозволяє dry-run і тести.

| id | scope | Дія | minimal | full |
|---|---|---|:-:|:-:|
| `claude` | user | Якщо `claude` нема в PATH: нативний інсталятор (Win: `irm https://claude.ai/install.ps1 \| iex`; Unix: `curl -fsSL https://claude.ai/install.sh \| bash`). На Windows — додати `%USERPROFILE%\.local\bin` у user PATH, якщо відсутній. | ✓ | ✓ |
| `user-settings` | user | merge `templates/user/settings.json` → `~/.claude/settings.json` (deny секретів) | ✓ | ✓ |
| `statusline` | user | merge `statusLine` з відображенням контексту в `~/.claude/settings.json` | | ✓ |
| `ccusage` | user | лише перевірка, що `npx ccusage` доступний; підказка у звіті | | ✓ |
| `claude-md` | project | створити `CLAUDE.md` з каркаса; додати `CLAUDE.local.md`, `.claude/settings.local.json` у `.gitignore` | ✓ | ✓ |
| `project-settings` | project | merge `.claude/settings.json` (allow/deny) | ✓ | ✓ |
| `context7` | project | merge сервер `context7` у `.mcp.json` | ✓ | ✓ |
| `format-hook` | project | merge PostToolUse prettier-hook — лише якщо `prettier` є в `package.json` (deps/devDeps); інакше `skipped` з причиною | | ✓ |
| `agents` | project | створити `code-reviewer.md`, `test-writer.md`, `commands/review-pr.md` | | ✓ |
| `adr` | project | створити `docs/adr/0000-template.md`; якщо `CLAUDE.md` створено цим запуском — він уже містить посилання `@docs/adr/` | | ✓ |
| `serena` | project | requires `uv`; merge сервер `serena` у `.mcp.json` | | ✓ |
| `engram` | user | встановити engram (офіційний спосіб з README) і зареєструвати MCP через `claude mcp add --scope user` | | ✓ |
| `graphify` | project | встановити graphify (офіційний спосіб з README), виконати `graphify update .` | | ✓ |
| `speckit` | project | requires `uv`; `uvx --from git+https://github.com/github/spec-kit.git specify init --here --ai claude` | | ✓ |

Точні команди встановлення `engram`, `graphify`, `serena`, `speckit`, `statusline` уточнюються
на етапі реалізації за актуальними README і фіксуються в `components.mjs` в одному місці.

### Передумови
- `node` — перевіряють обгортки.
- `uv` — для `serena`, `speckit`. Якщо нема: запит на встановлення (у `--yes` — встановити) з офіційного
  інсталятора astral.sh. Невдача → компонент `failed`, решта продовжує.

## 4. CLI

```
setup [--user] [--project <path>] [--preset minimal|full]
      [--with a,b] [--without c,d] [--yes] [--dry-run] [--lang uk|ru]
setup doctor [--project <path>]
```

- Без `--user`/`--project` — обидва рівні; `--project` за замовчуванням — поточна папка.
- Резолв набору: пресет → `+with` → `−without`, далі фільтр за обраними рівнями.
- Без пресета й без `--yes` — інтерактивний `y/n` по кожному компоненту, дефолт = членство в `minimal`.
- `--yes` без пресета = `minimal`, без запитань.
- Невідомий id у `--with`/`--without` → помилка зі списком допустимих, код 2.
- Мова: `--lang`, інакше з `LANG`/`LC_ALL` або (Windows) `Intl` локалі; `ru*` → RU, інакше UK.
- Коди виходу: 0 — все ок/skipped; 1 — хоча б один `failed`; 2 — помилка аргументів.

### Фінальний звіт
```
✓ created  .claude/settings.json
~ merged   ~/.claude/settings.json (+3 deny)
= skipped  CLAUDE.md (exists)
! kept yours: statusLine
✗ failed   serena (uv not found)

Next: claude → /login → /status → /mcp
Commit: CLAUDE.md .claude/ .mcp.json docs/adr/
Optional: /plugin → superpowers
```

### doctor
Тільки читання. Перевіряє: `claude` у PATH і версія; Node; uv (якщо потрібен); валідність JSON у
`~/.claude/settings.json`, `.claude/settings.json`, `.mcp.json`; наявність deny для `.env`;
наявність `CLAUDE.md`; що команди MCP-серверів з `.mcp.json` резолвляться в PATH. Вивід — чекліст ✓/✗,
код 1 при будь-якому ✗.

## 5. Злиття і безпека

| Тип | Файлу нема | Файл є |
|---|---|---|
| Markdown | створити з шаблону | не чіпати → `skipped` |
| `.gitignore` | створити | дописати відсутні рядки |
| JSON | створити | merge |

Правила merge (`merge(user, template)`):
- Масиви: обʼєднання без дублікатів (порівняння за `JSON.stringify`), порядок користувача, нове — в кінець.
- Обʼєкти: рекурсивно.
- Скаляри: значення користувача зберігається; при розбіжності — запис `kept yours: <path>` у звіт.
- `hooks.<Event>`: запис шаблону додається, лише якщо немає запису з тим самим `matcher`, що містить хук з тією самою `command`.
- `mcpServers.<name>`: якщо імʼя вже є — не чіпати.
- Невалідний JSON: файл не змінюється, `failed` з повідомленням парсера.
- Властивість: `merge(merge(u,t),t)` глибоко дорівнює `merge(u,t)`.

Запис:
- Перед зміною наявного файлу — бекап `<file>.bak-YYYYMMDD-HHMMSS`.
- Якщо результат merge ідентичний вмісту — файл не переписується, бекап не створюється (`= unchanged`).
- `--dry-run`: нічого не пишеться і не виконується; для змін показується unified diff, для exec — команда.

Безпека:
- Шаблони без секретів; ключі лише через `${ENV}` у `.mcp.json`.
- Глобальний deny: `Read(./.env)`, `Read(./.env.*)`, `Read(./secrets/**)`, `Bash(rm -rf:*)`.
- Проєктний deny: те саме + `Bash(git push:*)`; allow: `Bash(git status)`, `Bash(git diff:*)`, `Bash(git log:*)`.
- Ніколи не встановлювати `bypassPermissions` / `defaultMode` у шаблонах.
- Зовнішні інсталятори — лише з офіційних URL; перед виконанням команда показується й вимагає `y` (крім `--yes`).
- Лише профіль поточного користувача.

## 6. Тестування

- Юніт (`node --test`): `merge.mjs` (масиви, скаляри, hooks, mcpServers, зламаний JSON, ідемпотентність),
  `presets.mjs` (пресети, with/without, невідомі id).
- Інтеграційні: `apply.mjs` з підміненими `HOME` і проєктом у `os.tmpdir()`, `run.mjs` замінено заглушкою,
  що записує команди:
  - порожній проєкт → очікувані файли;
  - наявні `CLAUDE.md` + `settings.json` → markdown незмінний, JSON злитий, є `.bak`;
  - повторний запуск → нуль змін;
  - `--dry-run` → жодних змін на диску.
- Ручна перевірка: macOS — `setup.sh --dry-run`, `--preset minimal` у тестовому репо, `doctor`.
  `setup.ps1` — синтаксис через `pwsh`, якщо доступний; реальний прогін на Windows/RDP — за списком
  команд у README (виконує команда).

## 7. Зміни на сайті

Новий розділ «13. Автоналаштування» в `index.html` та «13. Автонастройка» в `index.ru.html` + пункт
у sidebar: команди запуску для Windows і macOS/Linux, пресети, `doctor`, посилання на `setup-kit/README.md`.
