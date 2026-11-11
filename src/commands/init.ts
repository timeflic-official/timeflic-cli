import { examples } from '../schema.js';
import { access, writeFile } from 'node:fs/promises';

export const TEMPLATES = Object.keys(examples).toSorted();

/** `timeflic agent init <template> [--out file]`: start from a working manifest. */
export async function init(args: string[], out: (line: string) => void): Promise<number> {
  const name = args[0];
  const manifest = name === undefined ? undefined : examples[name];
  if (!name || !manifest) {
    out(`Usage: timeflic agent init <template> [--out timeflic-agent.json]`);
    out(`Templates: ${TEMPLATES.join(', ')}`);
    return name ? 1 : 0;
  }
  const outIndex = args.indexOf('--out');
  const target = outIndex >= 0 ? (args[outIndex + 1] ?? 'timeflic-agent.json') : 'timeflic-agent.json';
  try {
    await access(target);
    out(`${target} already exists; pass --out to choose another file.`);
    return 1;
  } catch {
    // does not exist yet: good
  }
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  out(`Wrote ${target} from the ${name} template. Edit slug, name, instructions and listing, then run: timeflic agent validate ${target}`);
  return 0;
}
