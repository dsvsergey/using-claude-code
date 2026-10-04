// PostToolUse hook: format the file Claude just edited with the project's prettier.
import { spawnSync } from 'node:child_process';

let input = '';
process.stdin.on('data', (d) => (input += d)).on('end', () => {
  const file = JSON.parse(input || '{}').tool_input?.file_path;
  if (!file) return;
  const win = process.platform === 'win32';
  spawnSync('npx', ['prettier', '--write', '--ignore-unknown', '--log-level', 'silent', win ? `"${file}"` : file], {
    stdio: 'ignore',
    shell: win,
  });
});
