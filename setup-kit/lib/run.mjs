// Thin wrapper over child_process so components can be tested with a stub runner.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function extraBinDirs(home = os.homedir()) {
  return [path.join(home, '.local', 'bin'), path.join(home, '.cargo', 'bin'), path.join(home, 'go', 'bin')];
}

export function createRunner({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const sep = platform === 'win32' ? ';' : ':';
  const dirs = [...(env[pathKey] ?? '').split(sep), ...extraBinDirs(home)].filter(Boolean);
  const exts = platform === 'win32' ? ['', ...(env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').map((e) => e.toLowerCase())] : [''];
  const childEnv = { ...env, [pathKey]: dirs.join(sep) };

  const isFile = (f) => {
    try {
      return fs.statSync(f).isFile();
    } catch {
      return false;
    }
  };

  return {
    which(cmd) {
      for (const d of dirs) {
        for (const e of exts) {
          const f = path.join(d, cmd + e);
          if (isFile(f)) return f;
        }
      }
      return null;
    },
    exec(command, { cwd } = {}) {
      const r = spawnSync(command, { cwd, shell: true, stdio: 'inherit', env: childEnv });
      return r.status ?? 1;
    },
    capture(command) {
      const r = spawnSync(command, { shell: true, encoding: 'utf8', env: childEnv });
      return { code: r.status ?? 1, stdout: r.stdout ?? '' };
    },
  };
}
