// Component registry: each component maps a section of the guide to a list of actions (see fsops.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from './merge.mjs';

const text = (ctx, rel) => fs.readFileSync(path.join(ctx.templatesDir, ...rel.split('/')), 'utf8');
const json = (ctx, rel) => JSON.parse(text(ctx, rel));
const inProject = (ctx, ...rel) => path.join(ctx.project, ...rel);
const userSettings = (ctx) => path.join(ctx.home, '.claude', 'settings.json');
const copy = (ctx, rel) => ({ type: 'file', target: inProject(ctx, ...rel.split('/')), content: text(ctx, `project/${rel}`) });

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  const r = parseJson(fs.readFileSync(file, 'utf8'));
  return r.ok ? r.value : null;
}

const BOTH = ['minimal', 'full'];
const FULL = ['full'];

export const COMPONENTS = [
  {
    id: 'user-settings',
    scope: 'user',
    presets: BOTH,
    desc: { uk: 'deny для секретів у ~/.claude/settings.json', ru: 'deny для секретов в ~/.claude/settings.json' },
    plan: (ctx) => [{ type: 'json', target: userSettings(ctx), template: json(ctx, 'user/settings.json') }],
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
    id: 'claude-md',
    scope: 'project',
    presets: BOTH,
    desc: { uk: 'каркас CLAUDE.md + .gitignore для особистих файлів', ru: 'каркас CLAUDE.md + .gitignore для личных файлов' },
    plan: (ctx) => [
      copy(ctx, 'CLAUDE.md'),
      { type: 'lines', target: inProject(ctx, '.gitignore'), lines: ['CLAUDE.local.md', '.claude/settings.local.json'] },
    ],
  },
  {
    id: 'project-settings',
    scope: 'project',
    presets: BOTH,
    desc: { uk: 'дозволи allow/deny у .claude/settings.json', ru: 'разрешения allow/deny в .claude/settings.json' },
    plan: (ctx) => [{ type: 'json', target: inProject(ctx, '.claude', 'settings.json'), template: json(ctx, 'project/.claude/settings.json') }],
  },
  {
    id: 'context7',
    scope: 'project',
    presets: BOTH,
    desc: { uk: 'Context7 MCP — свіжа документація бібліотек', ru: 'Context7 MCP — свежая документация библиотек' },
    plan: (ctx) => [{ type: 'json', target: inProject(ctx, '.mcp.json'), template: json(ctx, 'mcp/context7.json') }],
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
    id: 'agents',
    scope: 'project',
    presets: FULL,
    desc: { uk: 'subagents code-reviewer, test-writer + /review-pr', ru: 'subagents code-reviewer, test-writer + /review-pr' },
    plan: (ctx) => ['.claude/agents/code-reviewer.md', '.claude/agents/test-writer.md', '.claude/commands/review-pr.md'].map((r) => copy(ctx, r)),
  },
  {
    id: 'adr',
    scope: 'project',
    presets: FULL,
    desc: { uk: 'docs/adr/ з шаблоном рішення', ru: 'docs/adr/ с шаблоном решения' },
    plan: (ctx) => [copy(ctx, 'docs/adr/0000-template.md')],
  },
];
