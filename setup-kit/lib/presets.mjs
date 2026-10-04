// Preset + --with/--without → list of component ids.

export const PRESETS = ['minimal', 'full'];

export class UsageError extends Error {}

export function resolveSelection(components, { preset, withIds = [], withoutIds = [], scopes }) {
  const known = components.map((c) => c.id);
  const unknown = [...withIds, ...withoutIds].filter((id) => !known.includes(id));
  if (unknown.length) {
    throw new UsageError(`Unknown component(s): ${unknown.join(', ')}. Available: ${known.join(', ')}`);
  }
  if (preset !== undefined && !PRESETS.includes(preset)) {
    throw new UsageError(`Unknown preset: ${preset}. Available: ${PRESETS.join(', ')}`);
  }
  const ids = new Set(preset ? components.filter((c) => c.presets.includes(preset)).map((c) => c.id) : []);
  for (const id of withIds) ids.add(id);
  for (const id of withoutIds) ids.delete(id);
  return components.filter((c) => ids.has(c.id) && scopes.includes(c.scope)).map((c) => c.id);
}
