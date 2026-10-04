# setup-kit — Claude Code auto-setup

[Українська](README.md) · **English**

Configures Claude Code **globally** — for every session and project (`~/.claude`) — the way the team guide (`../index.html`) describes.
Configuring a specific repository is optional and happens only with `--project <path>`.
Re-running is safe: existing files are never overwritten, JSON is merged, and a `.bak-…` copy is made before any change.

## Usage

macOS / Linux:
```bash
./setup-kit/setup.sh --dry-run                          # preview what would change
./setup-kit/setup.sh                                    # global, y/n for each component
./setup-kit/setup.sh --preset full --yes                # everything global, no questions
./setup-kit/setup.sh --project ~/code/my-repo --preset minimal   # also set up a repository
./setup-kit/setup.sh doctor                             # check the current state
```

Windows (PowerShell, incl. RDP — only the current user's profile is changed):
```powershell
powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 --dry-run
powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1
powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 --preset full --yes
powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 doctor
```

Requires Node.js ≥ 18 — the script offers to install it (winget / brew).

## Flags

| Flag | What it does |
|---|---|
| (no flags) | global: `~/.claude`, for every session |
| `--project <path>` | only the given repository |
| `--user --project <path>` | both global and the repository |
| `--preset minimal\|full` | predefined component set |
| `--with a,b` / `--without c,d` | add / remove components |
| `--yes` | no questions (without a preset = `minimal`) |
| `--dry-run` | change nothing, show a diff |
| `--lang uk\|ru` | interface language (UK/RU; detected from the system locale by default) |

## Components

**Global** (`~/.claude`, every session):

| id | minimal | full |
|---|:-:|:-:|
| `claude` — Claude Code CLI (+ PATH on Windows) | ✓ | ✓ |
| `user-settings` — deny rules for `.env`/secrets | ✓ | ✓ |
| `context7` — library docs MCP (`claude mcp add --scope user`) | ✓ | ✓ |
| `global-claude-md` — team rules block in `~/.claude/CLAUDE.md` | | ✓ |
| `statusline` — context usage in the status line (ccstatusline) | | ✓ |
| `ccusage` — token cost analysis | | ✓ |
| `engram` — memory across sessions | | ✓ |
| `agents` — code-reviewer, test-writer, `/review-pr` in `~/.claude` | | ✓ |
| `serena` — code navigation MCP, works in the current folder (needs uv) | | ✓ |
| `graphify` — knowledge graph CLI and skill; a graph is built only when you ask (needs uv) | | ✓ |
| `speckit` — the `specify` CLI (needs uv) | | ✓ |

**Repository** (only with `--project <path>`):

| id | minimal | full |
|---|:-:|:-:|
| `claude-md` — `CLAUDE.md` skeleton + `.gitignore` | ✓ | ✓ |
| `project-settings` — allow/deny in `.claude/settings.json` | ✓ | ✓ |
| `adr` — `docs/adr/` | | ✓ |
| `format-hook` — prettier after Edit/Write (if the project uses prettier) | | ✓ |
| `speckit-init` — `specify init` (skipped with `--yes` in a non-empty repo) | | ✓ |

After running: `claude` → `/login` → `/status` → `/mcp`. For a repository: fill in the `CLAUDE.md` skeleton, then commit `CLAUDE.md .claude/ docs/adr/`.

## Verifying on Windows / RDP (for the team)

1. `powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 --dry-run` — only `?` lines, exit code 0.
2. Global: `...\setup.ps1 --preset minimal --yes`.
3. Open a new terminal → `claude --version` works (PATH fixed).
4. `...\setup.ps1 doctor` — every item is `✓`.
5. Repeat step 2 — every line is `=` (nothing changed).

## Development

```bash
cd setup-kit && node --test
```
