# setup-kit — автоналаштування Claude Code / автонастройка Claude Code

Налаштовує машину розробника й репозиторій так, як описано в гайді (`../index.html`).
Повторний запуск безпечний: наявні файли не перезаписуються, JSON зливається, перед зміною робиться `.bak-…`.

## Запуск

macOS / Linux:
```bash
./setup-kit/setup.sh --dry-run              # подивитись, що буде змінено
./setup-kit/setup.sh                        # інтерактивно, y/n по кожному компоненту
./setup-kit/setup.sh --preset full --yes    # усе, без запитань
./setup-kit/setup.sh doctor                 # перевірити стан
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
| `--user` | лише машина розробника (`~/.claude`) |
| `--project <path>` | лише репозиторій (за замовчуванням — поточна папка, якщо не вказано `--user`) |
| `--preset minimal\|full` | готовий набір компонентів |
| `--with a,b` / `--without c,d` | додати / прибрати компоненти |
| `--yes` | без запитань (без пресета = `minimal`) |
| `--dry-run` | нічого не змінювати, показати diff |
| `--lang uk\|ru` | мова інтерфейсу |

## Компоненти

| id | Рівень | minimal | full |
|---|---|:-:|:-:|
| `claude` — Claude Code CLI (+ PATH на Windows) | user | ✓ | ✓ |
| `user-settings` — deny для `.env`/секретів | user | ✓ | ✓ |
| `statusline` — заповненість контексту (ccstatusline) | user | | ✓ |
| `ccusage` — аналіз витрат | user | | ✓ |
| `engram` — памʼять між сесіями | user | | ✓ |
| `claude-md` — каркас `CLAUDE.md` + `.gitignore` | project | ✓ | ✓ |
| `project-settings` — allow/deny | project | ✓ | ✓ |
| `context7` — MCP документації | project | ✓ | ✓ |
| `format-hook` — prettier після Edit/Write (якщо є prettier) | project | | ✓ |
| `agents` — code-reviewer, test-writer, `/review-pr` | project | | ✓ |
| `adr` — `docs/adr/` | project | | ✓ |
| `serena` — MCP навігації по коду (uv) | project | | ✓ |
| `graphify` — граф знань (uv) | project | | ✓ |
| `speckit` — Spec Kit (uv) | project | | ✓ |

Після запуску: `claude` → `/login` → `/status` → `/mcp`, закомітьте `CLAUDE.md .claude/ .mcp.json docs/adr/`.

## Перевірка на Windows / RDP (для команди)

1. `powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 --dry-run` — лише `?`-рядки, код виходу 0.
2. У тестовому репозиторії: `...\setup.ps1 --project . --preset minimal --yes`.
3. Новий термінал → `claude --version` працює (PATH виправлено).
4. `...\setup.ps1 doctor` — усі пункти `✓`.
5. Повторити крок 2 — усі рядки `=` (нічого не змінено).

## Розробка

```bash
cd setup-kit && node --test
```

---

## RU — кратко

То же самое, что выше: `setup.sh` / `setup.ps1` настраивают машину и репозиторий по гайду (`../index.ru.html`).
Повторный запуск безопасен, существующие файлы не перезаписываются, JSON сливается, перед изменением создаётся `.bak-…`.
Начните с `--dry-run`, затем `--preset minimal` или `--preset full`; проверка — `doctor`. Интерфейс на русском: `--lang ru`
(или автоматически по локали системы).
