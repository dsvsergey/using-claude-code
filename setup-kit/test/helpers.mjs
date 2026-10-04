import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'setupkit-'));
export const fixedNow = () => new Date(2026, 9, 4, 12, 0, 0);

// Snapshot of a directory tree: "rel/path" for dirs, "rel/path:content" for files.
export function walk(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const rel = path.relative(base, p);
    if (fs.statSync(p).isDirectory()) out.push(rel, ...walk(p, base));
    else out.push(`${rel}:${fs.readFileSync(p, 'utf8')}`);
  }
  return out;
}
