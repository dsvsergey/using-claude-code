// Read-only checks that mirror the onboarding checklist (guide section 12).
import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from './merge.mjs';

export function runDoctor(ctx) {
  const checks = [];
  const add = (ok, label, detail = '') => checks.push({ ok, label, detail });

  add(Boolean(ctx.run.which('claude')), 'claude in PATH');

  const userSettings = path.join(ctx.home, '.claude', 'settings.json');
  const projectSettings = path.join(ctx.project, '.claude', 'settings.json');
  const mcpFile = path.join(ctx.project, '.mcp.json');
  const parsed = {};
  for (const f of [userSettings, projectSettings, mcpFile]) {
    if (!fs.existsSync(f)) continue;
    const r = parseJson(fs.readFileSync(f, 'utf8'));
    add(r.ok, `valid JSON: ${f}`, r.ok ? '' : r.error);
    if (r.ok) parsed[f] = r.value;
  }

  const deny = [userSettings, projectSettings].flatMap((f) => {
    const d = parsed[f]?.permissions?.deny;
    return Array.isArray(d) ? d : [];
  });
  add(deny.includes('Read(./.env)'), 'Read(./.env) in permissions.deny');
  add(fs.existsSync(path.join(ctx.project, 'CLAUDE.md')), 'CLAUDE.md in project');

  for (const [name, server] of Object.entries(parsed[mcpFile]?.mcpServers ?? {})) {
    if (server.command) add(Boolean(ctx.run.which(server.command)), `MCP ${name}: ${server.command} in PATH`);
  }
  return checks;
}
