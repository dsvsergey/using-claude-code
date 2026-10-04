// Applies component actions: create/merge files with backups, run commands, honor --dry-run.
import fs from 'node:fs';
import path from 'node:path';
import { appendBlock, appendLines, mergeJson, parseJson } from './merge.mjs';

export function timestamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function diffLines(before, after) {
  const x = before === '' ? [] : before.split('\n');
  const y = after.split('\n');
  const L = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) out.push(`- ${x[i++]}`);
    else out.push(`+ ${y[j++]}`);
  }
  while (i < x.length) out.push(`- ${x[i++]}`);
  while (j < y.length) out.push(`+ ${y[j++]}`);
  return out.filter((l) => l !== '+ ' && l !== '- ').join('\n');
}

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const stringify = (v) => JSON.stringify(v, null, 2) + '\n';
const entry = (status, target, detail = '') => ({ status, target, detail });

function commit(target, before, after, status, detail, ctx) {
  if (ctx.dryRun) {
    return [{ ...entry('would', target, `${status} ${detail}`.trim()), diff: diffLines(before ?? '', after) }];
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // Several components may touch one file in a run: the first backup holds the original, keep it.
  const bak = `${target}.bak-${timestamp(ctx.now())}`;
  if (before !== null && !fs.existsSync(bak)) fs.copyFileSync(target, bak);
  fs.writeFileSync(target, after);
  return [entry(status, target, detail)];
}

function applyFile(a, ctx) {
  if (read(a.target) !== null) return [entry('skipped', a.target, 'exists')];
  return commit(a.target, null, a.content, 'created', '', ctx);
}

function applyJson(a, ctx) {
  const before = read(a.target);
  if (before === null) return commit(a.target, null, stringify(a.template), 'created', '', ctx);
  const parsed = parseJson(before);
  if (!parsed.ok) return [entry('failed', a.target, parsed.error)];
  const { result, added, kept } = mergeJson(parsed.value, a.template);
  const keptEntries = kept.map((k) => entry('kept', a.target, k));
  if (JSON.stringify(result) === JSON.stringify(parsed.value)) return [entry('unchanged', a.target), ...keptEntries];
  return [...commit(a.target, before, stringify(result), 'merged', `+${added}`, ctx), ...keptEntries];
}

function applyLines(a, ctx) {
  const before = read(a.target);
  const { text, added } = appendLines(before ?? '', a.lines);
  if (before === null) return commit(a.target, null, text, 'created', '', ctx);
  if (!added) return [entry('unchanged', a.target)];
  return commit(a.target, before, text, 'merged', `+${added}`, ctx);
}

function applyBlock(a, ctx) {
  const before = read(a.target);
  const { text, added } = appendBlock(before ?? '', a.marker, a.content);
  if (before === null) return commit(a.target, null, text, 'created', '', ctx);
  if (!added) return [entry('unchanged', a.target)];
  return commit(a.target, before, text, 'merged', '+block', ctx);
}

async function applyExec(a, ctx) {
  if (ctx.dryRun) return [entry('would', a.label, a.command)];
  if (a.confirm && !ctx.yes && !(await ctx.confirm(`${a.label}: ${a.command}`))) {
    return [entry('skipped', a.label, 'declined')];
  }
  const code = ctx.run.exec(a.command, { cwd: a.cwd });
  return [code === 0 ? entry('ran', a.label) : entry('failed', a.label, `exit ${code}`)];
}

async function applyRequire(a, ctx) {
  if (ctx.run.which(a.tool)) return [];
  if (!a.install) {
    return [ctx.dryRun ? entry('would', a.tool, `requires ${a.tool}`) : entry('failed', a.tool, a.hint ?? 'not found')];
  }
  const r = await applyExec({ label: `install ${a.tool}`, command: a.install, confirm: true }, ctx);
  const status = r[0].status;
  if (status === 'would' || status === 'failed') return r;
  if (status === 'ran' && ctx.run.which(a.tool)) return r;
  return [...r, entry('failed', a.tool, status === 'ran' ? 'not found after install' : 'not installed')];
}

async function executeAction(a, ctx) {
  switch (a.type) {
    case 'file': return applyFile(a, ctx);
    case 'json': return applyJson(a, ctx);
    case 'lines': return applyLines(a, ctx);
    case 'block': return applyBlock(a, ctx);
    case 'exec': return applyExec(a, ctx);
    case 'require': return applyRequire(a, ctx);
    case 'skip': return [entry('skipped', a.target, a.reason)];
    case 'fail': return [entry('failed', a.target, a.reason)];
    case 'note': return [entry('note', a.text)];
    default: throw new Error(`Unknown action type: ${a.type}`);
  }
}

export async function executeActions(actions, ctx) {
  const out = [];
  for (const a of actions) {
    const entries = await executeAction(a, ctx);
    out.push(...entries);
    if (entries.some((e) => e.status === 'failed')) break;
  }
  return out;
}
