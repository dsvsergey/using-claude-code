#!/usr/bin/env node
// CLI entry: parse flags, pick components, execute their actions, print a report.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { COMPONENTS } from './components.mjs';
import { runDoctor } from './doctor.mjs';
import { executeActions } from './fsops.mjs';
import { detectLang, t } from './i18n.mjs';
import { resolveSelection, UsageError } from './presets.mjs';
import { createRunner } from './run.mjs';

const TEMPLATES = fileURLToPath(new URL('../templates/', import.meta.url));
const SYMBOL = { created: '✓', merged: '~', unchanged: '=', skipped: '=', kept: '!', failed: '✗', ran: '✓', would: '?', note: '•' };

export function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      user: { type: 'boolean' },
      project: { type: 'string' },
      preset: { type: 'string' },
      with: { type: 'string' },
      without: { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
      'dry-run': { type: 'boolean' },
      lang: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
  const explicit = [...(values.user ? ['user'] : []), ...(values.project !== undefined ? ['project'] : [])];
  return {
    command: positionals[0] ?? 'apply',
    scopes: explicit.length ? explicit : ['user'],
    project: values.project,
    preset: values.preset,
    withIds: list(values.with),
    withoutIds: list(values.without),
    yes: Boolean(values.yes),
    dryRun: Boolean(values['dry-run']),
    lang: values.lang,
    help: Boolean(values.help),
  };
}

function createAsk() {
  if (!process.stdin.isTTY) return async () => null;
  return async (question, def) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(question)).trim().toLowerCase();
    rl.close();
    if (!answer) return def;
    return ['y', 'yes', 'т', 'так', 'д', 'да'].includes(answer);
  };
}

async function chooseInteractively(opts, ask, lang, out) {
  resolveSelection(COMPONENTS, { withIds: opts.withIds, withoutIds: opts.withoutIds, scopes: opts.scopes }); // validates ids
  const ids = [];
  let warned = false;
  for (const c of COMPONENTS.filter((c) => opts.scopes.includes(c.scope))) {
    if (opts.withIds.includes(c.id)) {
      ids.push(c.id);
      continue;
    }
    if (opts.withoutIds.includes(c.id)) continue;
    const def = c.presets.includes('minimal');
    let yes = await ask(`${t(lang, 'ask', { id: c.id, desc: c.desc[lang] })} ${def ? '[Y/n]' : '[y/N]'} `, def);
    if (yes === null) {
      if (!warned) out(t(lang, 'noTty'));
      warned = true;
      yes = def;
    }
    if (yes) ids.push(c.id);
  }
  return ids;
}

function show(p, ctx) {
  if (!path.isAbsolute(p)) return p;
  if (p.startsWith(ctx.project + path.sep)) return path.relative(ctx.project, p);
  if (p.startsWith(ctx.home + path.sep)) return `~${path.sep}${path.relative(ctx.home, p)}`;
  return p;
}

function commitList(entries, ctx) {
  const files = new Set();
  for (const e of entries) {
    if (!['created', 'merged'].includes(e.status) || !e.target.startsWith(ctx.project + path.sep)) continue;
    const parts = path.relative(ctx.project, e.target).split(path.sep);
    files.add(parts.length === 1 ? parts[0] : parts[0] === 'docs' ? 'docs/adr/' : `${parts[0]}/`);
  }
  return [...files];
}

function report(entries, ctx, lang, out) {
  for (const e of entries) {
    out(`${SYMBOL[e.status]} ${e.status.padEnd(9)} ${show(e.target, ctx)}${e.detail ? ` (${e.detail})` : ''}`);
    if (e.diff) out(e.diff.split('\n').map((l) => `    ${l}`).join('\n'));
  }
  out('');
  if (ctx.dryRun) out(t(lang, 'dryRun'));
  out(t(lang, 'next'));
  const files = commitList(entries, ctx);
  if (files.length) out(t(lang, 'commit', { files: files.join(' ') }));
  out(t(lang, 'optional'));
}

export async function main(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const home = deps.home ?? os.homedir();
  const out = deps.stdout ?? ((s) => process.stdout.write(`${s}\n`));
  const run = deps.run ?? createRunner({ env, home });

  let opts;
  try {
    opts = parseCli(argv);
  } catch (e) {
    out(e.message);
    return 2;
  }
  const lang = opts.lang === 'ru' || opts.lang === 'uk' ? opts.lang : detectLang(env);
  const usage = t(lang, 'usage', { ids: COMPONENTS.map((c) => c.id).join(', ') });
  if (opts.help) {
    out(usage);
    return 0;
  }

  const project = path.resolve(deps.cwd ?? process.cwd(), opts.project ?? '.');
  if (opts.project !== undefined && (!fs.existsSync(project) || !fs.statSync(project).isDirectory())) {
    out(t(lang, 'noProject', { path: project }));
    return 2;
  }

  const ask = deps.ask ?? createAsk();
  const ctx = {
    home,
    project,
    platform: deps.platform ?? process.platform,
    env,
    run,
    templatesDir: TEMPLATES,
    yes: opts.yes,
    dryRun: opts.dryRun,
    checkProject: opts.project !== undefined,
    now: deps.now ?? (() => new Date()),
    confirm: async (q) => (await ask(`${q} [y/N] `, false)) ?? false,
  };

  if (opts.command === 'doctor') {
    out(t(lang, 'doctorTitle'));
    const checks = runDoctor(ctx);
    for (const c of checks) out(`${c.ok ? '✓' : '✗'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
    return checks.every((c) => c.ok) ? 0 : 1;
  }
  if (opts.command !== 'apply') {
    out(usage);
    return 2;
  }

  let ids;
  try {
    ids = opts.preset || opts.yes
      ? resolveSelection(COMPONENTS, { ...opts, preset: opts.preset ?? 'minimal' })
      : await chooseInteractively(opts, ask, lang, out);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    out(e.message);
    return 2;
  }

  const entries = [];
  for (const c of COMPONENTS.filter((c) => ids.includes(c.id))) {
    try {
      entries.push(...(await executeActions(c.plan(ctx), ctx)));
    } catch (e) {
      entries.push({ status: 'failed', target: c.id, detail: e.message });
    }
  }
  report(entries, ctx, lang, out);
  return entries.some((e) => e.status === 'failed') ? 1 : 0;
}

// Compare real paths: Node resolves symlinks/junctions in import.meta.url but not in argv[1].
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    const a = fs.realpathSync(process.argv[1]);
    const b = fs.realpathSync(fileURLToPath(import.meta.url));
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch {
    return false;
  }
}
if (invokedDirectly()) main(process.argv.slice(2)).then((code) => process.exit(code));
