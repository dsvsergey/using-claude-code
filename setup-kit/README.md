# setup-kit — автоналаштування Claude Code / автонастройка Claude Code

**Українська** · [English](README.en.md)

Налаштовує Claude Code **глобально** — для всіх сесій і проєктів (`~/.claude`), як описано в гайді (`../index.html`).
Налаштування конкретного репозиторію — опційно, лише з `--project <path>`.
Повторний запуск безпечний: наявні файли не перезаписуються, JSON зливається, перед зміною робиться `.bak-…`.

## Запуск

macOS / Linux:
```bash
./setup-kit/setup.sh --dry-run                          # подивитись, що буде змінено
./setup-kit/setup.sh                                    # глобально, y/n по кожному компоненту
./setup-kit/setup.sh --preset full --yes                # усе глобально, без запитань
./setup-kit/setup.sh --project ~/code/my-repo --preset minimal   # ще й репозиторій
./setup-kit/setup.sh doctor                             # перевірити стан
```

Windows (PowerShell, у т.ч. RDP — змінюється лише профіль поточного користувача):
```powershell
powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 --dry-run
powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1
powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 --preset full --yes
powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 doctor
```

Потрібен Node.js ≥ 18 — скрипт запропонує встановити (winget / brew).

## Прапорці

| Прапорець | Що робить |
|---|---|
| (без прапорців) | глобально: `~/.claude`, для всіх сесій |
| `--project <path>` | лише вказаний репозиторій |
| `--user --project <path>` | і глобально, і репозиторій |
| `--preset minimal\|full` | готовий набір компонентів |
| `--with a,b` / `--without c,d` | додати / прибрати компоненти |
| `--yes` | без запитань (без пресета = `minimal`) |
| `--dry-run` | нічого не змінювати, показати diff |
| `--lang uk\|ru` | мова інтерфейсу |

## Компоненти

| id | Рівень | minimal | full |
|---|---|:-:|:-:|
**Глобальні** (`~/.claude`, для всіх сесій):

| id | minimal | full |
|---|:-:|:-:|
| `claude` — Claude Code CLI (+ PATH на Windows) | ✓ | ✓ |
| `user-settings` — deny для `.env`/секретів | ✓ | ✓ |
| `context7` — MCP документації (`claude mcp add --scope user`) | ✓ | ✓ |
| `global-claude-md` — блок командних правил у `~/.claude/CLAUDE.md` | | ✓ |
| `statusline` — заповненість контексту (ccstatusline) | | ✓ |
| `ccusage` — аналіз витрат | | ✓ |
| `engram` — памʼять між сесіями | | ✓ |
| `agents` — code-reviewer, test-writer, `/review-pr` у `~/.claude` | | ✓ |
| `serena` — MCP навігації по коду, працює в поточній папці (uv) | | ✓ |
| `graphify` — CLI і skill графа знань; граф будується лише на ваш запит (uv) | | ✓ |
| `speckit` — CLI `specify` (uv) | | ✓ |

**Репозиторій** (лише з `--project <path>`):

| id | minimal | full |
|---|:-:|:-:|
| `claude-md` — каркас `CLAUDE.md` + `.gitignore` | ✓ | ✓ |
| `project-settings` — allow/deny у `.claude/settings.json` | ✓ | ✓ |
| `adr` — `docs/adr/` | | ✓ |
| `format-hook` — prettier після Edit/Write (якщо є prettier) | | ✓ |
| `speckit-init` — `specify init` (з `--yes` у непорожньому репо пропускається) | | ✓ |

Після запуску: `claude` → `/login` → `/status` → `/mcp`. Для репозиторію: заповніть каркас `CLAUDE.md`, потім закомітьте `CLAUDE.md .claude/ docs/adr/`.

## Перевірка на Windows / RDP (для команди)

1. `powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 --dry-run` — лише `?`-рядки, код виходу 0.
2. Глобально: `...\setup.ps1 --preset minimal --yes`.
3. Новий термінал → `claude --version` працює (PATH виправлено).
4. `...\setup.ps1 doctor` — усі пункти `✓`.
5. Повторити крок 2 — усі рядки `=` (нічого не змінено).

## Розробка

```bash
cd setup-kit && node --test
```

---

## RU — кратко

То же самое, что выше: `setup.sh` / `setup.ps1` настраивают Claude Code по гайду (`../index.ru.html`).
Повторный запуск безопасен, существующие файлы не перезаписываются, JSON сливается, перед изменением создаётся `.bak-…`.
По умолчанию всё ставится глобально (`~/.claude`, для всех сессий); репозиторий — только с `--project <path>`.
Начните с `--dry-run`, затем `--preset minimal` или `--preset full`; проверка — `doctor`. Интерфейс на русском: `--lang ru`
(или автоматически по локали системы).
