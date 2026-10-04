// Component registry: each component maps a section of the guide to a list of actions (see fsops.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from './merge.mjs';

const text = (ctx, rel) => fs.readFileSync(path.join(ctx.templatesDir, ...rel.split('/')), 'utf8');
const json = (ctx, rel) => JSON.parse(text(ctx, rel));
const inProject = (ctx, ...rel) => path.join(ctx.project, ...rel);
const userSettings = (ctx) => path.join(ctx.home, '.claude', 'settings.json');
const inHome = (ctx, ...rel) => path.join(ctx.home, ...rel);
const copy = (ctx, rel) => ({ type: 'file', target: inProject(ctx, ...rel.split('/')), content: text(ctx, `project/${rel}`) });

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  const r = parseJson(fs.readFileSync(file, 'utf8'));
  return r.ok ? r.value : null;
}

const PS = (cmd) => `powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`;
const INSTALLERS = {
  claude: { win32: PS('irm https://claude.ai/install.ps1 | iex'), unix: 'curl -fsSL https://claude.ai/install.sh | bash' },
  uv: { win32: PS('irm https://astral.sh/uv/install.ps1 | iex'), unix: 'curl -LsSf https://astral.sh/uv/install.sh | sh' },
};
const installer = (ctx, tool) => INSTALLERS[tool][ctx.platform === 'win32' ? 'win32' : 'unix'];
const requireUv = (ctx) => ({ type: 'require', tool: 'uv', install: installer(ctx, 'uv') });
const requireClaude = { type: 'require', tool: 'claude', hint: 'install the claude component first' };

// User-scope MCP servers live in ~/.claude.json, which Claude Code rewrites constantly:
// read it to check, but register servers only through `claude mcp add --scope user`.
const userMcpServers = (ctx) => readJson(inHome(ctx, '.claude.json'))?.mcpServers ?? {};
function userMcp(ctx, name, command, extra = []) {
  if (name in userMcpServers(ctx)) return [{ type: 'skip', target: name, reason: 'MCP server already registered' }];
  return [...extra, requireClaude, { type: 'exec', label: `MCP ${name}`, command }];
}

const SPEC_KIT = 'git+https://github.com/github/spec-kit.git';

// The native installer puts claude.exe in %USERPROFILE%\.local\bin but does not always add it to PATH.
// Read/write the raw registry value so %VAR% entries stay unexpanded (REG_EXPAND_SZ). The literal
// %USERPROFILE% is built from [char]37 because cmd.exe expands %VAR% even inside quotes. The dummy
// variable set/unset broadcasts WM_SETTINGCHANGE so new terminals see the change.
const WIN_RAW_USER_PATH = "(Get-Item HKCU:\\Environment).GetValue('Path','',[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)";
const WIN_GET_USER_PATH = PS(WIN_RAW_USER_PATH);
const WIN_ADD_LOCAL_BIN = PS(
  [
    `$p = ${WIN_RAW_USER_PATH}`,
    "$bin = [char]37 + 'USERPROFILE' + [char]37 + '\\.local\\bin'",
    "$n = (@($p -split ';' | Where-Object { $_ }) + $bin) -join ';'",
    "Set-ItemProperty -Path HKCU:\\Environment -Name Path -Value $n -Type ExpandString",
    "[Environment]::SetEnvironmentVariable('SETUPKIT_REFRESH', '1', 'User')",
    "[Environment]::SetEnvironmentVariable('SETUPKIT_REFRESH', $null, 'User')",
  ].join('; '),
);

function winLocalBinMissing(ctx) {
  const wanted = [path.win32.join(ctx.home, '.local', 'bin'), '%userprofile%\\.local\\bin'].map((s) => s.toLowerCase());
  const entries = ctx.run.capture(WIN_GET_USER_PATH).stdout.toLowerCase().split(';').map((s) => s.trim().replace(/\\+$/, ''));
  return !entries.some((e) => wanted.includes(e));
}

const BOTH = ['minimal', 'full'];
const FULL = ['full'];

export const COMPONENTS = [
  // ── global: ~/.claude, applies to every Claude session ──
  {
    id: 'claude',
    scope: 'user',
    presets: BOTH,
    desc: { uk: 'Claude Code CLI (+ PATH на Windows)', ru: 'Claude Code CLI (+ PATH в Windows)' },
    plan(ctx) {
      const actions = [];
      if (!ctx.run.which('claude')) actions.push({ type: 'exec', label: 'install claude', command: installer(ctx, 'claude'), confirm: true });
      if (ctx.platform === 'win32' && winLocalBinMissing(ctx)) {
        actions.push({ type: 'exec', label: 'add %USERPROFILE%\\.local\\bin to PATH', command: WIN_ADD_LOCAL_BIN, confirm: true });
        actions.push({ type: 'note', text: 'Windows: open a new terminal so the PATH change applies' });
      }
      return actions.length ? actions : [{ type: 'skip', target: 'claude', reason: 'already installed' }];
    },
  },
  {
    id: 'user-settings',
    scope: 'user',
    presets: BOTH,
    desc: { uk: 'deny для секретів у ~/.claude/settings.json', ru: 'deny для секретов в ~/.claude/settings.json' },
    plan: (ctx) => [{ type: 'json', target: userSettings(ctx), template: json(ctx, 'user/settings.json') }],
  },
  {
    id: 'global-claude-md',
    scope: 'user',
    presets: FULL,
    desc: { uk: 'командні правила в ~/.claude/CLAUDE.md (для всіх сесій)', ru: 'командные правила в ~/.claude/CLAUDE.md (для всех сессий)' },
    plan: (ctx) => [{ type: 'block', target: inHome(ctx, '.claude', 'CLAUDE.md'), marker: 'setup-kit', content: text(ctx, 'user/CLAUDE.md') }],
  },
  {
    id: 'statusline',
    scope: 'user',
    presets: FULL,
    desc: { uk: 'statusline із заповненістю контексту (ccstatusline)', ru: 'statusline с заполненностью контекста (ccstatusline)' },
    plan: (ctx) => [{ type: 'json', target: userSettings(ctx), template: json(ctx, 'user/statusline.json') }],
  },
  {
    id: 'ccusage',
    scope: 'user',
    presets: FULL,
    desc: { uk: 'аналіз витрат токенів (npx ccusage)', ru: 'анализ расхода токенов (npx ccusage)' },
    plan: (ctx) =>
      ctx.run.which('npx')
        ? [{ type: 'note', text: 'ccusage: npx ccusage@latest daily' }]
        : [{ type: 'fail', target: 'ccusage', reason: 'npx not found' }],
  },
  {
    id: 'engram',
    scope: 'user',
    presets: FULL,
    desc: { uk: 'engram — локальна памʼять між сесіями', ru: 'engram — локальная память между сессиями' },
    plan(ctx) {
      const plugins = readJson(userSettings(ctx))?.enabledPlugins ?? {};
      if (Object.keys(plugins).some((k) => k.startsWith('engram@'))) {
        return [{ type: 'skip', target: 'engram', reason: 'plugin already enabled' }];
      }
      const actions = [];
      if (!ctx.run.which('engram')) {
        if (ctx.run.which('brew')) {
          actions.push({ type: 'exec', label: 'install engram', command: 'brew install gentleman-programming/tap/engram', confirm: true });
        } else if (ctx.run.which('go')) {
          actions.push({ type: 'exec', label: 'install engram', command: 'go install github.com/Gentleman-Programming/engram/v3/cmd/engram@latest', confirm: true });
        } else {
          return [{ type: 'fail', target: 'engram', reason: 'need brew or go: https://github.com/Gentleman-Programming/engram/blob/main/docs/INSTALLATION.md' }];
        }
      }
      actions.push({ type: 'require', tool: 'engram', hint: 'engram not found after install' });
      actions.push(requireClaude);
      actions.push({ type: 'exec', label: 'engram plugin', command: 'claude plugin marketplace add Gentleman-Programming/engram && claude plugin install engram' });
      return actions;
    },
  },
  {
    id: 'agents',
    scope: 'user',
    presets: FULL,
    desc: { uk: 'subagents code-reviewer, test-writer + /review-pr (у ~/.claude)', ru: 'subagents code-reviewer, test-writer + /review-pr (в ~/.claude)' },
    plan: (ctx) =>
      ['agents/code-reviewer.md', 'agents/test-writer.md', 'commands/review-pr.md'].map((rel) => ({
        type: 'file',
        target: inHome(ctx, '.claude', ...rel.split('/')),
        content: text(ctx, `user/${rel}`),
      })),
  },
  {
    id: 'context7',
    scope: 'user',
    presets: BOTH,
    desc: { uk: 'Context7 MCP — свіжа документація бібліотек', ru: 'Context7 MCP — свежая документация библиотек' },
    plan: (ctx) => userMcp(ctx, 'context7', 'claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp'),
  },
  {
    id: 'serena',
    scope: 'user',
    presets: FULL,
    desc: { uk: 'Serena MCP — семантична навігація по коду (потрібен uv)', ru: 'Serena MCP — семантическая навигация по коду (нужен uv)' },
    plan: (ctx) =>
      userMcp(
        ctx,
        'serena',
        'claude mcp add --scope user serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project-from-cwd',
        [requireUv(ctx)],
      ),
  },
  {
    id: 'graphify',
    scope: 'user',
    presets: FULL,
    desc: { uk: 'graphify — CLI і skill для графа знань (потрібен uv)', ru: 'graphify — CLI и skill для графа знаний (нужен uv)' },
    plan(ctx) {
      const installed = ctx.run.which('graphify');
      if (installed && fs.existsSync(inHome(ctx, '.claude', 'skills', 'graphify', 'SKILL.md'))) {
        return [{ type: 'skip', target: 'graphify', reason: 'already installed' }];
      }
      const actions = [requireUv(ctx)];
      if (!installed) actions.push({ type: 'exec', label: 'install graphify', command: 'uv tool install graphifyy', confirm: true });
      actions.push({ type: 'exec', label: 'graphify skill', command: 'graphify install' });
      return actions;
    },
  },
  {
    id: 'speckit',
    scope: 'user',
    presets: FULL,
    desc: { uk: 'Spec Kit — CLI specify (потрібен uv)', ru: 'Spec Kit — CLI specify (нужен uv)' },
    plan: (ctx) =>
      ctx.run.which('specify')
        ? [{ type: 'skip', target: 'speckit', reason: 'already installed' }]
        : [requireUv(ctx), { type: 'exec', label: 'install specify', command: `uv tool install specify-cli --from ${SPEC_KIT}`, confirm: true }],
  },

  // ── repository: only with --project <path> ──
  {
    id: 'claude-md',
    scope: 'project',
    presets: BOTH,
    desc: { uk: 'каркас CLAUDE.md + .gitignore для особистих файлів', ru: 'каркас CLAUDE.md + .gitignore для личных файлов' },
    plan(ctx) {
      const fresh = !fs.existsSync(inProject(ctx, 'CLAUDE.md'));
      return [
        copy(ctx, 'CLAUDE.md'),
        ...(fresh ? [{ type: 'note', text: 'CLAUDE.md is a skeleton: fill in the <placeholders> before committing' }] : []),
        { type: 'lines', target: inProject(ctx, '.gitignore'), lines: ['CLAUDE.local.md', '.claude/settings.local.json', '*.bak-*'] },
      ];
    },
  },
  {
    id: 'project-settings',
    scope: 'project',
    presets: BOTH,
    desc: { uk: 'дозволи allow/deny у .claude/settings.json', ru: 'разрешения allow/deny в .claude/settings.json' },
    plan: (ctx) => [{ type: 'json', target: inProject(ctx, '.claude', 'settings.json'), template: json(ctx, 'project/.claude/settings.json') }],
  },
  {
    id: 'adr',
    scope: 'project',
    presets: FULL,
    desc: { uk: 'docs/adr/ з шаблоном рішення', ru: 'docs/adr/ с шаблоном решения' },
    plan: (ctx) => [copy(ctx, 'docs/adr/0000-template.md')],
  },
  {
    id: 'format-hook',
    scope: 'project',
    presets: FULL,
    desc: { uk: 'hook: prettier після кожного Edit/Write', ru: 'hook: prettier после каждого Edit/Write' },
    plan(ctx) {
      const pkg = readJson(inProject(ctx, 'package.json'));
      if (!(pkg?.devDependencies?.prettier || pkg?.dependencies?.prettier)) {
        return [{ type: 'skip', target: 'format-hook', reason: 'prettier not in package.json' }];
      }
      return [
        copy(ctx, '.claude/hooks/format.mjs'),
        { type: 'json', target: inProject(ctx, '.claude', 'settings.json'), template: json(ctx, 'hooks/prettier.json') },
      ];
    },
  },
  {
    id: 'speckit-init',
    scope: 'project',
    presets: FULL,
    desc: { uk: 'specify init у репозиторії', ru: 'specify init в репозитории' },
    plan(ctx) {
      if (fs.existsSync(inProject(ctx, '.specify'))) return [{ type: 'skip', target: 'speckit-init', reason: '.specify exists' }];
      // spec-kit may overwrite files in a non-empty folder; only proceed when a person can answer its prompt.
      if (ctx.yes && fs.readdirSync(ctx.project).length) {
        return [{ type: 'skip', target: 'speckit-init', reason: 'non-empty repo: run without --yes to confirm' }];
      }
      const script = ctx.platform === 'win32' ? 'ps' : 'sh';
      return [
        requireUv(ctx),
        { type: 'exec', label: 'specify init', command: `uvx --from ${SPEC_KIT} specify init --here --integration claude --script ${script}`, cwd: ctx.project },
      ];
    },
  },
];
