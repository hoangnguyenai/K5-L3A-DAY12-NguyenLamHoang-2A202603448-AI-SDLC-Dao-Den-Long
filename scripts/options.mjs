import { parseArgs } from 'node:util';
export function options(defaults) {
  const { values } = parseArgs({ options: Object.fromEntries(Object.entries(defaults)
    .map(([key, value]) => [key, { type: 'string', default: String(value) }])) });
  for (const key of Object.keys(defaults).filter(k => k !== 'out')) {
    values[key] = Number(values[key]);
    if (!Number.isSafeInteger(values[key]) || values[key] < (key === 'seed' ? 0 : 1)) throw Error('Invalid --' + key);
  }
  return values;
}
