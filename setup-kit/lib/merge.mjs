// Pure merge helpers for settings files. No IO.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text.replace(/^﻿/, '')) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Template fills gaps in user config; user values always win.
export function mergeJson(user, template) {
  const stats = { added: 0, kept: [] };
  const result = mergeValue(user, template, [], stats);
  return { result, added: stats.added, kept: stats.kept };
}

function mergeValue(u, t, path, stats) {
  if (u === undefined) {
    stats.added++;
    return structuredClone(t);
  }
  if (path.length === 2 && path[0] === 'hooks' && Array.isArray(u) && Array.isArray(t)) {
    return mergeHookEntries(u, t, stats);
  }
  if (Array.isArray(u) && Array.isArray(t)) {
    const out = [...u];
    for (const item of t) {
      if (!out.some((x) => same(x, item))) {
        out.push(structuredClone(item));
        stats.added++;
      }
    }
    return out;
  }
  if (isObj(u) && isObj(t)) {
    const out = { ...u };
    for (const [k, tv] of Object.entries(t)) {
      if (path.length === 1 && path[0] === 'mcpServers' && k in u) {
        if (!same(u[k], tv)) stats.kept.push([...path, k].join('.'));
        continue;
      }
      out[k] = mergeValue(u[k], tv, [...path, k], stats);
    }
    return out;
  }
  if (!same(u, t)) stats.kept.push(path.join('.'));
  return u;
}

// hooks.<Event> is a list of { matcher, hooks: [{ type, command }] }; dedupe by matcher + command.
function mergeHookEntries(u, t, stats) {
  const out = structuredClone(u);
  for (const entry of t) {
    const match = out.find((e) => (e.matcher ?? '') === (entry.matcher ?? ''));
    if (!match) {
      out.push(structuredClone(entry));
      stats.added++;
      continue;
    }
    match.hooks ??= [];
    for (const h of entry.hooks ?? []) {
      if (!match.hooks.some((x) => x.command === h.command)) {
        match.hooks.push(structuredClone(h));
        stats.added++;
      }
    }
  }
  return out;
}

export function appendLines(text, lines) {
  const existing = new Set(text.split(/\r?\n/).map((l) => l.trim()));
  const missing = lines.filter((l) => !existing.has(l.trim()));
  if (!missing.length) return { text, added: 0 };
  const sep = text === '' || text.endsWith('\n') ? '' : '\n';
  return { text: text + sep + missing.join('\n') + '\n', added: missing.length };
}
