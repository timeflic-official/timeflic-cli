import { tools as reference } from './schema.js';
import { readFileSync } from 'node:fs';

/**
 * `timeflic --version`: the CLI version and the date of the schema and tools reference
 * it carries, so a support question starts with both. package.json sits one folder above
 * src/ in a checkout and one above dist/ in the installed package.
 */
export function version(): string {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  return `@timeflic/cli ${pkg.version} · schema synced ${reference.synced_at}`;
}
