# setup-kit — Claude Code auto-setup

[Українська](README.md) · **English**

Configures a developer machine and a repository the way the team guide (`../index.html`) describes.
Re-running is safe: existing files are never overwritten, JSON is merged, and a `.bak-…` copy is made before any change.

## Usage

macOS / Linux:
```bash
./setup-kit/setup.sh --dry-run              # preview what would change
./setup-kit/setup.sh                        # interactive, y/n for each component
./setup-kit/setup.sh --preset full --yes    # everything, no questions
./setup-kit/setup.sh doctor                 # check the current state
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
| `--user` | developer machine only (`~/.claude`) |
| `--project <path>` | repository only (defaults to the current folder unless `--user` is given) |
| `--preset minimal\|full` | predefined component set |
| `--with a,b` / `--without c,d` | add / remove components |
| `--yes` | no questions (without a preset = `minimal`) |
| `--dry-run` | change nothing, show a diff |
| `--lang uk\|ru` | interface language (UK/RU; detected from the system locale by default) |

## Components

| id | Scope | minimal | full |
|---|---|:-:|:-:|
| `claude` — Claude Code CLI (+ PATH on Windows) | user | ✓ | ✓ |
| `user-settings` — deny rules for `.env`/secrets | user | ✓ | ✓ |
| `statusline` — context usage in the status line (ccstatusline) | user | | ✓ |
| `ccusage` — token cost analysis | user | | ✓ |
| `engram` — memory across sessions | user | | ✓ |
| `claude-md` — `CLAUDE.md` skeleton + `.gitignore` | project | ✓ | ✓ |
| `project-settings` — allow/deny permissions | project | ✓ | ✓ |
| `context7` — library docs MCP | project | ✓ | ✓ |
| `format-hook` — prettier after Edit/Write (if the project uses prettier) | project | | ✓ |
| `agents` — code-reviewer, test-writer, `/review-pr` | project | | ✓ |
| `adr` — `docs/adr/` | project | | ✓ |
| `serena` — code navigation MCP (needs uv) | project | | ✓ |
| `graphify` — knowledge graph (needs uv) | project | | ✓ |
| `speckit` — Spec Kit (needs uv) | project | | ✓ |

After running: `claude` → `/login` → `/status` → `/mcp`, then commit `CLAUDE.md .claude/ .mcp.json docs/adr/`.

## Verifying on Windows / RDP (for the team)

1. `powershell -ExecutionPolicy Bypass -File .\setup-kit\setup.ps1 --dry-run` — only `?` lines, exit code 0.
2. In a test repository: `...\setup.ps1 --project . --preset minimal --yes`.
3. Open a new terminal → `claude --version` works (PATH fixed).
4. `...\setup.ps1 doctor` — every item is `✓`.
5. Repeat step 2 — every line is `=` (nothing changed).

## Development

```bash
cd setup-kit && node --test
```
