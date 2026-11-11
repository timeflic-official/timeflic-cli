import { readFile } from 'node:fs/promises';
import { validateManifest } from '../manifest-validator.js';

/** `timeflic agent validate [file]`: exit 0 when the manifest would be accepted. */
export async function validate(args: string[], out: (line: string) => void): Promise<number> {
  const file = args[0] ?? 'timeflic-agent.json';
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    out(`Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const problems = validateManifest(parsed);
  if (problems.length === 0) {
    out(`${file} is valid.`);
    return 0;
  }
  out(`${file} has ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const problem of problems) out(`  - ${problem}`);
  return 1;
}
