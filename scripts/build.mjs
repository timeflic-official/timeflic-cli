#!/usr/bin/env node
// Bundle the CLI into one file, dist/main.js: the manifest schema, tools reference, templates
// and every npm dependency are inlined, so the published package has no dependencies and
// carries exactly the schema it was tested with. Also writes dist/THIRD_PARTY_LICENSES.md,
// because the MIT/BSD licences of the bundled packages ask for their notices to travel along.
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

await import('./readme-tables.mjs');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  metafile: true,
  legalComments: 'none',
  logLevel: 'warning',
  // Bundled CommonJS packages (ajv) may call require(); give the ES module one.
  banner: { js: "import { createRequire as __timeflicCreateRequire } from 'node:module';\nconst require = __timeflicCreateRequire(import.meta.url);" },
});

/** The npm packages that ended up in the bundle, found from the files esbuild read. */
function bundledPackages(inputs) {
  const found = new Map();
  for (const input of Object.keys(inputs)) {
    const match = input.match(/^(.*node_modules\/)((?:@[^/]+\/)?[^/]+)\//);
    if (!match) continue;
    const dir = resolve(root, match[1] + match[2]);
    if (found.has(dir)) continue;
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    found.set(dir, { name: pkg.name, version: pkg.version, license: pkg.license ?? 'see package', dir });
  }
  return [...found.values()].toSorted((a, b) => a.name.localeCompare(b.name));
}

const packages = bundledPackages(result.metafile.inputs);
const sections = packages.map(({ name, version, license, dir }) => {
  const file = readdirSync(dir).find((entry) => /^(licen[cs]e|copying)(\.|$)/i.test(entry));
  const text = file && existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8').trim() : `Licence: ${license} (no licence file shipped with the package).`;
  return `## ${name}@${version} (${license})\n\n\`\`\`\n${text}\n\`\`\``;
});
await writeFile(
  join(dist, 'THIRD_PARTY_LICENSES.md'),
  `# Third-party licences\n\ndist/main.js bundles these packages.\n\n${sections.join('\n\n')}\n`,
);

const size = (readFileSync(join(dist, 'main.js')).length / 1024).toFixed(0);
console.log(`Built dist/main.js (${size} KB) with ${packages.length} bundled packages: ${packages.map((p) => `${p.name}@${p.version}`).join(', ')}`);
